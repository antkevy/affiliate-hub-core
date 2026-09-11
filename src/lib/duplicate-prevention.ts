import { normalizeText } from "./affiliate-converter";

/**
 * Parâmetros de rastreamento e afiliados comuns que devem ser removidos
 * para comparar se duas URLs apontam para a mesma oferta/produto real.
 */
const TRACKING_QUERY_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "tag",
  "matt_tool",
  "matt_word",
  "matt_source",
  "matt_campaign",
  "matt_content",
  "matt_term",
  "matt_search",
  "matt_subsource",
  "matt_user",
  "dsu",
  "pdp_filters",
  "searchvariation",
  "searchingol",
  "ext",
  "nome_origem",
  "categoria_origem",
  "nro_idioma",
  "wid",
  "cid",
  "urlredirected",
  "translate",
  "srsltid",
  "ref",
  "ref_",
  "pf_rd_r",
  "pf_rd_p",
  "pd_rd_r",
  "pd_rd_w",
  "pd_rd_wg",
  "pf_rd_m",
  "pf_rd_s",
  "pf_rd_t",
  "pf_rd_i",
  "spm",
  "gclid",
  "fbclid",
  "igsh",
  "feature",
  "smid",
]);

/**
 * Remove parâmetros de rastreamento e normaliza a URL do produto
 * para permitir comparação canônica entre fontes diferentes.
 */
export function cleanProductUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl) return "";
  try {
    const fullUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    const parsed = new URL(fullUrl);

    // ConverteSearchParams e deleta params de tracking
    const params = new URLSearchParams(parsed.search);
    for (const key of Array.from(params.keys())) {
      if (
        TRACKING_QUERY_PARAMS.has(key.toLowerCase()) ||
        key.startsWith("utm_") ||
        key.startsWith("matt_")
      ) {
        params.delete(key);
      }
    }

    parsed.search = params.toString();
    parsed.hash = "";

    // Normaliza trailing slash e caixa do hostname
    let cleaned = parsed.toString().toLowerCase();
    if (cleaned.endsWith("/")) {
      cleaned = cleaned.slice(0, -1);
    }
    return cleaned;
  } catch {
    return (rawUrl || "").toLowerCase().trim();
  }
}

/**
 * Extrai o código único do produto da URL (quando aplicável).
 * Suporta Mercado Livre, Amazon, AliExpress, Shopee e Magalu.
 */
export function extractProductIdFromUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const cleaned = cleanProductUrl(rawUrl);

  // Mercado Livre: MLB-1234567890 ou MLB1234567890
  const mlbMatch = cleaned.match(/mlb-?(\d+)/i);
  if (mlbMatch?.[1]) return `MLB${mlbMatch[1]}`;

  // Amazon ASIN: /dp/B0XXXXXXXX ou /gp/product/B0XXXXXXXX
  const asinMatch = cleaned.match(/\/(?:dp|gp\/product)\/([a-z0-9]{10})/i);
  if (asinMatch?.[1]) return asinMatch[1].toUpperCase();

  // AliExpress item ID: /item/100500XXXXXXXXXX.html
  const aliMatch = cleaned.match(/\/item\/(\d+)\.html/i);
  if (aliMatch?.[1]) return aliMatch[1];

  // Magalu: /p/1234567/
  const magaluMatch = cleaned.match(/\/p\/([a-z0-9]+)/i);
  if (magaluMatch?.[1]) return magaluMatch[1];

  return null;
}

/**
 * Normaliza o título da oferta removendo emojis de formatação (ex: ➡️, 🔥, ⚡, 🛒)
 * e acentos para permitir comparação textual precisa.
 */
export function normalizeProductTitle(title: string | null | undefined): string {
  if (!title) return "";
  const withoutEmojis = title
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      " ",
    )
    .replace(/\uFE0F/g, "")
    .replace(/\s+/g, " ");

  return normalizeText(withoutEmojis);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/**
 * Verifica se uma oferta recém-capturada já foi gravada ou processada
 * no banco de dados para este usuário dentro da janela de tempo (default = 24 horas).
 */
