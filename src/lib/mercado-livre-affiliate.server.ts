/**
 * Geração de link de afiliado do Mercado Livre via API interna, usando a tag
 * (etiqueta) do afiliado + o cookie de sessão da requisição `createLink`.
 *
 * Fluxo validado por ferramentas em produção:
 * - Endpoint primário: `affiliate-program/api/v2/stripe/user/links` (Afilimax
 *   — retorna `short_url` no padrao meli.la).
 * - Endpoint de fallback: `affiliate-program/api/v2/affiliates/createLink`
 *   (botdoafiliado / n8n — body `{ urls, tag }`).
 * - Endpoint de reserva: `afiliados/link-builder/api/links` (Link Builder).
 * - Token CSRF: valor do cookie `_csrf`, reforçado pelo token embutido no HTML
 *   da página do produto quando disponível.
 *
 * Executa no servidor (Cloudflare Workers) — usa `fetch` puro, sem navegador.
 * O chamador deve tratar falhas sem bloquear a publicação.
 *
 * Também oferece a pipeline "smart" (`generateMercadoLivreAffiliateUrlSmart`):
 * desencurta links de terceiros, extrai o produto real de páginas de canal
 * (`/social/...`), sanitiza a URL e só então gera o link da própria tag — com
 * renovação contínua da sessão via merge de cookies.
 */
import {
  cleanMercadoLivreUrl,
  extractMercadoLivreId,
  resolveMercadoLivreProduct,
} from "./mercado-livre-resolver.server";
import { normalizeText } from "./affiliate-converter";

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
const LINK_BUILDER_LINKS_ENDPOINT =
  "https://www.mercadolivre.com.br/afiliados/link-builder/api/links";

const LINK_GENERATOR_URL = "https://www.mercadolivre.com.br/afiliados/linkbuilder";
const LINK_BUILDER_URL = "https://www.mercadolivre.com.br/afiliados/link-builder";

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
 * Mescla um cabeçalho `Cookie` atual com novos `Set-Cookie` (handshake),
 * sobrescrevendo valores atualizados, mantendo a ordem e descartando cookies
 * expirados (value vazio, `Max-Age=0` ou `Expires` no passado).
 */
export function mergeCookies(
  current: string,
  newHeaders: Array<string | null | undefined>,
): string {
  interface Entry {
    name: string;
    value: string;
  }
  const entries: Entry[] = [];
  const byName = new Map<string, number>();
  const upsert = (name: string, value: string) => {
    const index = byName.get(name);
    if (index === undefined) {
      byName.set(name, entries.length);
      entries.push({ name, value });
    } else {
      entries[index]!.value = value;
    }
  };
  for (const part of current.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) upsert(name, value);
  }
  for (const header of newHeaders) {
    if (!header) continue;
    const semi = header.indexOf(";");
    const pair = semi >= 0 ? header.slice(0, semi) : header;
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const removed =
      value === "" ||
      /max-age=0/i.test(header) ||
      /expires=(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*(0?1 Jan 1970|1969|0?2 Jan 1970)/i.test(header);
    if (removed) {
      const index = byName.get(name);
      if (index !== undefined) entries[index]!.value = "";
      continue;
    }
    upsert(name, value);
  }
  return entries
    .filter((entry) => entry.value !== "")
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
}

function setCookiesOf(response: Response): string[] {
  try {
    const headers = response.headers;
    const method = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
    if (typeof method === "function") return method.call(headers);
  } catch {
    // continua no fallback abaixo
  }
  return (
    response.headers
      .get("set-cookie")
      ?.split(/,(?=\s*[a-zA-Z_][\w.-]*=)/)
      .map((part) => part.trim()) ?? []
  );
}

export interface MercadoLivreSessionHandshake {
  cookie: string;
  ok: boolean;
  status: number;
  renewed: boolean;
}

/**
 * Handshake de renovação contínua de sessão (padrão Link Builder): GET na
 * página do Link Builder com o cookie atual, merge de todos os `Set-Cookie`
 * recebidos e persistência da string mesclada. `ok=false` indica sessão
 * invalidada (o chamador deve marcar a sessão como expirada).
 */
