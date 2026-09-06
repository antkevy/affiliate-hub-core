import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";
import { sha256 } from "./engine/hash";
import {
  detectMarketplace,
  extractCoupon,
  extractDiscount,
  extractOriginalPrice,
  extractPrice,
  extractTelegramUsername,
  extractTitle,
  extractUrls,
  fetchProductImage,
  fetchTmePublicPreview,
  parseTmePosts,
  pickProductUrl,
  shouldCaptureProduct,
  stripTags,
  type TelegramOfferCandidate,
} from "./telegram";

const MAX_CAPTURES_PER_SOURCE = 20;

interface TelegramCaptureResult {
  sourcesChecked: number;
  offersCaptured: number;
  offersIgnored: number;
  offersFailed: number;
  errors: string[];
}

interface CapturePayload {
  token: string;
  identifier: string;
  sourceId: string;
  userId: string;
}

/**
 * Captura ofertas de um canal público do Telegram (preview https://t.me/s/<user>).
 * Roda no servidor para contornar o bloqueio de CORS do t.me e das lojas.
 * Deduplica por post (processed_messages) e grava offers + offer_media.
 */
export const captureTelegramSource = createServerFn({ method: "POST" })
  .validator((payload: CapturePayload) => payload)
  .handler(async ({ data }): Promise<TelegramCaptureResult> => {
    const url = process.env["SUPABASE_URL"] ?? import.meta.env["VITE_SUPABASE_URL"];
    const publishableKey =
      process.env["SUPABASE_PUBLISHABLE_KEY"] ?? import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    const report: TelegramCaptureResult = {
      sourcesChecked: 0,
      offersCaptured: 0,
      offersIgnored: 0,
      offersFailed: 0,
      errors: [],
    };
    if (!url || !publishableKey) {
      report.errors.push("Servidor sem configuração do Supabase.");
      return report;
    }
    if (!data.token) {
      report.errors.push("Sessão expirada. Entre novamente.");
      return report;
    }

    const client = createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${data.token}` } },
    });

    return captureTelegramChannel(client, data);
  });

// Cliente Supabase sem tipagem estática — as colunas foram conferidas contra o
// schema gerado em src/integrations/supabase/types.ts. Mesmo padrão de base.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Núcleo da captura, reutilizável com cliente de usuário (RPC) ou admin (job agendado). */
export async function captureTelegramChannel(
  client: Db,
  payload: { identifier: string; sourceId: string; userId: string },
): Promise<TelegramCaptureResult> {
  const report: TelegramCaptureResult = {
    sourcesChecked: 0,
    offersCaptured: 0,
    offersIgnored: 0,
    offersFailed: 0,
    errors: [],
  };
  try {
    const username = extractTelegramUsername(payload.identifier);
    if (!username) {
      report.errors.push("Identificador do canal inválido (use @usuario).");
      return report;
    }
    report.sourcesChecked++;

    const marketplaceIdBySlug = await loadMarketplaceIds(client);

    const html = await fetchTmePublicPreview(username);
    if (!html) {
      report.errors.push(`${username}: não foi possível acessar a prévia do canal.`);
      return report;
    }

    const posts = parseTmePosts(html);
    let processed = 0;
    for (const post of posts.slice(0, MAX_CAPTURES_PER_SOURCE)) {
      const result = await captureTelegramPost(
        client,
        payload,
        username,
        post,
        marketplaceIdBySlug,
      );
      if (result.outcome === "captured") report.offersCaptured++;
      else if (result.outcome === "ignored") report.offersIgnored++;
      else if (result.outcome === "failed") report.offersFailed++;
      processed++;
    }
    if (processed === 0) {
      report.errors.push(`${username}: nenhum post encontrado na prévia.`);
    }
  } catch (error) {
    report.errors.push(
      `${payload.identifier}: ${error instanceof Error ? error.message : "erro inesperado"}`,
    );
  }

  return report;
}

type CaptureOutcome = "captured" | "ignored" | "failed";

export interface TelegramPostCaptureResult {
  outcome: CaptureOutcome;
  offer: Record<string, unknown> | null;
}

/** Mapa marketplace slug → id (usado por captura por varredura e por webhook). */
export async function loadMarketplaceIds(client: Db): Promise<Map<string, string>> {
  const { data: marketplaces } = await client
    .from("marketplaces")
    .select("id, slug")
    .eq("is_active", true);
  const map = new Map<string, string>();
  for (const marketplace of marketplaces ?? []) {
    if (marketplace.slug) map.set(marketplace.slug.toLowerCase(), marketplace.id);
  }
  return map;
}

/**
 * Processa UM post (da prévia t.me ou de update de webhook) gerando oferta no
 * banco com dedup por post/hash. Reutilizado pela varredura agendada e pelo
 * webhook do Telegram (acionado só quando surge oferta nova).
 */
export async function captureTelegramPost(
  client: Db,
  payload: { identifier: string; sourceId: string; userId: string },
  username: string,
  post: { id: string; textHtml: string; time: string | null; image: string | null },
  marketplaceIdBySlug: Map<string, string>,
): Promise<TelegramPostCaptureResult> {
  const text = stripTags(post.textHtml);
  const urls = extractUrls(post.textHtml);
  const originalUrl = pickProductUrl(urls);

  if (!originalUrl) {
    return { outcome: "ignored", offer: null };
  }
  if (!shouldCaptureProduct(text)) {
    return { outcome: "ignored", offer: null };
  }

  const salePrice = extractPrice(text);
  if (salePrice === null) {
    return { outcome: "ignored", offer: null };
  }

  if (await isAlreadyProcessed(client, payload, username, post.id, originalUrl, text)) {
    return { outcome: "ignored", offer: null };
  }

  const discount = extractDiscount(text);
  const coupon = extractCoupon(text);
  const originalPrice = discount ? extractOriginalPrice(text, salePrice) : null;
  const image = post.image ?? (await fetchProductImage(originalUrl));
  const marketplaceSlug = detectMarketplace(originalUrl, text);
  const marketplaceId = marketplaceSlug ? (marketplaceIdBySlug.get(marketplaceSlug) ?? null) : null;
  const capturedAt = post.time ? new Date(post.time).toISOString() : new Date().toISOString();

  const candidate: TelegramOfferCandidate = {
    title: extractTitle(text),
    original_url: originalUrl,
    sale_price: salePrice,
    original_price: originalPrice ?? salePrice,
    discount_percentage: discount,
    coupon,
    image,
    time: post.time,
  };

  const { data: offer, error } = await client
    .from("offers")
    .insert({
      user_id: payload.userId,
      source_id: payload.sourceId,
      title: candidate.title,
      original_url: candidate.original_url,
      sale_price: candidate.sale_price,
      original_price: candidate.original_price,
      discount_percentage: candidate.discount_percentage,
      coupon: candidate.coupon,
      currency: "BRL",
      status: "captured",
      marketplace_id: marketplaceId,
      captured_at: capturedAt,
    })
    .select("*")
    .single();

  if (error || !offer) {
    return { outcome: "failed", offer: null };
  }

  if (candidate.image) {
    await client.from("offer_media").insert({
      offer_id: offer.id,
      url: candidate.image,
      type: "image",
      position: 0,
    });
  }

  await client.from("processed_messages").insert({
    user_id: payload.userId,
    source_id: payload.sourceId,
    external_message_id: post.id,
    content_hash: await contentHash(payload, username, post.id, originalUrl, text),
    processed_at: capturedAt,
  });

  return { outcome: "captured", offer };
}

async function isAlreadyProcessed(
  client: Db,
  payload: { identifier: string; sourceId: string; userId: string },
  username: string,
  postId: string,
  url: string,
  text: string,
): Promise<boolean> {
  const hash = await contentHash(payload, username, postId, url, text);
  const { data } = await client
    .from("processed_messages")
    .select("id")
    .eq("user_id", payload.userId)
    .eq("source_id", payload.sourceId)
    .eq("content_hash", hash)
    .maybeSingle();
  return Boolean(data);
}

function contentHash(
  payload: { identifier: string; sourceId: string; userId: string },
  username: string,
  postId: string,
  url: string,
  text: string,
): Promise<string> {
  const canonical = `${username}::${postId}::${url}::${text.trim().toLowerCase().replace(/\s+/g, " ")}`;
  return sha256(canonical);
}
