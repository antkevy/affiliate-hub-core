/**
 * Resolução e sanitização de URLs do Mercado Livre (server-side).
 *
 * Fluxo: desencurta links de terceiros (meli.la, meli.link, mercadolivre.com/sec,
 * bit.ly, etc.) → classifica o destino em página de produto ou página de canal
 * (`/social/...`) → quando é canal, extrai o(s) produto(s) reais da página →
 * devolve a URL canônica 100% limpa (`produto.mercadolivre.com.br/MLB-<id>-<slug>`),
 * sem nenhum parâmetro de rastreio do concorrente.
 *
 * Roda no servidor (fetch puro, sem navegador) — evita CORS e mantém o cookie
 * de sessão fora do cliente.
 */

export interface MercadoLivreResolved {
  /** Classificação do destino depois da cadeia de redirecionamentos. */
  kind: "product" | "social" | "short" | "unknown";
  /** Última URL da cadeia (página de produto ou do canal). */
  destinationUrl: string;
  /** URL canônica do produto limpa, pronta para o gerador. Null quando não achar. */
  canonicalUrl: string | null;
  /** Identificador canônico do produto (ex.: "MLB19794940"). */
  mbid: string | null;
}

export interface ResolveOptions {
  cookie?: string | null;
  /** Título da oferta capturada — usado para escolher o produto certo na página do canal. */
  title?: string | null;
}

export const MERCADO_LIVRE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const ACCEPT_HTML = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

/** Parâmetros de rastreio/instrumentação que nunca podem ir para o gerador. */
const TRACKING_PARAMS = new Set([
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
  "reftrack",
  "ref",
  "aff_source",
  "source",
  "affiliation_type",
  "forceInApp",
  "affiliate",
  "track",
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
]);

function safeParse(rawUrl: string): URL | null {
  const value = rawUrl.trim();
  if (!value) return null;
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Extrai o identificador canônico do Mercado Livre de qualquer texto/URL.
 * Aceita MLB-1234567890, /p/MLB1234567890, produto.mercadolivre.com.br/MLB-...,
 * item.mercadolivre.com.br/MLB-... e foo-MLB1234567890 (com/sem hífen).
 */
export function extractMercadoLivreId(input: string): string | null {
  const match = input.match(/\bMLB[-]?(\d{6,12})\b/i);
  return match ? `MLB${match[1]}` : null;
}

/**
 * Converte qualquer URL de produto do Mercado Livre na forma canônica limpa
 * `https://produto.mercadolivre.com.br/MLB-<id>-<slug>`. Remove todos os
 * parâmetros de rastreio. Retorna null quando não há produto identificável.
 */
export function cleanMercadoLivreUrl(rawUrl: string): string | null {
  const parsed = safeParse(rawUrl);
  if (!parsed) return null;
  const id = extractMercadoLivreId(parsed.href);
  if (!id) return null;
  const slugMatch = parsed.pathname.match(/MLB-\d+-([a-z0-9][a-z0-9-]*)/i);
  const idPart = id;
  let slug = "";
  if (slugMatch?.[1]) {
    slug = slugMatch[1]
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/(^-+|-+$)/g, "");
  }
  if (slug) {
    return `https://produto.mercadolivre.com.br/${idPart}-${slug}`;
  }
  return `https://www.mercadolivre.com.br/p/${idPart}`;
}

/** Indica se a URL já é uma página de produto reconhecível (sem precisar da rede). */
function looksLikeProductUrl(rawUrl: string): boolean {
  const parsed = safeParse(rawUrl);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  if (!host.includes("mercadolivre") && !host.includes("mercadolibre")) return false;
  return (
    /\/p\/MLB[-]?\d|(^|\/)MLB[-]?\d|item-?MLB[-]?\d/i.test(parsed.pathname) ||
    parsed.pathname.includes("/social/")
  );
}

function isMercadoLivreHost(rawUrl: string): boolean {
  const host = safeParse(rawUrl)?.hostname.toLowerCase() ?? "";
  return host.includes("mercadolivre") || host.includes("mercadolibre") || host.includes("meli.");
}