export async function isOfferDuplicateCaptured(
  db: Db,
  userId: string,
  url: string,
  title: string,
  cooldownHours = 24,
): Promise<boolean> {
  const sinceISO = new Date(Date.now() - cooldownHours * 3600 * 1000).toISOString();
  const cleanedUrl = cleanProductUrl(url);
  const normalizedTitle = normalizeProductTitle(title);
  const productId = extractProductIdFromUrl(url);

  // 1) Busca ofertas recentes do usuário
  const { data: recentOffers, error } = await db
    .from("offers")
    .select("id, original_url, title, status, captured_at")
    .eq("user_id", userId)
    .gte("captured_at", sinceISO)
    .limit(100);

  if (error || !recentOffers) return false;

  for (const existing of recentOffers) {
    // A) Checagem por URL canônica limpa
    if (existing.original_url && cleanedUrl) {
      if (cleanProductUrl(existing.original_url) === cleanedUrl) {
        return true;
      }
    }

    // B) Checagem por ID único de produto (ASIN / MLB / etc)
    if (productId && existing.original_url) {
      const existingProductId = extractProductIdFromUrl(existing.original_url);
      if (existingProductId && existingProductId === productId) {
        return true;
      }
    }

    // C) Checagem por Título Normalizado (quando o título é idêntico e recente)
    if (existing.title && normalizedTitle) {
      const existingTitleNorm = normalizeProductTitle(existing.title);
      if (existingTitleNorm === normalizedTitle && existingTitleNorm.length > 5) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Verifica se uma publicação para o mesmo produto/URL já foi enviada
 * para um destino específico (ou para qualquer destino do usuário) nas últimas N horas.
 */
export async function isPublicationDuplicate(
  db: Db,
  userId: string,
  destinationId: string,
  offer: {
    id: string;
    original_url?: string | null;
    affiliate_url?: string | null;
    title: string;
    coupon?: string | null;
  },
  cooldownHours = 24,
): Promise<boolean> {
  const sinceISO = new Date(Date.now() - cooldownHours * 3600 * 1000).toISOString();
  const cleanedUrl = cleanProductUrl(offer.original_url || offer.affiliate_url);
  const productId = extractProductIdFromUrl(offer.original_url || offer.affiliate_url);
  const normalizedTitle = normalizeProductTitle(offer.title);

  // 1) Checa se o MESMO offer_id já foi publicado neste destino recentemente
  const { data: directPub } = await db
    .from("publications")
    .select("id")
    .eq("user_id", userId)
    .eq("destination_id", destinationId)
    .eq("offer_id", offer.id)
    .eq("status", "published")
    .gte("created_at", sinceISO)
    .limit(1)
    .maybeSingle();

  if (directPub) return true;

  // 2) Busca últimas publicações realizadas para este destino nas últimas N horas
  const { data: recentPubs } = await db
    .from("publications")
    .select("id, offer_id, content, created_at")
    .eq("user_id", userId)
    .eq("destination_id", destinationId)
    .eq("status", "published")
    .gte("created_at", sinceISO)
    .order("created_at", { ascending: false })
    .limit(150);

  if (!recentPubs || recentPubs.length === 0) return false;

  // Extrai IDs das ofertas publicadas para consultar URLs/títulos
  const publishedOfferIds = recentPubs
    .map((p: { offer_id: string | null }) => p.offer_id)
    .filter((id: string | null): id is string => Boolean(id));

  if (publishedOfferIds.length > 0) {
    const { data: publishedOffers } = await db
      .from("offers")
      .select("id, original_url, title")
      .in("id", publishedOfferIds);

    for (const pubOffer of publishedOffers ?? []) {
      // A) Mesma URL canônica
      if (cleanedUrl && pubOffer.original_url) {
        if (cleanProductUrl(pubOffer.original_url) === cleanedUrl) {
          return true;
        }
      }
      // B) Mesmo ID de Produto (ASIN / MLB / etc)
      if (productId && pubOffer.original_url) {
        const pubProductId = extractProductIdFromUrl(pubOffer.original_url);
        if (pubProductId && pubProductId === productId) {
          return true;
        }
      }
      // C) Mesmo Título Normalizado
      if (normalizedTitle && pubOffer.title) {
        if (
          normalizeProductTitle(pubOffer.title) === normalizedTitle &&
          normalizedTitle.length > 5
        ) {
          return true;
        }
      }
    }
  }

  // 3) Checagem de segurança direta no conteúdo da mensagem (ex: se o link original está no texto)
  if (cleanedUrl && cleanedUrl.length > 10) {
    for (const pub of recentPubs) {
      if (pub.content && cleanProductUrl(pub.content).includes(cleanedUrl)) {
        return true;
      }
    }
  }

  return false;
}
