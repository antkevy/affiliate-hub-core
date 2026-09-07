import { afterEach, describe, expect, it } from "vitest";
import { authenticateScheduledRun } from "@/lib/scheduled-auth";

function bearer(token: string): Request {
  return new Request("http://localhost/api/scheduled/run", {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("authenticateScheduledRun", () => {
  const originals: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of [
      "LOVABLE_CRON_SECRET",
      "LOVABLE_CRON_SECRET_PREVIOUS",
      "PUBLISH_CRON_SECRET",
    ]) {
      if (originals[key]) process.env[key] = originals[key];
      else delete process.env[key];
    }
  });

  function set(values: Record<string, string | undefined>) {
    for (const [key, value] of Object.entries(values)) {
      originals[key] = process.env[key];
      if (value) process.env[key] = value;
      else delete process.env[key];
    }
  }

  it("aceita o PUBLISH_CRON_SECRET definido pelo usuário", async () => {
    set({ PUBLISH_CRON_SECRET: "meu-segredo" });
    await expect(authenticateScheduledRun(bearer("meu-segredo"))).resolves.toBeNull();
  });

  it("aceita o segredo do Lovable como fallback", async () => {
    set({ LOVABLE_CRON_SECRET: "lovable-segredo" });
    await expect(authenticateScheduledRun(bearer("lovable-segredo"))).resolves.toBeNull();
  });

  it("rejeita token desconhecido com 401", async () => {
    set({ LOVABLE_CRON_SECRET: "lovable-segredo", PUBLISH_CRON_SECRET: "meu-segredo" });
    const res = await authenticateScheduledRun(bearer("errado"));
    expect(res?.status).toBe(401);
  });
});