export async function renewMercadoLivreSession(
  rawCookie: string,
): Promise<MercadoLivreSessionHandshake> {
  const cookie = cookiesToHeader(rawCookie ?? "");
  const base: MercadoLivreSessionHandshake = { cookie, ok: false, status: 0, renewed: false };
  if (!cookie) return base;
  try {
    const response = await withTimeout(
      fetch(LINK_BUILDER_URL, {
        redirect: "follow",
        headers: {
          cookie,
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
      }),
      12000,
    );
    const merged = mergeCookies(cookie, setCookiesOf(response));
    const renewed = merged !== cookie && merged.length > 0;
    return {
      cookie: merged || cookie,
      ok: response.ok,
      status: response.status,
      renewed,
    };
  } catch {
    return base;
  }
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

  // Alguns endpoints rejeitam (400) quando o token `x-csrf-token` vem de um
  // `_csrf` obsoleto; o fluxo conhecido que funciona usa token vazio. Tentamos
  // o token, depois o fallback vazio (sem duplicar quando já for vazio).
  const attempts = [...new Set([csrfToken || "", ""])];

  const failures: string[] = [];
  const attempt = async (
    endpoint: string,
    label: string,
    origin: string,
    referer: string,
    body: string,
  ): Promise<string | null> => {
    for (const token of attempts) {
      try {
        return await postAndExtract(endpoint, buildHeaders(cookie, token, origin, referer), body);
      } catch (error) {
        failures.push(
          `${label}${token ? "" : "(csrf vazio)"}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return null;
  };

  const stripeAttempt = await attempt(
    STRIPE_LINKS_ENDPOINT,
    "stripe",
    "https://produto.mercadolivre.com.br",
    url,
    JSON.stringify({ url, tag }),
  );

  if (stripeAttempt) return stripeAttempt;

  const createLinkAttempt = await attempt(
    CREATE_LINK_ENDPOINT,
    "createLink",
    "https://www.mercadolivre.com.br",
    LINK_GENERATOR_URL,
    JSON.stringify({ urls: [url], tag }),
  );

  if (createLinkAttempt) return createLinkAttempt;

  const linkBuilderAttempt = await attempt(
    LINK_BUILDER_LINKS_ENDPOINT,
    "linkBuilder",
    "https://www.mercadolivre.com.br",
    LINK_BUILDER_URL,
    JSON.stringify({ url, tag }),
  );

  if (linkBuilderAttempt) return linkBuilderAttempt;

  throw new MercadoLivreError(
    `Não foi possível gerar o link de afiliado do Mercado Livre${failures.length ? ` (${failures.join(" | ")})` : ""}.`,
    "generation_failed",
  );
}

export interface MercadoLivreSmartConversion {
  original_url: string;
  canonical_url: string | null;
  mbid: string | null;
  affiliate_url: string | null;
  status: "success" | "error";
  error_log: string | null;
  response_time_ms: number;
  /** Cookie mesclado após renovação de sessão bem-sucedida (persistir se presente). */
  cookie_renewed?: string;
  /** Sessão expirada/inválida — a oferta deve entrar na fila de espera. */
  session_expired?: boolean;
}

/**
 * Pipeline "smart": resolve o link original (desencurta /social → produto),
 * sanitiza para a URL canônica limpa, gera o link de afiliado da própria tag e
 * mede tempo/erros. Nunca lança — devolve o resultado estruturado para o
 * chamador decidir.
 */
export async function generateMercadoLivreAffiliateUrlSmart(
  originalUrl: string,
  credentials: MercadoLivreCredentials,
  options: { title?: string | null } = {},
): Promise<MercadoLivreSmartConversion> {
  const started = Date.now();
  const baseResult = (partial: Partial<MercadoLivreSmartConversion> = {}) =>
    ({
      original_url: originalUrl,
      canonical_url: null,
      mbid: null,
      affiliate_url: null,
      status: "error",
      error_log: null,
      response_time_ms: Date.now() - started,
      ...partial,
    }) as MercadoLivreSmartConversion;

  if (!credentials.tag?.trim()) {
    return baseResult({ error_log: "Tag do Mercado Livre não configurada." });
  }

  const resolved = await resolveMercadoLivreProduct(originalUrl, {
    cookie: credentials.cookie,
    title: options.title ?? null,
  });

  if (!resolved.canonicalUrl || !resolved.mbid) {
    const detail =
      resolved.kind === "social"
        ? "link é página de canal sem produto identificável"
        : resolved.kind === "short"
          ? "link de afiliado externo não pôde ser desencurtado (bloqueio)"
          : "link não corresponde a um produto do Mercado Livre";
    return baseResult({ error_log: `Sem produto para converter (${detail}).` });
  }

  let affiliateUrl: string | null = null;
  let cookieRenewed: string | undefined;
  try {
    affiliateUrl = await generateMercadoLivreAffiliateUrl(resolved.canonicalUrl, credentials);
  } catch (error) {
    const firstError = error instanceof Error ? error.message : "Falha na geração do link";
    const handshake = await renewMercadoLivreSession(credentials.cookie ?? "");
    if (handshake.renewed && handshake.cookie !== credentials.cookie) {
      try {
        affiliateUrl = await generateMercadoLivreAffiliateUrl(resolved.canonicalUrl, {
          ...credentials,
          cookie: handshake.cookie,
        });
        if (affiliateUrl) cookieRenewed = handshake.cookie;
      } catch {
        // mantém o erro original
      }
    }
    if (!affiliateUrl) {
      // Sessão expirada/inválida (401/402) ou respostas "sem link" — estas
      // últimas typically são cookie inválido em todos os endpoints, então
      // também entram na fila de espera.
      const expired =
        /HTTP 40[12]/.test(firstError) ||
        /resposta sem link de afiliado/i.test(firstError) ||
        (!handshake.ok && /401|402|expired/i.test(firstError));
      return baseResult({
        canonical_url: resolved.canonicalUrl,
        mbid: resolved.mbid,
        error_log: firstError,
        session_expired: expired,
      });
    }
  }

  return baseResult({
    canonical_url: resolved.canonicalUrl,
    mbid: resolved.mbid,
    affiliate_url: affiliateUrl,
    status: "success",
    ...(cookieRenewed ? { cookie_renewed: cookieRenewed } : {}),
  });
}

/** Formato "tag simples" (sem cookie) para o Mercado Livre — fallback de último caso. */
export function tagOnlyMercadoLivreAffiliateUrl(originalUrl: string, tag: string): string | null {
  const canonical = cleanMercadoLivreUrl(originalUrl) ?? originalUrl;
  try {
    const url = new URL(canonical.startsWith("http") ? canonical : `https://${canonical}`);
    const isProduct =
      /(^|\/)(p\/)?MLB[-]?\d/i.test(url.pathname) || !!extractMercadoLivreId(url.href);
    if (!isProduct) return null;
    const params = new URLSearchParams(url.search);
    for (const key of [...params.keys()]) {
      if (/^(utm_|matt_|tag|source|ref|reftrack|srsltid|pdp_filters)/i.test(key))
        params.delete(key);
    }
    params.set("tag", tag);
    params.sort();
    url.search = params.toString();
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** Normaliza texto para comparação de título/slug (mesma regra do fila de legibilidade). */
export function titleSimilarity(title: string, slug: string): number {
  const a = normalizeText(title);
  const b = normalizeText(slug).replace(/^MLB-\d+/, "");
  if (!a || !b) return 0;
  const aTokens = new Set(a.split(/\s+/).filter((t) => t.length > 2));
  const bTokens = new Set(b.split(/\s+/).filter((t) => t.length > 2));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let hits = 0;
  for (const token of aTokens) if (bTokens.has(token)) hits++;
  return hits / Math.min(aTokens.size, bTokens.size);
}
