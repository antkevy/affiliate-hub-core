import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";

/**
 * Integração com a Open API de Afiliados da Shopee (GraphQL).
 *
 * Fluxos:
 *   1. Captura (`captureShopeeSourceRpc`): consulta `productOfferV2` usando o
 *      identificador da fonte como palavra-chave e grava as ofertas
 *      (com marketplace + imagem) em `offers` + `offer_media`.
 *   2. Link curto (`convertShopeeLinkRpc`): gera um `shortLink` oficial via
 *      mutation `generateShortLink` usando o `app_id`/`app_secret` da conta
 *      conectada.
 *   3. Validação (`validateShopeeCredsRpc`): testa as credenciais antes de
 *      guardar na integração.
 *
 * Assinatura: header `SHA256 Credential={AppId}, Timestamp={Timestamp},
 * Signature={hex sha256(AppId + Timestamp + Payload + Secret)}` — payload é a
 * string JSON exata do corpo, timestamp em segundos.
 * Tudo roda NO SERVIDOR: o app_secret nunca sai do backend.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const SHOPEE_GRAPHQL_ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

const PRODUCT_OFFER_QUERY = /* GraphQL */ `
  query ProductOffer($keyword: String, $page: Int!, $limit: Int!) {
    productOfferV2(listType: 1, sortType: 5, keyword: $keyword, page: $page, limit: $limit) {
      nodes {
        itemId
        productName
        productLink
        offerLink
        imageUrl
        price
        priceMin
        priceMax
        priceDiscountRate
        sales
        ratingStar
        commissionRate
        commission
        shopId
        shopName
        periodStartTime
        periodEndTime
      }
      pageInfo {
        page
        limit
        hasNextPage
      }
    }
  }
`;

const SHORT_LINK_ARG_QUERY = /* GraphQL */ `
  mutation GenShopeeLink($url: String!, $subIds: [String]) {
    generateShortLink(originUrl: $url, subIds: $subIds) {
      shortLink
    }
  }
`;

const SHORT_LINK_INPUT_QUERY = /* GraphQL */ `
  mutation GenShopeeLink($input: GenerateShortLinkInput!) {
    generateShortLink(input: $input) {
      shortLink
    }
  }
`;

export interface ShopeeCredentials {
  app_id: string;
  app_secret: string;
}

export class ShopeeApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ShopeeApiError";
    this.code = code;
  }
}

/** Mapeia código de erro (ex.: "error [10020]") para mensagem amigável. */
function shopeeErrorMessage(code: string, fallback: string): string {
  const known: Record<string, string> = {
    "10020": "Credenciais inválidas: verifique o App ID e o App Secret na Open API da Shopee.",
    "10030": "Limite de requisições da Shopee atingido. Tente novamente em instantes.",
    "10035":
      "Esta conta não tem acesso à Open API de Afiliados da Shopee. Ative o acesso na plataforma.",
    "10010": "A API Shopee rejeitou a consulta (erro de parse). Tente novamente.",
    "11001": "Parâmetros inválidos para a API Shopee.",
  };
  return known[code] ?? (fallback.trim() || `Erro da API Shopee (${code}).`);
}

function parseErrorCode(message: string): string {
  const match = message.match(/\[(\d+)\]/);
  return match?.[1] ?? "0";
}

/**
 * Monta o cabeçalho de autenticação da Open API.
 * Assinatura = hex(sha256(AppId + Timestamp + Payload + Secret)).
 */
