import { createServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";

/**
 * Captura de ofertas Amazon via Creators API (sucessor da Product Advertising
 * API). Fluxo usado pela fonte do tipo "amazon":
 *
 *   1. Extrai os ASINs do identificador da fonte (lista de ASINs ou links).
 *   2. Obtém um access token OAuth 2.0 no endpoint Login with Amazon (LwA)
 *      da região do marketplace usando as credenciais da conta de afiliado.
 *   3. Chama o endpoint catalogo getItems (Creators API) para buscar título,
 *      preços e imagem de cada produto.
 *   4. Grava as ofertas em `offers` + `offer_media` (deduplicando por fonte).
 *
 * Tudo roda NO SERVIDOR: o client_id/client_secret nunca saem do backend.
 */

// Cliente Supabase sem tipagem estática — colunas conferidas no schema gerado
// em src/integrations/supabase/types.ts. Mesmo padrão de telegram.server.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const CREATORS_API_GET_ITEMS = "https://creatorsapi.amazon/catalog/v1/getItems";
const MAX_ASINS_PER_REQUEST = 20;
const DEFAULT_MARKETPLACE = "www.amazon.com.br";

const NA_TOKEN_ENDPOINT = "https://api.amazon.com/auth/o2/token";

/** Region → endpoint de token do Login with Amazon. As credenciais funcionam
 * globalmente; só o endpoint de token muda por região. */
const TOKEN_ENDPOINTS: Array<{ marketplace: RegExp; endpoint: string }> = [
  {
    marketplace: /(\.co\.jp|\.sg|\.com\.au)$/i,
    endpoint: "https://api.amazon.co.jp/auth/o2/token",
  },
  {
    marketplace:
      /(\.co\.uk|\.de|\.fr|\.it|\.es|\.nl|\.be|\.eg|\.in|\.ie|\.pl|\.sa|\.se|\.tr|\.ae)$/i,
    endpoint: "https://api.amazon.co.uk/auth/o2/token",
  },
  {
    marketplace: /(\.com|\.com\.br|\.ca|\.com\.mx)$/i,
    endpoint: NA_TOKEN_ENDPOINT,
  },
];

export interface AmazonCreatorsConfig {
  client_id: string;
  client_secret: string;
  partner_tag: string;
  marketplace: string;
}

export interface AmazonCaptureReport {
  offersCaptured: number;
  offersIgnored: number;
  offersFailed: number;
  errors: string[];
}

interface AmazonItem {
  asin: string;
  title: string;
  url: string;
  image: string | null;
  sale_price: number | null;
  original_price: number | null;
  currency: string;
}

// Cache de token em memória por client_id (expira em ~1h; reutilizamos até 5 min.)
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function tokenEndpointFor(marketplace: string): string {
  const match = TOKEN_ENDPOINTS.find((item) => item.marketplace.test(marketplace));
  return match ? match.endpoint : NA_TOKEN_ENDPOINT;
}

async function fetchAccessToken(config: AmazonCreatorsConfig): Promise<string> {
  const cached = tokenCache.get(config.client_id);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const response = await fetch(tokenEndpointFor(config.marketplace), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: config.client_id,
      client_secret: config.client_secret,
      scope: "creatorsapi::default",
    }),
  });
  if (!response.ok) {
    throw new Error(`Falha ao obter token Amazon (HTTP ${response.status}).`);
  }
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new Error("Resposta de token Amazon sem access_token.");
  }
  const expiresIn = Number(payload.expires_in ?? 3600);
  tokenCache.set(config.client_id, {
    token: payload.access_token,
    expiresAt: Date.now() + (expiresIn - 300) * 1000,
  });
  return payload.access_token;
}

/** Extrai ASINs de uma lista de textos (ASINs soltos, links do Amazon, amzn.to). */
export function parseAmazonAsins(input: string): string[] {
  const matches = String(input ?? "").match(/\b(b0[a-z0-9]{8}|[a-z0-9]{10})\b/gi) ?? [];
  return [...new Set(matches.map((match) => match.toUpperCase()))];
}

/** Converte valores de preço flexíveis (displayAmount, amount) em número. */
function amountToNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;
  try {
    if (cleaned.includes(",") && cleaned.includes(".")) {
      const lastDot = cleaned.lastIndexOf(".");
      const lastComma = cleaned.lastIndexOf(",");
      return lastDot > lastComma
        ? Number(cleaned.replace(/,/g, ""))
        : Number(cleaned.replace(/\./g, "").replace(",", "."));
    }
    if (cleaned.includes(",")) return Number(cleaned.replace(/\./g, "").replace(",", "."));
    return Number(cleaned);
  } catch {
    return null;
  }
}

function pick<T>(container: unknown, key: string): T | undefined {
  if (container && typeof container === "object") {
    const object = container as Record<string, unknown>;
    return object[key] as T | undefined;
  }
  return undefined;
}

