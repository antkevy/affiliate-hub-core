import { extractTelegramUsername } from "./telegram";
import { loadMarketplaceIds, captureTelegramPost } from "./telegram.server";
import { publishOfferForSource } from "./scheduled.server";
import type { Offer } from "@/types";

// Cliente Supabase sem tipagem estática — mesmo padrão de telegram.server.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const TELEGRAM_WEBHOOK_PATH = "/api/telegram/webhook";

interface TelegramIncomingMessage {
  message_id?: number;
  date?: number;
  text?: string;
  caption?: string;
  chat?: { id?: number };
  photo?: Array<{ file_id?: string }>;
}

export interface TelegramWebhookPost {
  externalId: string;
  text: string;
  time: string | null;
  photoFileId: string | null;
}

/** Extrai o post de um update do webhook do Telegram (message ou channel_post). */
export function buildTelegramPost(update: unknown): TelegramWebhookPost | null {
  const payload = update as {
    message?: TelegramIncomingMessage;
    channel_post?: TelegramIncomingMessage;
  };
  const message = payload?.message ?? payload?.channel_post;
  if (!message || !message.chat) return null;

  const text = message.text ?? message.caption ?? "";
  const photo =
    Array.isArray(message.photo) && message.photo.length > 0
      ? (message.photo[message.photo.length - 1]?.file_id ?? null)
      : null;

  return {
    externalId: String(message.message_id ?? ""),
    text,
    time: typeof message.date === "number" ? new Date(message.date * 1000).toISOString() : null,
    photoFileId: photo,
  };
}

async function secretsEqual(a: string, b: string): Promise<boolean> {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
}

async function resolvePhotoUrl(
  botToken: string | null | undefined,
  fileId: string | null,
): Promise<string | null> {
  if (!botToken || !fileId) return null;
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
    );
    const json = (await response.json()) as {
      ok?: boolean;
      result?: { file_path?: string };
    };
    if (json.ok && json.result?.file_path) {
      return `https://api.telegram.org/file/bot${botToken}/${json.result.file_path}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Recebe o push do Telegram (via webhook) quando um post novo chega num canal
 * monitorado. Verifica a fonte por sourceId + secret token, captura a oferta
 * (com dedup) e já publica nos monitores/automações vinculados — só é
 * acionado quando surge uma oferta nova.
 */
export async function handleTelegramWebhook(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const sourceId = url.searchParams.get("sourceId");
  if (!sourceId) {
    return new Response("bad request", { status: 400 });
  }

  try {
    const update = await request.json().catch(() => null);
    const post = update ? buildTelegramPost(update) : null;
    if (!post) return new Response("ok", { status: 200 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db: Db = supabaseAdmin;

    const { data: source } = await db.from("sources").select("*").eq("id", sourceId).maybeSingle();
    if (!source || source.type !== "telegram") {
      return new Response("ok", { status: 200 });
    }

    const configuration = source.configuration ?? {};
    const expected = configuration.webhook_secret ?? configuration.bot_token;
    const provided = request.headers.get("x-telegram-bot-api-secret-token");
    if (!expected || !provided || !(await secretsEqual(provided, expected))) {
      return new Response("Unauthorized", { status: 401 });
    }

    const username = extractTelegramUsername(source.identifier);
    const image = await resolvePhotoUrl(configuration.bot_token, post.photoFileId);

    const marketplaceIdBySlug = await loadMarketplaceIds(db);
    const result = await captureTelegramPost(
      db,
      { identifier: source.identifier, sourceId, userId: source.user_id },
      username,
      { id: post.externalId, textHtml: post.text, time: post.time, image },
      marketplaceIdBySlug,
    );

    const published =
      result.outcome === "captured" && result.offer
        ? await publishOfferForSource(db, sourceId, result.offer as unknown as Offer)
        : { published: 0, failed: 0, skipped: 0, errors: [] as string[] };

    return new Response(
      JSON.stringify({
        ok: true,
        outcome: result.outcome,
        offerId: result.offer?.["id"] ?? null,
        published: published.published,
        failed: published.failed,
        skipped: published.skipped,
        errors: published.errors,
      }),
      { status: 200, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  } catch (error) {
    console.error("[telegram-webhook] falha ao processar update:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Erro interno ao processar o update.",
      }),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }
}

export interface TelegramWebhookSetupResult {
  ok: boolean;
  message: string;
  results: Array<{
    sourceId: string;
    sourceName: string;
    botToken: string;
    status: string;
    description: string;
  }>;
}

/**
 * Registra `setWebhook` para todas as fontes Telegram com
 * `configuration.webhook_enabled === true` e `bot_token` definido. O webhook
 * aponta para este servidor, com secret token próprio por fonte.
 */
export async function setupTelegramWebhooks(request: Request): Promise<TelegramWebhookSetupResult> {
  const origin = new URL(request.url).origin;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db: Db = supabaseAdmin;

  const { data, error } = await db.from("sources").select("*").eq("type", "telegram");
  if (error) {
    return { ok: false, message: `Banco de dados: ${error.message}`, results: [] };
  }

  const results: TelegramWebhookSetupResult["results"] = [];
  for (const source of data ?? []) {
    const configuration = source.configuration ?? {};
    if (configuration.webhook_enabled !== true || !configuration.bot_token) continue;

    const secret = configuration.webhook_secret ?? configuration.bot_token;
    const webhookUrl = `${origin}${TELEGRAM_WEBHOOK_PATH}?sourceId=${source.id}`;
    const response = await fetch(
      `https://api.telegram.org/bot${configuration.bot_token}/setWebhook`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: secret,
          allowed_updates: ["message", "channel_post"],
        }),
      },
    );
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };
    results.push({
      sourceId: source.id,
      sourceName: source.name,
      botToken: configuration.bot_token.slice(0, 8),
      status: json.ok ? "ok" : "erro",
      description: json.description ?? (json.ok ? "Webhook registrado" : "Falha no setWebhook"),
    });
  }

  if (results.length === 0) {
    return {
      ok: false,
      message: "Nenhuma fonte Telegram com configuration.webhook_enabled=true e bot_token.",
      results,
    };
  }
  return { ok: true, message: `${results.length} webhook(s) processado(s).`, results };
}