export function signShopeeRequest(
  appId: string,
  appSecret: string,
  timestamp: string,
  payload: string,
): string {
  const signature = createHash("sha256")
    .update(`${appId}${timestamp}${payload}${appSecret}`, "utf8")
    .digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

interface ShopeeGraphqlBody {
  data?: {
    productOfferV2?: {
      nodes?: unknown[];
      pageInfo?: { page?: number; limit?: number; hasNextPage?: boolean };
    };
    generateShortLink?: { shortLink?: string } | null;
  };
  errors?: Array<{ message?: string; extensions?: { code?: string | number } }>;
}

/** Executa uma chamada GraphQL assinada contra a Open API da Shopee. */
export async function shopeeGraphql(
  appId: string,
  appSecret: string,
  payload: Record<string, unknown>,
): Promise<ShopeeGraphqlBody> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const authorization = signShopeeRequest(appId, appSecret, timestamp, body);

  let response: Response;
  try {
    response = await fetch(SHOPEE_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authorization,
      },
      body,
    });
  } catch {
    throw new ShopeeApiError(
      "NETWORK",
      "Não foi possível acessar a API da Shopee. Verifique a conexão.",
    );
  }

  if (response.status === 429) {
    throw new ShopeeApiError("10030", shopeeErrorMessage("10030", ""));
  }
  if (!response.ok) {
    throw new ShopeeApiError(
      String(response.status),
      `A API da Shopee respondeu HTTP ${response.status}.`,
    );
  }

  let json: ShopeeGraphqlBody;
  try {
    json = (await response.json()) as ShopeeGraphqlBody;
  } catch {
    throw new ShopeeApiError("PARSE", "Resposta inválida da API da Shopee.");
  }

  if (Array.isArray(json.errors) && json.errors.length > 0) {
    const first = json.errors[0];
    const message = first?.message ?? "";
    const code = String(first?.extensions?.code ?? "") || parseErrorCode(message) || "0";
    throw new ShopeeApiError(code, shopeeErrorMessage(code, message));
  }
  return json;
}

/** Testa as credenciais com uma consulta mínima; lança ShopeeApiError se inválidas. */
export async function assertShopeeCredentials(appId: string, appSecret: string): Promise<void> {
  await shopeeGraphql(appId, appSecret, {
    query:
      "query { productOfferV2(listType: 1, sortType: 5, page: 1, limit: 1) { nodes { itemId } } }",
  });
}

export interface ShopeeCredentialTest {
  ok: boolean;
  error?: string;
}

/** Validação amigável (não lança): retorna { ok } com mensagem em caso de falha. */
export async function testShopeeCredentials(
  appId: string,
  appSecret: string,
): Promise<ShopeeCredentialTest> {
  try {
    await assertShopeeCredentials(appId, appSecret);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao validar." };
  }
}

/**
 * Gera o link curto oficial. Usa a forma `generateShortLink(originUrl, subIds)`
 * e, se a API rejeitar o formato, tenta a forma `generateShortLink(input: {...})`.
 */
export async function generateShopeeShortLink(
  appId: string,
  appSecret: string,
  originUrl: string,
  subId?: string | null,
): Promise<string> {
  const subIds = subId ? [subId] : [];

  const attempt = async (payload: Record<string, unknown>): Promise<string> => {
    const json = await shopeeGraphql(appId, appSecret, payload);
    const shortLink = json.data?.generateShortLink?.shortLink;
    if (!shortLink) {
      throw new ShopeeApiError(
        "EMPTY_LINK",
        "A Shopee não retornou um link curto para este produto.",
      );
    }
    return shortLink;
  };

  try {
    return await attempt({
      query: SHORT_LINK_ARG_QUERY,
      variables: { url: originUrl, subIds },
    });
  } catch (error) {
    if (error instanceof ShopeeApiError && error.code === "10010") {
      return attempt({
        query: SHORT_LINK_INPUT_QUERY,
        variables: { input: { originUrl, subIds } },
      });
    }
    throw error;
  }
}

export interface ShopeeProduct {
  itemId: number | null;
  title: string;
  url: string;
  image: string | null;
  sale_price: number | null;
  original_price: number | null;
  discount_percentage: number | null;
  shopName: string | null;
}

function firstOf(node: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = node[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}

function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const cleaned = value.replace(/[R$\s.\u00a0]/g, "").replace(",", ".");
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function percentFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return normalizePercent(value);
  if (typeof value === "string" && value.trim() !== "") {
    const numeric = Number(value.replace(",", "."));
    if (Number.isFinite(numeric)) return normalizePercent(numeric);
  }
  return null;
}

