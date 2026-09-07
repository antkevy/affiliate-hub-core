import { createHmac } from "node:crypto";

/**
 * Integração oficial AliExpress Affiliate API (gateway api-sg.aliexpress.com/sync).
 *
 * Protocolo (idêntico ao SDK oficial `ae_sdk`):
 * - Endpoint `https://api-sg.aliexpress.com/sync` para APIs de afiliado (migradas).
 * - Assinatura: HMAC-SHA256(secret, concat ordenado key+value de todos os params),
 *   hex em caixa alta — `sign_method = "sha256"`, `timestamp = Date.now()`.
 * - Todos os parâmetros (incluindo `sign`) vão na query string; método = POST.
 */

interface AliExpressCredentials {
  app_key: string;
  app_secret: string;
  tracking_id?: string | null;
}

const GATEWAY = "https://api-sg.aliexpress.com/sync";

/** tracking_id usado quando a conta ainda não tem um cadastrado no Portals. */
export const ALIEXPRESS_DEFAULT_TRACKING_ID = "default";

type ParamMap = Record<string, string | number | boolean>;

function signParams(params: ParamMap, secret: string): string {
  const basestring = Object.entries(params)
    .filter(([, value]) => value != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}${String(value)}`)
    .join("");
  return createHmac("sha256", secret).update(basestring).digest("hex").toUpperCase();
}

function assembleQuery(params: ParamMap): string {
  return Object.entries(params)
    .filter(([, value]) => value != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, value], index) =>
        `${index === 0 ? "?" : "&"}${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("");
}

async function topCall(
  method: string,
  apiParams: ParamMap,
  credentials: { app_key: string; app_secret: string },
): Promise<unknown> {
  const params: ParamMap = {
    ...apiParams,
    method,
    app_key: credentials.app_key,
    simplify: true,
    sign_method: "sha256",
    timestamp: Date.now(),
  };
  params["sign"] = signParams(params, credentials.app_secret);

  const response = await fetch(GATEWAY + assembleQuery(params), { method: "POST" });
  if (!response.ok) {
    throw new Error(`AliExpress API respondeu HTTP ${response.status}`);
  }
  return (await response.json()) as unknown;
}

function apiError(json: Record<string, unknown>): Error | null {
  const error = json?.["error_response"] as
    { msg?: string; code?: string; sub_msg?: string } | undefined;
  if (error) {
    return new Error(error.sub_msg || error.msg || "AliExpress recusou a chamada.");
  }
  return null;
}

/** Converte uma URL de produto AliExpress em link promocional de afiliado. */
export async function generateAliExpressAffiliateLink(
  originalUrl: string,
  credentials: AliExpressCredentials,
): Promise<string> {
  const trackingId = credentials.tracking_id?.trim() || ALIEXPRESS_DEFAULT_TRACKING_ID;

  const json = (await topCall(
    "aliexpress.affiliate.link.generate",
    {
      promotion_link_type: 0,
      source_values: originalUrl,
      tracking_id: trackingId,
    },
    credentials,
  )) as Record<string, unknown>;

  const error = apiError(json);
  if (error) throw error;

  const resp = (
    json?.["aliexpress_affiliate_link_generate_response"] as Record<string, unknown> | undefined
  )?.["resp_result"] as Record<string, unknown> | undefined;
  if (resp?.["resp_code"] !== undefined && resp?.["resp_code"] !== 200) {
    throw new Error(String(resp?.["resp_msg"] ?? "AliExpress recusou a geração do link."));
  }

  const links = (resp?.["result"] as Record<string, unknown> | undefined)?.["promotion_links"] as
    Record<string, unknown> | Array<Record<string, unknown>> | undefined;
  const list = Array.isArray(links)
    ? links
    : Array.isArray((links as { promotion_link?: unknown } | undefined)?.["promotion_link"])
      ? (links as { promotion_link: Array<Record<string, unknown>> })["promotion_link"]
      : (links as { promotion_link?: unknown } | undefined)?.["promotion_link"]
        ? [(links as { promotion_link: Record<string, unknown> })["promotion_link"]]
        : [];

  for (const entry of list) {
    const link =
      typeof entry === "string" ? entry : (entry as { promotion_link?: unknown })["promotion_link"];
    if (typeof link === "string" && link) return link.replace(/\\\//g, "/");
  }

  const firstMessage = (list[0] as { message?: unknown } | undefined)?.message;
  if (typeof firstMessage === "string" && firstMessage) {
    throw new Error(`AliExpress: ${firstMessage}`);
  }
  throw new Error("AliExpress não retornou link de afiliado.");
}