/**
 * Consulta os detalhes de um lote de ASINs no catálogo. Suporta as formas
 * `offersV2` (atual) e `offers` (legado) de preços.
 */
export async function fetchAmazonItems(
  config: AmazonCreatorsConfig,
  asins: string[],
): Promise<AmazonItem[]> {
  const token = await fetchAccessToken(config);
  const items: AmazonItem[] = [];
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "x-marketplace": config.marketplace,
  };
  const resources = [
    "itemInfo.title",
    "images.primary.small",
    "images.primary.medium",
    "images.primary.large",
    "offersV2.listings.price",
    "offersV2.listings.savings",
    "offersV2.listings.listPrice",
    "parentASIN",
  ];

  for (let i = 0; i < asins.length; i += MAX_ASINS_PER_REQUEST) {
    const chunk = asins.slice(i, i + MAX_ASINS_PER_REQUEST);
    const response = await fetch(CREATORS_API_GET_ITEMS, {
      method: "POST",
      headers,
      body: JSON.stringify({
        itemIds: chunk,
        itemIdType: "ASIN",
        marketplace: config.marketplace,
        partnerTag: config.partner_tag,
        resources,
      }),
    });
    if (!response.ok) {
      throw new Error(`Creators API getItems falhou (HTTP ${response.status}).`);
    }
    const payload = (await response.json()) as {
      itemsResult?: { items?: Array<Record<string, unknown>> };
      errors?: Array<{ message?: string }>;
    };
    if (payload.errors?.length) {
      throw new Error(payload.errors[0]?.message ?? "Erro da Creators API.");
    }
    for (const raw of payload.itemsResult?.items ?? []) {
      const asin = pick<string>(raw, "asin");
      if (!asin) continue;
      const itemInfo = pick<{ title?: { displayValue?: string } }>(raw, "itemInfo");
      const title = itemInfo?.title?.displayValue ?? "";
      if (!title) continue;
      const images = pick<{
        primary?: { large?: { url?: string }; medium?: { url?: string }; small?: { url?: string } };
      }>(raw, "images");
      const primary = images?.primary;
      const image = primary?.large?.url ?? primary?.medium?.url ?? primary?.small?.url ?? null;

      const listings = Array.from(asArray(pick<unknown>(raw, "offersV2"), "listings")).concat(
        asArray(pick<unknown>(raw, "offers"), "listings"),
      );

      let salePrice: number | null = null;
      let currency = "BRL";
      for (const listing of listings) {
        const price = pick<{ amount?: unknown; displayAmount?: string; currency?: string }>(
          listing,
          "price",
        );
        const amount = amountToNumber(price?.amount ?? price?.displayAmount);
        if (amount === null) continue;
        currency = price?.currency || currency;
        if (salePrice === null || amount < salePrice) salePrice = amount;
      }
      const firstListing = listings[0] as
        { listPrice?: { amount?: unknown; displayAmount?: string } } | undefined;
      const originalPrice = firstListing?.listPrice
        ? amountToNumber(firstListing.listPrice.amount ?? firstListing.listPrice.displayAmount)
        : null;
      const detailPage = String(pick<unknown>(raw, "detailPageURL") ?? "");
      const url =
        detailPage ||
        `https://${config.marketplace}/dp/${asin}?tag=${encodeURIComponent(config.partner_tag)}`;

      items.push({
        asin,
        title,
        url,
        image,
        sale_price: salePrice,
        original_price: originalPrice,
        currency,
      });
    }
  }
  return items;
}

