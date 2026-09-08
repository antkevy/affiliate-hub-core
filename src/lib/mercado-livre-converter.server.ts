/**
 * Conversor de links do Mercado Livre — server functions.
 *
 * Rotina completa de "melhor aproveitamento" de ofertas capturadas de grupos
 * externos: desencurta links de terceiros, extrai o produto real de páginas de
 * canal (`/social/...`), sanitiza a URL, gera o link de afiliado da própria tag
 * e renova a sessão continuamente (merge de cookies, padrão Link Builder).
 *
 * Persiste: `meli_sessions` (status/renovação) e `converted_offers` (histórico).
 */
import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";
import {
  generateMercadoLivreAffiliateUrlSmart,
  renewMercadoLivreSession,
  tagOnlyMercadoLivreAffiliateUrl,
  type MercadoLivreCredentials,
} from "@/lib/mercado-livre-affiliate.server";
import { extractUrlsFromText, isMercadoLivreLink } from "@/lib/mercado-livre-resolver.server";

interface SessionRecord {
  id?: string;
  user_id?: string;
  cookies?: string | null;
  status?: string | null;
  last_validated_at?: string | null;
  last_error?: string | null;
  alert_email?: string | null;
}

interface AccountRecord {
  id: string;
  configuration?: unknown;
}

// Cliente Supabase sem tipagem estática para as tabelas novas (meli_sessions,
// converted_offers) — mesmo padrão de base.ts/telegram.server.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

function buildClient(token: string) {
  const url = process.env["SUPABASE_URL"] ?? import.meta.env["VITE_SUPABASE_URL"];
  const publishableKey =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishableKey) throw new Error("Servidor sem configuração do Supabase.");
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function authedContext(token: string): Promise<{ db: Db; userId: string }> {
  const db = buildClient(token);
  const { data } = await db.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) throw new Error("Sessão expirada. Entre novamente.");
  return { db, userId };
}

async function findMercadoLivreAccount(db: Db, userId: string): Promise<AccountRecord | null> {
  const { data: marketplaces } = await db.from("marketplaces").select("id").eq("is_active", true);
  const marketplace = (marketplaces ?? []).find(
    (item: { slug?: string }) => (item.slug ?? "").toLowerCase() === "mercado-livre",
  );
  if (!marketplace) return null;
  const { data: accounts } = await db
    .from("affiliate_accounts")
    .select("id, configuration")
    .eq("user_id", userId)
    .eq("marketplace_id", marketplace.id);
  const active =
    (accounts ?? []).find((item: { status?: string }) => item.status === "connected") ??
    (accounts ?? [])[0];
  return active ?? null;
}

function accountCredentials(account: AccountRecord | null): MercadoLivreCredentials {
  const configuration =
    account?.configuration && typeof account.configuration === "object"
      ? (account.configuration as Record<string, unknown>)
      : {};
  const tag =
    (typeof configuration["tag"] === "string" && configuration["tag"].trim()
      ? configuration["tag"].trim()
      : "") ||
    (typeof configuration["client_id"] === "string" && configuration["client_id"].trim()
      ? configuration["client_id"].trim()
      : "") ||
    "fastpromo";
  const cookie =
    (typeof configuration["cookie"] === "string" && configuration["cookie"].trim()
      ? configuration["cookie"].trim()
      : "") ||
    (typeof configuration["session_cookie"] === "string"
      ? configuration["session_cookie"].trim()
      : "");
  return { tag, cookie };
}

