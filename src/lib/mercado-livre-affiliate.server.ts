/**
 * Geração de link de afiliado do Mercado Livre via API interna, usando a tag
 * (etiqueta) do afiliado + o cookie de sessão da requisição `createLink`.
 *
 * Fluxo validado por ferramentas em produção:
 * - Endpoint primário: `affiliate-program/api/v2/stripe/user/links` (Afilimax
 *   — retorna `short_url` no padrao meli.la).
 * - Endpoint de fallback: `affiliate-program/api/v2/affiliates/createLink`
 *   (botdoafiliado / n8n — body `{ urls, tag }`).
 * - Token CSRF: valor do cookie `_csrf`, reforçado pelo token embutido no HTML
 *   da página do produto quando disponível.
 *
 * Executa no servidor (Cloudflare Workers) — usa `fetch` puro, sem navegador.
 * O chamador deve tratar falhas sem bloquear a publicação.
 */

export class MercadoLivreError extends Error {
  readonly reason: "no_credentials" | "generation_failed" | "missing_link";
  constructor(message: string, reason: MercadoLivreError["reason"]) {
    super(message);
    this.name = "MercadoLivreError";
    this.reason = reason;
  }
}

export interface MercadoLivreCredentials {
  /** Etiqueta do afiliado no programa do Mercado Livre (ex.: "fastpromo"). */
  tag: string;
  /** Valor completo do cabeçalho `Cookie` da requisição `createLink`. */
  cookie: string;
}

const STRIPE_LINKS_ENDPOINT =
  "https://www.mercadolivre.com.br/affiliate-program/api/v2/stripe/user/links";
const CREATE_LINK_ENDPOINT =
  "https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink";

const LINK_GENERATOR_URL = "https://www.mercadolivre.com.br/afiliados/linkbuilder";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CSRF_TOKEN_PATTERNS = [/csrfToken[^"]*"([^"]+)"/, /name="csrf-token"\s+content="([^"]+)"/];

function cookieValue(cookie: string, name: string): string | null {
  const match = cookie.match(new RegExp(`(?:^|;)\\s*${name}=([^;]+)`));
  return match?.[1] ?? null;
}

/**
 * Normaliza o cookie de sessão em uma string "nome=valor; nome2=valor2".
 * Aceita tanto o cabeçalho `Cookie` cru do DevTools quanto o JSON exportado
 * por extensões de navegador (`[{ "name", "value" }]`).
 */
export function cookiesToHeader(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as Array<{ name?: string; value?: string }>;
      const pairs = parsed
        .filter((c) => c && typeof c.name === "string" && typeof c.value === "string")
        .map((c) => `${c.name}=${c.value}`);
      if (pairs.length) return pairs.join("; ");
    } catch {
      // não é JSON válido — trata como string de cookies
    }
  }
  return value;
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

/** Extrai o token CSRF: valor do cookie `_csrf`, reforçado pelo HTML da página. */
async function fetchCsrfToken(cookie: string, productUrl: string): Promise<string> {
  let token = cookieValue(cookie, "_csrf")?.trim() ?? "";
  try {
    const response = await withTimeout(
      fetch(productUrl, {
        headers: { cookie, "user-agent": USER_AGENT, accept: "text/html" },
      }),
      5000,
    );
    if (response.ok) {
      const html = await response.text();
      for (const pattern of CSRF_TOKEN_PATTERNS) {
        const match = html.match(pattern);
        if (match?.[1]) {
          token = match[1];
          break;
        }
      }
    }
  } catch {
    // mantém o valor do cookie `_csrf`
  }
  return token;
}

/** Extrai de forma defensiva uma URL encurtada (meli.la) da resposta da API. */
function extractAffiliateUrl(payload: unknown): string | null {
  if (typeof payload === "string") {
    return payload.startsWith("https://meli.la/") || payload.startsWith("http://meli.la/")
      ? payload
      : null;
  }
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["short_url", "url", "affiliate_url"]) {
    const value = record[key];
    if (typeof value === "string" && /^https?:\/\/meli\.la\//.test(value)) return value;
  }
  const data = record["data"];
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === "object") {
        const found = extractAffiliateUrl(item);
        if (found) return found;
      }
    }
  }
  return null;
}

/** Monta os cabeçalhos comuns usados nos endpoints do programa de afiliados. */
function buildHeaders(
  cookie: string,
  csrfToken: string,
  origin: string,
  referer: string,
): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    "x-csrf-token": csrfToken,
    cookie,
    origin,
    referer,
    "user-agent": USER_AGENT,
  };
}

async function postAndExtract(endpoint: string, headers: Record<string, string>, body: string) {
  const response = await withTimeout(fetch(endpoint, { method: "POST", headers, body }), 10000);
  if (!response.ok) {
    throw new Error(`Mercado Livre: HTTP ${response.status} ${response.statusText}`);
  }
  const payload: unknown = await response.json();
  const link = extractAffiliateUrl(payload);
  if (!link) {
    throw new Error(`Mercado Livre: resposta sem link de afiliado (${endpoint})`);
  }
  return link;
}

/**
 * Gera o link de afiliado (short_url meli.la) para a URL de um produto do
 * Mercado Livre usando tag + cookie de sessão. Lança erro quando não for
 * possível gerar — o chamador decide o fallback (tag simples ou link original).
 */
export async function generateMercadoLivreAffiliateUrl(
  originalUrl: string,
  credentials: MercadoLivreCredentials,
): Promise<string> {
  const tag = credentials.tag?.trim();
  const cookie = cookiesToHeader(credentials.cookie ?? "");
  if (!tag || !cookie) {
    throw new MercadoLivreError("Credenciais do Mercado Livre incompletas.", "no_credentials");
  }

  const url = originalUrl.trim().endsWith("/")
    ? originalUrl.trim().slice(0, -1)
    : originalUrl.trim();
  if (!/^https?:\/\//.test(url)) throw new MercadoLivreError("URL inválida.", "generation_failed");

  const csrfToken = await fetchCsrfToken(cookie, url);

  const stripeAttempt = await postAndExtract(
    STRIPE_LINKS_ENDPOINT,
    buildHeaders(cookie, csrfToken, "https://produto.mercadolivre.com.br", url),
    JSON.stringify({ url, tag }),
  ).catch(() => null);

  if (stripeAttempt) return stripeAttempt;

  const createLinkAttempt = await postAndExtract(
    CREATE_LINK_ENDPOINT,
    buildHeaders(cookie, csrfToken, "https://www.mercadolivre.com.br", LINK_GENERATOR_URL),
    JSON.stringify({ urls: [url], tag }),
  ).catch(() => null);

  if (createLinkAttempt) return createLinkAttempt;

  throw new MercadoLivreError(
    "Não foi possível gerar o link de afiliado do Mercado Livre.",
    "generation_failed",
  );
}