function normalizePercent(value: number): number {
  const pct = value > 0 && value <= 1 ? Math.round(value * 100) : Math.round(value);
  return Math.min(100, Math.max(0, pct));
}

function computeDiscount(sale: number | null, original: number | null): number | null {
  if (sale === null || original === null || original <= 0) return null;
  const discount = Math.round((1 - sale / original) * 100);
  return discount > 0 && discount <= 100 ? discount : null;
}

function stringOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Converte o nó do GraphQL em um produto normalizado (defensivo). */
export function parseShopeeProduct(node: unknown): ShopeeProduct | null {
  if (!node || typeof node !== "object") return null;
  const raw = node as Record<string, unknown>;

  const title = stringOf(firstOf(raw, "productName", "product_name", "name"));
  if (!title) return null;
  const url = stringOf(firstOf(raw, "productLink", "product_url", "url"));
  const itemId = numberFrom(firstOf(raw, "itemId", "item_id"));

  const salePrice = numberFrom(firstOf(raw, "price", "priceMin", "price_min"));
  const discount = percentFrom(firstOf(raw, "priceDiscountRate", "discount_rate"));
  let originalPrice: number | null = null;
  if (salePrice !== null && discount !== null && discount > 0 && discount < 100) {
    originalPrice = Math.round(salePrice / (1 - discount / 100));
  }
  if (originalPrice !== null && originalPrice <= (salePrice ?? 0)) originalPrice = null;

  return {
    itemId,
    title,
    url,
    image: stringOf(firstOf(raw, "imageUrl", "image_url", "image")) || null,
    sale_price: salePrice,
    original_price: originalPrice,
    discount_percentage:
      discount ?? computeDiscount(salePrice, numberFrom(firstOf(raw, "priceMax", "price"))),
    shopName: stringOf(firstOf(raw, "shopName", "shop_name")) || null,
  };
}

export function parseShopeeProducts(nodes: unknown[]): ShopeeProduct[] {
  return nodes
    .map(parseShopeeProduct)
    .filter((product): product is ShopeeProduct => product !== null && product.title !== "");
}

/** Consulta `productOfferV2` por palavra-chave e devolve produtos normalizados. */
export async function queryShopeeProductOffers(
  appId: string,
  appSecret: string,
  keyword: string,
  page = 1,
  limit = 50,
): Promise<ShopeeProduct[]> {
  const json = await shopeeGraphql(appId, appSecret, {
    query: PRODUCT_OFFER_QUERY,
    variables: { keyword: keyword.trim() || null, page, limit },
  });
  return parseShopeeProducts(json.data?.productOfferV2?.nodes ?? []);
}

export interface ShopeeCaptureInput {
  identifier: string;
  sourceId: string;
  userId: string;
}

export interface ShopeeCaptureReport {
  offersCaptured: number;
  offersIgnored: number;
  offersFailed: number;
  errors: string[];
}