async function readSession(db: Db, userId: string): Promise<SessionRecord | null> {
  const { data } = await db
    .from("meli_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (data && data.length > 0) return data[0] as SessionRecord;
  return null;
}

async function writeSession(db: Db, userId: string, patch: Partial<SessionRecord>): Promise<void> {
  const existing = await readSession(db, userId);
  const values: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (existing?.id) {
    await db.from("meli_sessions").update(values).eq("id", existing.id);
  } else {
    await db.from("meli_sessions").insert({ user_id: userId, ...values });
  }
}

/** Mantém o cookie da sessão sincronizado com a conta conectada (Integrações). */
async function mirrorCookieToAccount(db: Db, userId: string, cookie: string): Promise<void> {
  const account = await findMercadoLivreAccount(db, userId);
  if (!account) return;
  const configuration =
    account.configuration && typeof account.configuration === "object"
      ? { ...(account.configuration as Record<string, unknown>) }
      : {};
  if (typeof configuration["cookie"] === "string" && configuration["cookie"] === cookie) return;
  configuration["cookie"] = cookie;
  await db
    .from("affiliate_accounts")
    .update({ configuration, status: "connected" })
    .eq("id", account.id);
}

export interface ConvertedLinkResult {
  original: string;
  canonical: string | null;
  affiliate: string | null;
  status: "success" | "error";
  error_log: string | null;
  response_time_ms: number;
}

export interface ConvertedMessageResult {
  mode: "message" | "single";
  source_text: string;
  processed_text: string;
  links: ConvertedLinkResult[];
  response_time_ms: number;
  session_status: string | null;
  db_tables_missing: boolean;
  /** Mensagem entrou na fila de espera por cookie expirado. */
  queued: boolean;
}

export const convertMercadoLivreMessage = createServerFn({ method: "POST" })
  .validator((payload: { token: string; text: string; single?: boolean }) => payload)
  .handler(async ({ data }): Promise<ConvertedMessageResult> => {
    const started = Date.now();
    const fallback = (
      sessionStatus: string | null,
      dbTablesMissing: boolean,
    ): ConvertedMessageResult => ({
      mode: data.single ? "single" : "message",
      source_text: data.text,
      processed_text: data.text,
      links: [],
      response_time_ms: Date.now() - started,
      session_status: sessionStatus,
      db_tables_missing: dbTablesMissing,
      queued: false,
    });

    let db: Db;
    let userId: string;
    try {
      ({ db, userId } = await authedContext(data.token));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Sessão inválida.");
    }

    const text = data.text?.trim() ?? "";
    if (!text) throw new Error("Informe a mensagem ou a URL para converter.");

    let session: SessionRecord | null = null;
    let dbTablesMissing = false;
    try {
      session = await readSession(db, userId);
    } catch {
      dbTablesMissing = true;
    }
    const account = await findMercadoLivreAccount(db, userId);
    const credentials = accountCredentials(account);
    const sessionCookie = session?.cookies?.trim() || credentials.cookie || "";

    // Renovação contínua da sessão (merge de cookies) antes de converter.
    let sessionStatus: string | null = session?.status ?? (sessionCookie ? "active" : null);
    if (sessionCookie) {
      const handshake = await renewMercadoLivreSession(sessionCookie);
      if (!dbTablesMissing) {
        const patch: Partial<SessionRecord> = {
          cookies: handshake.cookie,
          last_validated_at: new Date().toISOString(),
        };
        if (handshake.ok) {
          patch.status = "active";
          patch.last_error = null;
          sessionStatus = "active";
        } else {
          patch.status = "expired";
          patch.last_error = `Handshake falhou (HTTP ${handshake.status || 0}).`;
          sessionStatus = "expired";
        }
        try {
          await writeSession(db, userId, patch);
          if (handshake.ok && handshake.cookie)
            await mirrorCookieToAccount(db, userId, handshake.cookie);
        } catch {
          dbTablesMissing = true;
        }
      }
    }

    const urls = [...new Set(extractUrlsFromText(text).filter((url) => isMercadoLivreLink(url)))];
    if (urls.length === 0) {
      return { ...fallback(sessionStatus, dbTablesMissing), session_status: sessionStatus };
    }

    const outcome = await convertOne(db, userId, text, data.single ?? false, credentials);
    const links = outcome.links;
    const allFailedBySession =
      links.length > 0 && links.every((l) => l.status === "error") && outcome.queued;
    const queued =
      allFailedBySession && !dbTablesMissing
        ? (await enqueueMercadoLivreOffer(db, {
            user_id: userId,
            mode: data.single ? "single" : "message",
            source_text: text,
            source_links: urls,
            last_error:
              session?.status === "expired"
                ? (session.last_error ?? "Sessão expirada.")
                : "Sessão do Mercado Livre expirada durante a conversão.",
          })) !== null
        : false;

    if (!dbTablesMissing) {
      try {
        await db.from("converted_offers").insert({
          user_id: userId,
          mode: data.single ? "single" : "message",
          source_text: text,
          processed_text: outcome.processed_text,
          links,
          response_time_ms: Date.now() - started,
        });
      } catch {
        dbTablesMissing = true;
      }
    }

    return {
      mode: data.single ? "single" : "message",
      source_text: text,
      processed_text: outcome.processed_text,
      links,
      response_time_ms: Date.now() - started,
      session_status: sessionStatus,
      db_tables_missing: dbTablesMissing,
      queued,
    };
  });

function replaceUrlLiteral(text: string, original: string, replacement: string): string {
  const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "g"), replacement);
}