function asArray(container: unknown, key: string): unknown[] {
  const value = pick<unknown[]>(container, key);
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

export interface AmazonCaptureInput {
  identifier: string;
  sourceId: string;
  userId: string;
}

/**
 * Núcleo da captura: lê a conta de afiliado Amazon do usuário, consulta o
 * catálogo e grava as ofertas (com marketplace + imagem). Reutilizável com
 * cliente do usuário (RPC) ou admin (job agendado).
 */
export async function captureAmazonOffers(
  db: Db,
  input: AmazonCaptureInput,
): Promise<AmazonCaptureReport> {
  const report: AmazonCaptureReport = {
    offersCaptured: 0,
    offersIgnored: 0,
    offersFailed: 0,
    errors: [],
  };
  const asins = parseAmazonAsins(input.identifier);
  if (asins.length === 0) {
    report.errors.push(
      "Fonte Amazon sem ASINs: informe códigos (ex.: B0BZTW3TCH) ou links de produto.",
    );
    return report;
  }

  const { data: marketplaces } = await db.from("marketplaces").select("id, slug");
  const amazonMarketplace =
    (marketplaces ?? []).find(
      (item: { slug?: string }) => (item.slug ?? "").toLowerCase() === "amazon",
    ) ?? null;
  if (!amazonMarketplace) {
    report.errors.push('Marketplace "Amazon" não cadastrado na tabela de marketplaces.');
    return report;
  }

  const { data: accounts } = await db
    .from("affiliate_accounts")
    .select("*")
    .eq("user_id", input.userId)
    .eq("marketplace_id", amazonMarketplace.id);
  const account =
    (accounts ?? []).find((item: { status?: string }) => item.status === "connected") ??
    (accounts ?? [])[0];
  const configuration: Record<string, unknown> =
    account && typeof account.configuration === "object" ? account.configuration : {};
  const client_id = str(configuration, "client_id");
  const client_secret = str(configuration, "client_secret");
  const partner_tag = str(configuration, "partner_tag") || str(configuration, "tag");
  if (!client_id || !client_secret || !partner_tag) {
    report.errors.push(
      "Integração Amazon não configurada: conecte na página de Integrações (criators client_id, client_secret e partner tag).",
    );
    return report;
  }
  const config: AmazonCreatorsConfig = {
    client_id,
    client_secret,
    partner_tag,
    marketplace: str(configuration, "marketplace") || DEFAULT_MARKETPLACE,
  };

  const { data: existing } = await db
    .from("offers")
    .select("id, title, original_url")
    .eq("source_id", input.sourceId);
  const knownKeys = new Set<string>();
  for (const row of existing ?? []) {
    if (row.original_url) knownKeys.add(`${input.sourceId}::${row.original_url}`);
    if (row.title) knownKeys.add(`${input.sourceId}::${String(row.title).toLowerCase()}`);
  }

  let items: AmazonItem[];
  try {
    items = await fetchAmazonItems(config, asins);
  } catch (error) {
    report.errors.push(
      error instanceof Error ? error.message : "Falha ao consultar a Creators API.",
    );
    return report;
  }
  if (items.length === 0) {
    report.errors.push("Nenhum produto retornado pela Creators API para os ASINs informados.");
  }

  for (const item of items) {
    const urlKey = knownKeys.has(`${input.sourceId}::${item.url}`);
    const titleKey = knownKeys.has(`${input.sourceId}::${item.title.toLowerCase()}`);
    if (urlKey || titleKey) {
      report.offersIgnored++;
      continue;
    }
    knownKeys.add(`${input.sourceId}::${item.url}`);
    knownKeys.add(`${input.sourceId}::${item.title.toLowerCase()}`);

    const now = new Date().toISOString();
    const { data: offer, error } = await db
      .from("offers")
      .insert({
        user_id: input.userId,
        source_id: input.sourceId,
        title: item.title.slice(0, 200),
        original_url: item.url,
        affiliate_url: item.url,
        sale_price: item.sale_price,
        original_price:
          item.original_price !== null && item.original_price > (item.sale_price ?? 0)
            ? item.original_price
            : null,
        discount_percentage: computeDiscount(item.sale_price, item.original_price),
        currency: item.currency || "BRL",
        marketplace_id: amazonMarketplace.id,
        status: "captured",
        captured_at: now,
      })
      .select("id")
      .single();
    if (error || !offer) {
      report.offersFailed++;
      report.errors.push(
        `Falha ao salvar "${item.title.slice(0, 60)}": ${error?.message ?? "erro"}`,
      );
      continue;
    }
    if (item.image) {
      await db.from("offer_media").insert({
        offer_id: offer.id,
        url: item.image,
        type: "image",
        position: 0,
      });
    }
    report.offersCaptured++;
  }
  return report;
}

function computeDiscount(salePrice: number | null, originalPrice: number | null): number | null {
  if (salePrice === null || originalPrice === null || originalPrice <= 0) return null;
  const discount = Math.round((1 - salePrice / originalPrice) * 100);
  return discount > 0 && discount <= 100 ? discount : null;
}

function str(configuration: Record<string, unknown>, key: string): string {
  const value = configuration[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/**
 * Captura via RPC (executada pelo navegador) com o cliente autenticado do
 * usuário, contornando CORS do Amazon e mantendo as credenciais no servidor.
 */
export const captureAmazonSourceRpc = createServerFn({ method: "POST" })
  .validator((payload: AmazonCaptureInput) => payload)
  .handler(async ({ data }): Promise<AmazonCaptureReport> => {
    const url = process.env["SUPABASE_URL"] ?? import.meta.env["VITE_SUPABASE_URL"];
    const publishableKey =
      process.env["SUPABASE_PUBLISHABLE_KEY"] ?? import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !publishableKey) {
      return {
        offersCaptured: 0,
        offersIgnored: 0,
        offersFailed: 0,
        errors: ["Servidor sem configuração do Supabase."],
      };
    }
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return captureAmazonOffers(client, data);
  });
