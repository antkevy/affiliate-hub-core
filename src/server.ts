import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { authenticateCronRequest } from "./integrations/supabase/cron-auth";
import { runScheduledPublishing } from "./lib/scheduled.server";

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

/**
 * Endpoint consumido pelo job agendado (Cloud → Jobs do Lovable ou cron
 * externo). Executa captura → filtro → IA → publicação no servidor, de forma
 * totalmente automática, sem precisar do navegador aberto.
 */
async function handleScheduledRun(request: Request): Promise<Response> {
  const unauthorized = await authenticateCronRequest(request);
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