/**
 * Segue a cadeia de redirecionamentos com headers de navegador desktop.
 * Sem cookie a sessão pode ficar parcial — a função devolve a melhor URL
 * obtida (a própria URL original em caso de bloqueio/erro).
 */
export async function followMercadoLivreRedirects(
  rawUrl: string,
  options: ResolveOptions = {},
): Promise<{ status: number; finalUrl: string }> {
  const headers: Record<string, string> = {
    "user-agent": MERCADO_LIVRE_UA,
    accept: ACCEPT_HTML,
    "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
  };
  if (options.cookie?.trim()) headers["cookie"] = options.cookie.trim();
  try {
    const response = await withTimeout(fetch(rawUrl, { redirect: "follow", headers }), 15000);
    return { status: response.status, finalUrl: response.url || rawUrl };
  } catch {
    return { status: 0, finalUrl: rawUrl };
  }
}

/** Extrai links de produto (canônicos) do HTML/JSON de uma página do Mercado Livre. */
export function findProductsInHtml(html: string): Array<{ mbid: string; url: string }> {
  const found = new Map<string, string>();
  const seen = new Set<string>();
  const pattern =
    /(?:https?:)?(?:\/\/(?:www\.|produto\.|articulo\.|item\.|m\.)?mercadolivre(?:\.com\.br|\.com|\.com\.mx))?(\/(?:p\/|[\w-]+\/)?MLB[-]?\d{6,12}[-a-z0-9]*)/gi;
  for (const match of html.matchAll(pattern)) {
    const candidate = match[0];
    const raw = candidate.startsWith("/")
      ? `https://www.mercadolivre.com.br${candidate}`
      : candidate;
    const clean = cleanMercadoLivreUrl(raw);
    if (!clean) continue;
    const mbid = extractMercadoLivreId(clean);
    if (!mbid) continue;
    if (!seen.has(clean)) seen.add(clean);
    if (!found.has(mbid)) found.set(mbid, clean);
  }

  if (found.size === 0) {
    const mlbMatches = html.matchAll(/\b(MLB[-]?\d{6,12})\b/gi);
    for (const match of mlbMatches) {
      const rawId = match[1];
      if (!rawId) continue;
      const mbid = extractMercadoLivreId(rawId);
      if (mbid && !found.has(mbid)) {
        const clean = `https://produto.mercadolivre.com.br/${mbid}`;
        found.set(mbid, clean);
      }
    }
  }

  return [...found.entries()].map(([mbid, url]) => ({ mbid, url }));
}