export interface SessionStatusResult {
  tag: string;
  has_cookies: boolean;
  status: string | null;
  last_validated_at: string | null;
  last_error: string | null;
  alert_email: string | null;
  db_tables_missing: boolean;
}

export const getMercadoLivreSessionStatus = createServerFn({ method: "POST" })
  .validator((payload: { token: string }) => payload)
  .handler(async ({ data }): Promise<SessionStatusResult> => {
    const { db, userId } = await authedContext(data.token);
    let session: SessionRecord | null = null;
    let dbTablesMissing = false;
    try {
      session = await readSession(db, userId);
    } catch {
      dbTablesMissing = true;
    }
    const account = await findMercadoLivreAccount(db, userId);
    const credentials = accountCredentials(account);
    return {
      tag: credentials.tag,
      has_cookies: Boolean(session?.cookies?.trim() || credentials.cookie?.trim()),
      status: session?.status ?? null,
      last_validated_at: session?.last_validated_at ?? null,
      last_error: session?.last_error ?? null,
      alert_email: session?.alert_email ?? null,
      db_tables_missing: dbTablesMissing,
    };
  });

export interface SaveSessionResult {
  status: string;
  last_validated_at: string | null;
  renewed: boolean;
  message: string;
  db_tables_missing: boolean;
}

export const saveMercadoLivreSession = createServerFn({ method: "POST" })
  .validator(
    (payload: { token: string; cookies?: string; alert_email?: string; test?: boolean }) => payload,
  )
  .handler(async ({ data }): Promise<SaveSessionResult> => {
    const { db, userId } = await authedContext(data.token);
    const cookies = data.cookies?.trim() ?? "";
    if (!cookies) throw new Error("Cole a string de cookies da sessão do Mercado Livre.");

    let dbTablesMissing = false;
    const base: SaveSessionResult = {
      status: "active",
      last_validated_at: null,
      renewed: false,
      message: "",
      db_tables_missing: false,
    };
    try {
      await writeSession(db, userId, {
        cookies,
        alert_email: data.alert_email?.trim() || null,
        status: "active",
        last_error: null,
        last_validated_at: new Date().toISOString(),
      });
    } catch {
      dbTablesMissing = true;
      base.db_tables_missing = true;
    }

    if (!data.test) {
      base.status = "active";
      base.message = "Sessão salva. Use 'Testar' para validar o cookie.";
      return base;
    }

    const handshake = await renewMercadoLivreSession(cookies);
    base.last_validated_at = new Date().toISOString();
    if (handshake.ok) {
      base.status = "active";
      base.renewed = handshake.renewed;
      base.message = handshake.renewed
        ? "Sessão ativa e renovada com sucesso (cookies mesclados)."
        : "Sessão ativa.";
      if (!dbTablesMissing) {
        try {
          await writeSession(db, userId, {
            status: "active",
            last_validated_at: base.last_validated_at,
            last_error: null,
            cookies: handshake.cookie,
            alert_email: data.alert_email?.trim() || null,
          });
          await mirrorCookieToAccount(db, userId, handshake.cookie || cookies);
        } catch {
          // mantém o status informado mesmo se a persistência falhar
        }
      }
      return base;
    }
    base.status = "expired";
    base.message = `Cookie inválido ou sessão expirada (HTTP ${handshake.status || 0}). Renove o cookie no navegador e salve novamente.`;
    if (!dbTablesMissing) {
      try {
        await writeSession(db, userId, {
          status: "expired",
          last_validated_at: base.last_validated_at,
          last_error: base.message,
          alert_email: data.alert_email?.trim() || null,
        });
      } catch {
        // melhor esforço
      }
    }
    return base;
  });

