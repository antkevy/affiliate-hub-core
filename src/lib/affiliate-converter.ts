/**
 * Conversão de URL para link de afiliado no navegador.
 *
 * Padrões adaptados de ferramentas validadas em produção:
 * - Amazon: acréscimo do parâmetro `tag` (smart-affiliate `tag=celle-20`, bot-ofertas `tag=`).
 * - Shopee: limpeza de parâmetros de rastreio antigos + injeção de `uls_trackid`/`utm_*`
 *   (BlueBot — `clean_and_inject_params`).
 * - Magalu: rebuild no padrão canônico `magazinevoce.com.br/{loja}/p/{codigo}/`
 *   (fallback do smart-affiliate).
 * - Mercado Livre: tag simples (`tag=<etiqueta>`) conforme "Formato 1 - Tag Simples"
 *   do programa de afiliados; remove etiqueta/UTM antigas antes de injetar a nova.
 */

export interface AffiliateConversion {
  url: string;
  method: "original" | "amazon" | "shopee" | "magalu" | "mercadolivre";
  note?: string;
}

export interface AffiliateConversionOptions {
  /** Slug do marketplace (ex.: "amazon", "shopee", "magalu"). */
  marketplaceSlug?: string | null;
  /** ID/tag do parceiro no programa de afiliados. */
  trackingId?: string | null;
  /** Slug da loja parceira para o padrão magazinevoce (default = trackingId). */
  store?: string | null;
}

export const AFFILIATE_NOTE_NO_ID =
  "Configure seu ID/tag de afiliado no programa antes de gerar o link.";

export const AFFILIATE_NOTE_UNSUPPORTED =
  "Marketplace exige automação externa (padrão BlueBot) para converter o link.";

/** Parâmetros internos de rastreio do Mercado Livre que devem ser limpos. */
const MERCADO_LIVRE_TRACKING_PARAMS = new Set([
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
  "searchVariation",
  "searchingol",
  "ext",
  "nome_origem",
  "categoria_origem",
  "nro_idioma",
  "wid",
  "cid",
  "urlRedirected",
  "translate",
  "srsltid",
]);

/** Normaliza texto ignorando caixa e acentos (NFKD) — padrão BlueBot/smart-affiliate. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Detecta o slug do marketplace a partir do domínio da URL. */
export function detectMarketplaceUrl(rawUrl: string): string | null {
  const host = hostnameOf(rawUrl);
  if (!host) return null;
  for (const [fragment, slug] of DOMAIN_TO_SLUG) {
    if (host.includes(fragment)) return slug;
  }
  return null;
}

const DOMAIN_TO_SLUG: ReadonlyArray<readonly [string, string]> = [
  ["shopee.", "shopee"],
  ["shope.ee", "shopee"],
  ["amazon.", "amazon"],
  ["amzn.to", "amazon"],
  ["magazinevoce", "magalu"],
  ["magazineluiza", "magalu"],
  ["mercadolivre", "mercadolivre"],
  ["mercadolibre", "mercadolivre"],
  ["aliexpress", "aliexpress"],
];

/**
 * Converte a URL original no melhor link de afiliado possível.
 * Sem ID de afiliado ou sem conversão viável, devolve a URL original
 * com um método "original" e uma nota explicativa.
 */
export function createAffiliateUrl(
  originalUrl: string,
  options: AffiliateConversionOptions = {},
): AffiliateConversion {
  const slug = normalizeSlug(options.marketplaceSlug) ?? detectMarketplaceUrl(originalUrl);
  const trackingId = options.trackingId?.trim() || null;
  const url = prepareUrl(originalUrl);
  if (!url) return { url: originalUrl, method: "original" };

  switch (slug) {
    case "amazon":
      return convertAmazon(url, trackingId);
    case "shopee":
      return convertShopee(url, trackingId);
    case "magalu":
      return convertMagalu(url, options.store?.trim() || trackingId);
    case "mercadolivre":
      return convertMercadoLivre(url, trackingId);
    case "aliexpress":
      return { url: url.toString(), method: "original", note: AFFILIATE_NOTE_UNSUPPORTED };
    default:
      return { url: url.toString(), method: "original", note: "Marketplace não reconhecido." };
  }
}