function normalizeTokens(value: string): Set<string> {
  return new Set(
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
}

/**
 * Escolhe o produto mais provável da página do canal comparando tokens do slug
 * com o título da oferta capturada. Sem título, usa o primeiro produto.
 */
function pickProductByTitle(
  products: Array<{ mbid: string; url: string }>,
  title: string | null | undefined,
): { mbid: string; url: string } | null {
  if (products.length === 0) return null;
  if (!title?.trim()) return products[0] ?? null;
  const titleTokens = normalizeTokens(title);
  if (titleTokens.size === 0) return products[0] ?? null;

  let best: { mbid: string; url: string } | null = null;
  let bestScore = 0;
  for (const product of products) {
    const slug = product.url.split("/").pop() ?? "";
    const tokens = normalizeTokens(slug.replace(/^MLB-\d+/, ""));
    const matches = [...titleTokens].filter((t) => tokens.has(t)).length;
    const score = tokens.size > 0 ? matches / Math.max(titleTokens.size, 1) : 0;
    if (score > bestScore) {
      bestScore = score;
      best = product;
    }
  }
  if (bestScore <= 0) return products[0] ?? null;
  return best;
}

/**
 * Pipeline completo de resolução:
 * 1. URL já é produto? usa direto. 2. Desencurta a cadeia. 3. Página `/social/`?
 * extrai produtos. 4. Canôniza. Nunca lança — devolve classificação + melhor URL.
 */
export async function resolveMercadoLivreProduct(
  originalUrl: string,
  options: ResolveOptions = {},
): Promise<MercadoLivreResolved> {
  const url = originalUrl.trim();
  if (!url) return { kind: "unknown", destinationUrl: url, canonicalUrl: null, mbid: null };

  // Já é página de produto canônica → limpa sem rede.
  const parsed = safeParse(url);
  const host = parsed?.hostname.toLowerCase() ?? "";
  if (
    parsed &&
    (host === "produto.mercadolivre.com.br" ||
      (host.includes("mercadolivre") && /(^|\/)(p\/)?MLB[-]?\d/i.test(parsed.pathname)))
  ) {
    const canonical = cleanMercadoLivreUrl(url);
    return canonical
      ? {
          kind: "product",
          destinationUrl: url,
          canonicalUrl: canonical,
          mbid: extractMercadoLivreId(canonical),
        }
      : { kind: "short", destinationUrl: url, canonicalUrl: null, mbid: null };
  }

  // Caso a URL já venha com o identificador de produto embutido (meli.la sem
  // slug não tem; src meli.la produtivo vai depender da rede).
  const directId = extractMercadoLivreId(url);
  if (directId) {
    return {
      kind: "product",
      destinationUrl: url,
      canonicalUrl: cleanMercadoLivreUrl(url),
      mbid: directId,
    };
  }

  if (!isMercadoLivreHost(url) && !host.includes("meli.")) {
    return { kind: "unknown", destinationUrl: url, canonicalUrl: null, mbid: null };
  }

  // Busca o destino real (desencurta meli.la/sec/outros). O cookie de afiliado
  // só serve para o gerador de links — em páginas públicas (/social, /sec) ele
  // dispara bloqueio anti-bot (403). Se bloquear com cookie, tenta de novo sem.
  const { status: initialStatus, finalUrl } = await followMercadoLivreRedirects(url, options);
  let status = initialStatus;
  let destination = finalUrl || url;
  if ((status === 403 || status === 0) && options.cookie?.trim()) {
    const retry = await followMercadoLivreRedirects(url, { ...options, cookie: null });
    status = retry.status;
    destination = retry.finalUrl || url;
  }

  if (status === 403 || status === 0) {
    // Bloqueio anti-bot total: sem navegador não dá para desencurtar. Se a URL
    // já carrega um MLB, ainda convertemos; senão fica sem produto.
    return {
      kind: "short",
      destinationUrl: url,
      canonicalUrl: cleanMercadoLivreUrl(url),
      mbid: extractMercadoLivreId(url),
    };
  }

  const destinationHost = safeParse(destination)?.hostname.toLowerCase() ?? "";

  if (destinationHost.includes("/social/") || destination.includes("/social/")) {
    const pageUrl = destination;
    let products: Array<{ mbid: string; url: string }> = [];
    for (let attempt = 0; attempt < 2 && products.length === 0; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 800));
      try {
        // Página pública: SEM cookie (evita bloqueio anti-bot 403).
        const htmlResponse = await withTimeout(
          fetch(pageUrl, {
            headers: {
              "user-agent": MERCADO_LIVRE_UA,
              accept: ACCEPT_HTML,
            },
          }),
          15000,
        );
        if (htmlResponse.ok) {
          products = findProductsInHtml(await htmlResponse.text());
        }
      } catch {
        products = [];
      }
    }
    const picked = pickProductByTitle(products, options.title ?? null);
    return {
      kind: "social",
      destinationUrl: pageUrl,
      canonicalUrl: picked?.url ?? null,
      mbid: picked?.mbid ?? null,
    };
  }

  // Destino é produto comum → canôniza.
  const canonical = cleanMercadoLivreUrl(destination);
  return {
    kind: canonical ? "product" : "unknown",
    destinationUrl: destination,
    canonicalUrl: canonical,
    mbid: canonical ? extractMercadoLivreId(canonical) : null,
  };
}

/** Extrai todas as URLs candidatas de um texto (mesmo formato do Telegram). */
export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"]+/gi);
  return matches ? matches.map((u) => u.replace(/[),.;]+$/, "")) : [];
}

/** Detecta se a URL pertence a um dos formatos do Mercado Livre. */
export function isMercadoLivreLink(rawUrl: string): boolean {
  return (
    isMercadoLivreHost(rawUrl) ||
    /(meli\.la|meli\.link|mercadolivre\.com\.br|mercadolibre\.com)/i.test(rawUrl) ||
    /https?:\/\/[^\s]*meli\.la/i.test(rawUrl)
  );
}