export interface ConversionHistoryRow {
  id: string;
  mode: "message" | "single";
  source_text: string;
  processed_text: string;
  links: ConvertedLinkResult[];
  response_time_ms: number | null;
  created_at: string;
}

export const listMercadoLivreConversions = createServerFn({ method: "POST" })
  .validator((payload: { token: string; limit?: number }) => payload)
  .handler(async ({ data }): Promise<ConversionHistoryRow[]> => {
    const { db, userId } = await authedContext(data.token);
    const { error, data: rows } = await db
      .from("converted_offers")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 30);
    if (error) {
      if (/relation "public\.converted_offers" does not exist/.test(error.message ?? "")) {
        return [];
      }
      throw new Error(error.message);
    }
    return (rows ?? []).map((row: ConversionHistoryRow) => ({
      id: row.id,
      mode: row.mode,
      source_text: row.source_text,
      processed_text: row.processed_text,
      links: Array.isArray(row.links) ? row.links : [],
      response_time_ms: row.response_time_ms ?? null,
      created_at: row.created_at,
    }));
  });

export interface QueueRow {
  id: string;
  mode: "message" | "single";
  source_text: string;
  source_links: string[];
  status: string;
  last_error: string | null;
  created_at: string;
}

/** Converte uma única mensagem (reuso na fila de espera). Nunca lança. */
async function convertOne(
  db: Db,
  userId: string,
  text: string,
  single: boolean,
  credentials: MercadoLivreCredentials,
): Promise<ConvertedMessageResult> {
  const started = Date.now();
  const session = await readSafeSession(db, userId);
  const sessionCookie = session?.cookies?.trim() || credentials.cookie || "";
  const tag = credentials.tag || "";

  let normalizedText = text.trim();
  if (single && !normalizedText.includes("://")) {
    if (/^(meli\.la|meli\.link|mercadolivre\.com|mercadolibre\.com)\//i.test(normalizedText)) {
      normalizedText = `https://${normalizedText}`;
    }
  }

  let urls = [...new Set(extractUrlsFromText(normalizedText).filter((url) => isMercadoLivreLink(url)))];
  if (urls.length === 0) {
    const rawMatches = normalizedText.match(/\b(?:meli\.la|meli\.link|mercadolivre\.com|mercadolibre\.com)\/[^\s<>"]+/gi);
    if (rawMatches) {
      urls = [...new Set(rawMatches.map((u) => u.startsWith("http") ? u : `https://${u}`).filter((url) => isMercadoLivreLink(url)))];
    }
  }

  if (urls.length === 0) {
    return {
      mode: single ? "single" : "message",
      source_text: text,
      processed_text: text,
      links: [],
      response_time_ms: Date.now() - started,
      session_status: session?.status ?? (sessionCookie ? "active" : null),
      db_tables_missing: false,
      queued: false,
    };
  }

  const links: ConvertedLinkResult[] = [];
  let processedText = text;
  let queued = false;
  let activeCookie = sessionCookie;
  for (const url of urls) {
    const conversion = await generateMercadoLivreAffiliateUrlSmart(
      url,
      { tag, cookie: activeCookie },
      { title: text },
    );
    if (conversion.cookie_renewed && activeCookie !== conversion.cookie_renewed) {
      activeCookie = conversion.cookie_renewed;
    }
    const effectiveAffiliate =
      conversion.affiliate_url && conversion.affiliate_url.includes("meli.la")
        ? conversion.affiliate_url
        : null;
    const record: ConvertedLinkResult = {
      original: url,
      canonical: conversion.canonical_url,
      affiliate: effectiveAffiliate,
      status: effectiveAffiliate ? "success" : "error",
      error_log: effectiveAffiliate
        ? null
        : (conversion.error_log ?? "Requer sessão de afiliado ativa para gerar link meli.la."),
      response_time_ms: conversion.response_time_ms,
    };
    links.push(record);
    if (effectiveAffiliate) {
      processedText = replaceUrlLiteral(processedText, url, effectiveAffiliate);
    } else if (conversion.canonical_url) {
      processedText = replaceUrlLiteral(processedText, url, conversion.canonical_url);
    }
    if (conversion.session_expired) queued = true;
  }

  return {
    mode: single ? "single" : "message",
    source_text: text,
    processed_text: processedText,
    links,
    response_time_ms: Date.now() - started,
    session_status: session?.status ?? (sessionCookie ? "active" : null),
    db_tables_missing: false,
    queued,
  };
}

async function readSafeSession(db: Db, userId: string): Promise<SessionRecord | null> {
  try {
    return await readSession(db, userId);
  } catch {
    return null;
  }
}

/** Insere uma mensagem na fila de espera; devolve o id (ou null em falha). */
async function enqueueMercadoLivreOffer(
  db: Db,
  row: {
    user_id: string;
    mode: "message" | "single";
    source_text: string;
    source_links: string[];
    last_error?: string | null;
  },
): Promise<string | null> {
  try {
    const { data, error } = await db.from("meli_queue").insert({
      user_id: row.user_id,
      mode: row.mode,
      source_text: row.source_text,
      source_links: row.source_links,
      status: "waiting",
      last_error: row.last_error ?? null,
    });
    return error ? null : (data?.[0]?.id ?? null);
  } catch {
    return null;
  }
}

export const listMercadoLivreQueue = createServerFn({ method: "POST" })
  .validator((payload: { token: string; limit?: number }) => payload)
  .handler(async ({ data }): Promise<QueueRow[]> => {
    const { db, userId } = await authedContext(data.token);
    const { error, data: rows } = await db
      .from("meli_queue")
      .select("id, mode, source_text, source_links, status, last_error, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) {
      if (/relation "public\.meli_queue" does not exist/.test(error.message ?? "")) return [];
      throw new Error(error.message);
    }
    return (rows ?? []).map((row: QueueRow) => ({
      id: row.id,
      mode: row.mode,
      source_text: row.source_text,
      source_links: Array.isArray(row.source_links) ? row.source_links : [],
      status: row.status,
      last_error: row.last_error ?? null,
      created_at: row.created_at,
    }));
  });

export interface ReprocessQueueResult {
  processed: number;
  succeeded: number;
  stillWaiting: number;
  failed: number;
  db_tables_missing: boolean;
}

/**
 * Reprocessa todas as mensagens da fila de espera reutilizando o método da
 * conversão manual. Marca cada item como done (com o resultado) ou failed.
 */
export const reprocessMercadoLivreQueue = createServerFn({ method: "POST" })
  .validator((payload: { token: string }) => payload)
  .handler(async ({ data }): Promise<ReprocessQueueResult> => {
    const { db, userId } = await authedContext(data.token);
    const credentials = accountCredentials(await findMercadoLivreAccount(db, userId));

    const { error, data: rows } = await db
      .from("meli_queue")
      .select("id, mode, source_text")
      .eq("user_id", userId)
      .eq("status", "waiting")
      .order("created_at", { ascending: true });
    if (error) {
      if (/relation "public\.meli_queue" does not exist/.test(error.message ?? "")) {
        return { processed: 0, succeeded: 0, stillWaiting: 0, failed: 0, db_tables_missing: true };
      }
      throw new Error(error.message);
    }

    let processed = 0;
    let succeeded = 0;
    let stillWaiting = 0;
    let failed = 0;

    for (const row of rows ?? []) {
      await db.from("meli_queue").update({ status: "processing" }).eq("id", row.id);
      const outcome = await convertOne(
        db,
        userId,
        row.source_text,
        row.mode === "single",
        credentials,
      );
      processed++;

      const allOk = outcome.links.length > 0 && outcome.links.every((l) => l.status === "success");
      if (allOk || (outcome.links.some((l) => l.status === "success") && !outcome.queued)) {
        succeeded++;
        await db
          .from("meli_queue")
          .update({
            status: "done",
            result_links: outcome.links,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      } else if (outcome.queued) {
        // Cookie ainda expirado: mantém na fila aguardando.
        stillWaiting++;
        await db
          .from("meli_queue")
          .update({
            status: "waiting",
            last_error: "Sessão ainda expirada. Cole um cookie válido.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      } else {
        failed++;
        await db
          .from("meli_queue")
          .update({
            status: "failed",
            last_error: outcome.links[0]?.error_log ?? "Sem produto convertível.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      }
    }

    return { processed, succeeded, stillWaiting, failed, db_tables_missing: false };
  });
