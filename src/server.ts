import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { authenticateScheduledRun } from "./lib/scheduled-auth";
import { runScheduledPublishing } from "./lib/scheduled.server";
import {
  handleTelegramWebhook,
  setupTelegramWebhooks,
  TELEGRAM_WEBHOOK_PATH,
} from "./lib/telegram-webhook.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

const SCHEDULED_PATH = "/api/scheduled/run";
const WEBHOOK_SETUP_PATH = "/api/telegram/webhook/setup";

/**
 * Endpoint consumido pelo job agendado (Cloud → Jobs do Lovable ou cron
 * externo via cron-job.org/GitHub Actions). Executa captura → filtro → IA →
 * publicação no servidor, de forma totalmente automática, sem precisar do
 * navegador aberto. Autenticado com o segredo do Lovable (LOVABLE_CRON_SECRET)
 * ou com PUBLISH_CRON_SECRET, definido pelo usuário.
 */
async function handleScheduledRun(request: Request): Promise<Response> {
  const unauthorized = await authenticateScheduledRun(request);
  if (unauthorized) return unauthorized;

  try {
    const startedAt = Date.now();
    const report = await runScheduledPublishing();
    return new Response(
      JSON.stringify({
        ok: true,
        offersCaptured: report.offersCaptured,
        offersIgnored: report.offersIgnored,
        offersPublished: report.offersPublished,
        offersFailed: report.offersFailed,
        errors: report.errors,
        elapsedMs: Date.now() - startedAt,
      }),
      { status: 200, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Falha agendada.",
      }),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (
        url.pathname === SCHEDULED_PATH &&
        (request.method === "GET" || request.method === "POST")
      ) {
        return await handleScheduledRun(request);
      }
      if (url.pathname === TELEGRAM_WEBHOOK_PATH && request.method === "POST") {
        return await handleTelegramWebhook(request);
      }
      if (url.pathname === WEBHOOK_SETUP_PATH) {
        const unauthorized = await authenticateScheduledRun(request);
        if (unauthorized) return unauthorized;
        const setup = await setupTelegramWebhooks(request);
        return new Response(JSON.stringify(setup), {
          status: setup.ok ? 200 : 400,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