function str(configuration: Record<string, unknown>, key: string): string {
  const value = configuration[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/**
 * Núcleo da captura: lê a conta Shopee do usuário, consulta a Open API usando
 * o identificador da fonte como palavra-chave e grava ofertas + imagem.
 * Reutilizável com cliente do usuário (RPC) ou admin (job agendado).
 */
export async function captureShopeeOffers(
  db: Db,
  input: ShopeeCaptureInput,
): Promise<ShopeeCaptureReport> {
  const report: ShopeeCaptureReport = {
    offersCaptured: 0,
    offersIgnored: 0,
    offersFailed: 0,
    errors: [],
  };
  const keyword = input.identifier.trim();
  if (!keyword) {
    report.errors.push(
      'Fonte Shopee sem termo de busca: informe palavras-chave no identificador (ex.: "fone bluetooth").',
    );
    return report;
  }

  const { data: marketplaces } = await db.from("marketplaces").select("id, slug");
  const shopeeMarketplace =
    (marketplaces ?? []).find(
      (item: { slug?: string }) => (item.slug ?? "").toLowerCase() === "shopee",
    ) ?? null;
  if (!shopeeMarketplace) {
    report.errors.push('Marketplace "Shopee" não cadastrado na tabela de marketplaces.');
    return report;
  }

  const { data: accounts } = await db
    .from("affiliate_accounts")
    .select("*")
    .eq("user_id", input.userId)
    .eq("marketplace_id", shopeeMarketplace.id);
  const account =
    (accounts ?? []).find((item: { status?: string }) => item.status === "connected") ??
    (accounts ?? [])[0];
  const configuration: Record<string, unknown> =
    account && typeof account.configuration === "object" ? account.configuration : {};
  const appId = str(configuration, "app_id");
  const appSecret = str(configuration, "app_secret");
  if (!appId || !appSecret) {
    report.errors.push(
      "Integração Shopee não configurada: conecte o App ID e o App Secret na página de Integrações.",
    );
    return report;
  }

  let products: ShopeeProduct[];
  try {
    products = await queryShopeeProductOffers(appId, appSecret, keyword, 1, 50);
  } catch (error) {
    report.errors.push(
      error instanceof Error ? error.message : "Falha ao consultar a API da Shopee.",
    );
    return report;
  }
  if (products.length === 0) {
    report.errors.push(`Nenhum produto encontrado na Shopee para "${keyword}".`);
    return report;
  }

  const { data: existing } = await db
    .from("offers")
    .select("id, title, original_url")
    .eq("source_id", input.sourceId);
  const knownKeys = new Set<string>();
  for (const row of existing ?? []) {
    if (row.original_url) knownKeys.add(`${input.sourceId}::${row.original_url}`);
    if (row.title) knownKeys.add(`${input.sourceId}::${String(row.title).toLowerCase()}`);
  }

  const now = new Date().toISOString();
  for (const product of products) {
    const urlKey = knownKeys.has(`${input.sourceId}::${product.url}`);
    const titleKey = knownKeys.has(`${input.sourceId}::${product.title.toLowerCase()}`);
    if (urlKey || titleKey) {
      report.offersIgnored++;
      continue;
    }
    knownKeys.add(`${input.sourceId}::${product.url}`);
    knownKeys.add(`${input.sourceId}::${product.title.toLowerCase()}`);

    const { data: offer, error } = await db
      .from("offers")
      .insert({
        user_id: input.userId,
        source_id: input.sourceId,
        title: product.title.slice(0, 200),
        original_url: product.url,
        affiliate_url: product.url,
        sale_price: product.sale_price,
        original_price:
          product.original_price !== null && product.original_price > (product.sale_price ?? 0)
            ? product.original_price
            : null,
        discount_percentage: product.discount_percentage,
        currency: "BRL",
        marketplace_id: shopeeMarketplace.id,
        status: "captured",
        captured_at: now,
      })
      .select("id")
      .single();
    if (error || !offer) {
      report.offersFailed++;
      report.errors.push(
        `Falha ao salvar "${product.title.slice(0, 60)}": ${error?.message ?? "erro"}`,
      );
      continue;
    }
    if (product.image) {
      await db.from("offer_media").insert({
        offer_id: offer.id,
        url: product.image,
        type: "image",
        position: 0,
      });
    }
    report.offersCaptured++;
  }
  return report;
}

/** Lê a conta Shopee conectada e devolve as credenciais (senão lança com mensagem). */
async function resolveShopeeCredentials(db: Db, userId: string): Promise<ShopeeCredentials> {
  const { data: marketplaces } = await db.from("marketplaces").select("id, slug");
  const shopeeMarketplace =
    (marketplaces ?? []).find(
      (item: { slug?: string }) => (item.slug ?? "").toLowerCase() === "shopee",
    ) ?? null;
  if (!shopeeMarketplace) {
    throw new Error('Marketplace "Shopee" não cadastrado na tabela de marketplaces.');
  }
  const { data: accounts } = await db
    .from("affiliate_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("marketplace_id", shopeeMarketplace.id);
  const account =
    (accounts ?? []).find((item: { status?: string }) => item.status === "connected") ??
    (accounts ?? [])[0];
  const configuration: Record<string, unknown> =
    account && typeof account.configuration === "object" ? account.configuration : {};
  const appId = str(configuration, "app_id");
  const appSecret = str(configuration, "app_secret");
  if (!appId || !appSecret) {
    throw new Error("Integração Shopee não configurada: conecte App ID e App Secret.");
  }
  return { app_id: appId, app_secret: appSecret };
}

function supabaseEnvValues(): { url: string; publishableKey: string } | null {
  const url = process.env["SUPABASE_URL"] ?? import.meta.env["VITE_SUPABASE_URL"];
  const publishableKey =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  return url && publishableKey ? { url, publishableKey } : null;
}

/** Captura via RPC (executada pelo navegador) com o cliente autenticado do usuário. */
export const captureShopeeSourceRpc = createServerFn({ method: "POST" })
  .validator((payload: ShopeeCaptureInput & { token: string }) => payload)
  .handler(async ({ data }): Promise<ShopeeCaptureReport> => {
    const env = supabaseEnvValues();
    if (!env) {
      return {
        offersCaptured: 0,
        offersIgnored: 0,
        offersFailed: 0,
        errors: ["Servidor sem configuração do Supabase."],
      };
    }
    if (!data.token) {
      return {
        offersCaptured: 0,
        offersIgnored: 0,
        offersFailed: 0,
        errors: ["Sessão expirada. Entre novamente."],
      };
    }
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient<Database>(env.url, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${data.token}` } },
    });
    return captureShopeeOffers(client, {
      identifier: data.identifier,
      sourceId: data.sourceId,
      userId: data.userId,
    });
  });

export interface ConvertShopeeLinkInput {
  token: string;
  userId: string;
  url: string;
  subId?: string | null;
}

export interface ConvertShopeeLinkResult {
  ok: boolean;
  url?: string;
  error?: string;
  reason?: "no_account" | "api";
}

/** Gera o shortLink oficial da Shopee usando a conta conectada. */
export const convertShopeeLinkRpc = createServerFn({ method: "POST" })
  .validator((payload: ConvertShopeeLinkInput) => payload)
  .handler(async ({ data }): Promise<ConvertShopeeLinkResult> => {
    const env = supabaseEnvValues();
    if (!env) {
      return { ok: false, reason: "api", error: "Servidor sem configuração do Supabase." };
    }
    if (!data.token) {
      return { ok: false, reason: "no_account", error: "Sessão expirada. Entre novamente." };
    }
    if (!data.url.trim()) {
      return { ok: false, reason: "no_account", error: "URL vazia." };
    }
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient<Database>(env.url, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${data.token}` } },
    });
    try {
      const credentials = await resolveShopeeCredentials(client, data.userId);
      const shortLink = await generateShopeeShortLink(
        credentials.app_id,
        credentials.app_secret,
        data.url.trim(),
        data.subId,
      );
      return { ok: true, url: shortLink };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao gerar o link Shopee.";
      if (/conecte|configurada|Marketplace/.test(message)) {
        return { ok: false, reason: "no_account", error: message };
      }
      return { ok: false, reason: "api", error: message };
    }
  });

export interface ValidateShopeeCredsInput {
  token: string;
  appId: string;
  appSecret: string;
}

/** Valida as credenciais informadas na página de Integrações antes de salvar. */
export const validateShopeeCredsRpc = createServerFn({ method: "POST" })
  .validator((payload: ValidateShopeeCredsInput) => payload)
  .handler(async ({ data }): Promise<ShopeeCredentialTest> => {
    if (!data.token) return { ok: false, error: "Sessão expirada. Entre novamente." };
    if (!data.appId.trim() || !data.appSecret.trim()) {
      return { ok: false, error: "Informe o App ID e o App Secret da Shopee." };
    }
    return testShopeeCredentials(data.appId.trim(), data.appSecret.trim());
  });
