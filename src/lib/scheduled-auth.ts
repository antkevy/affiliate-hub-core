import { authenticateCronRequest } from "../integrations/supabase/cron-auth";

async function tokenDigest(token: string, secret: string): Promise<[Buffer, Buffer]> {
  const { createHash } = await import("node:crypto");
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return [digest(token), digest(secret)];
}

/**
 * Aceita o segredo gerenciado pelo Lovable (LOVABLE_CRON_SECRET /
 * LOVABLE_CRON_SECRET_PREVIOUS) e também um segredo próprio definido pelo
 * usuário via PUBLISH_CRON_SECRET — permitindo agendadores externos
 * (cron-job.org, EasyCron, GitHub Actions etc.).
 */
export async function authenticateScheduledRun(request: Request): Promise<Response | null> {
  const lovableResult = await authenticateCronRequest(request);
  if (!lovableResult) return null;

  const customSecret = process.env["PUBLISH_CRON_SECRET"];
  if (!customSecret) return lovableResult;

  const match = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "");
  const token = match?.[1];
  if (!token) return new Response("Unauthorized", { status: 401 });

  const { timingSafeEqual } = await import("node:crypto");
  const [providedDigest, customDigest] = await tokenDigest(token, customSecret);
  if (!timingSafeEqual(providedDigest, customDigest)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
