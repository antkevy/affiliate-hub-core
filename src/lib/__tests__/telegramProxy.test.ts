import { describe, it, expect } from "vitest";
import { parseTelegramResult } from "@/lib/telegram-proxy.server";

describe("parseTelegramResult", () => {
  it("accepts a success object", () => {
    expect(parseTelegramResult({ ok: true, result: {} }, true).ok).toBe(true);
  });

  it("rejects an error object", () => {
    const result = parseTelegramResult(
      { ok: false, error_code: 400, description: "Bad Request" },
      false,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Bad Request");
  });

  it("accepts an array response with HTTP 200 (sendMediaGroup)", () => {
    expect(parseTelegramResult([{ result: {} }, { result: {} }], true).ok).toBe(true);
  });

  it("rejects an array response on HTTP error", () => {
    const result = parseTelegramResult([{ ok: false }], false);
    expect(result.ok).toBe(false);
  });
});