function normalizeSlug(slug: string | null | undefined): string | null {
  if (!slug || !slug.trim()) return null;
  return slug.toLowerCase().replace(/[-_\s]+/g, "");
}

function convertAmazon(url: URL, trackingId: string | null): AffiliateConversion {
  if (!trackingId) return { url: url.toString(), method: "original", note: AFFILIATE_NOTE_NO_ID };
  const params = new URLSearchParams(url.search);
  params.set("tag", trackingId);
  url.search = params.toString();
  return { url: url.toString(), method: "amazon" };
}

function convertShopee(url: URL, trackingId: string | null): AffiliateConversion {
  if (!trackingId) return { url: url.toString(), method: "original", note: AFFILIATE_NOTE_NO_ID };
  const params = new URLSearchParams(url.search);
  const legacy = new Set(["track", "affiliate", "ref", "fbclid", "gclid", "gbraid", "wbraid"]);
  for (const key of [...params.keys()]) {
    if (key.startsWith("utm_") || key.startsWith("uls_") || legacy.has(key)) params.delete(key);
  }
  params.set("uls_trackid", trackingId);
  params.set("utm_source", trackingId);
  params.set("utm_medium", "affiliates");
  params.set("utm_campaign", "oferta");
  params.set("utm_content", "oferta");
  params.set("utm_term", trackingId);
  url.search = params.toString();
  return { url: url.toString(), method: "shopee" };
}

function convertMagalu(url: URL, store: string | null): AffiliateConversion {
  const effectiveStore = store?.trim();
  if (!effectiveStore)
    return { url: url.toString(), method: "original", note: AFFILIATE_NOTE_NO_ID };
  const code = productCodeFromPath(url.pathname);
  if (!code) {
    return {
      url: url.toString(),
      method: "original",
      note: "Não foi possível extrair o código do produto da URL.",
    };
  }
  return {
    url: `https://www.magazinevoce.com.br/${encodeURIComponent(effectiveStore)}/p/${code}/`,
    method: "magalu",
  };
}

/**
 * Converte um link do Mercado Livre no formato "tag simples": limpa parâmetros
 * internos de rastreio e injeta `tag=<etiqueta>` no lugar. Sem etiqueta
 * configurada, devolve a URL original com a nota de ID ausente.
 */
export function convertMercadoLivre(url: URL, trackingId: string | null): AffiliateConversion {
  if (!trackingId) return { url: url.toString(), method: "original", note: AFFILIATE_NOTE_NO_ID };
  const params = new URLSearchParams(url.search);
  for (const key of [...params.keys()]) {
    if (MERCADO_LIVRE_TRACKING_PARAMS.has(key)) params.delete(key);
  }
  params.set("tag", trackingId);
  params.sort();
  url.search = params.toString();
  url.hash = "";
  return { url: url.toString(), method: "mercadolivre" };
}

/** Extrai o código do produto do path — ex.: "/p/aa11bb22/" ou "/produto/aa11bb22/". */
function productCodeFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  for (let i = 0; i < segments.length; i++) {
    if ((segments[i] === "p" || segments[i] === "produto") && segments[i + 1]) {
      return segments[i + 1] ?? null;
    }
  }
  const last = segments[segments.length - 1];
  if (last && /\.html?$/.test(last)) return last.replace(/\.html?$/, "");
  return null;
}

function hostnameOf(rawUrl: string): string | null {
  const url = prepareUrl(rawUrl);
  return url ? url.hostname.toLowerCase() : null;
}

function prepareUrl(rawUrl: string): URL | null {
  const value = rawUrl.trim();
  if (!value) return null;
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }
}

/** Encurtador best-effort (TinyURL). Retorna a URL original se a rede/CORS falhar. */
export async function shortenUrl(url: string): Promise<string> {
  try {
    const response = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
    );
    if (!response.ok) return url;
    const short = (await response.text()).trim();
    return short ? short : url;
  } catch {
    return url;
  }
}
