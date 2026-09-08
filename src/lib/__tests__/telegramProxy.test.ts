import { describe, it, expect } from "vitest";
import { parseTelegramResult, telegramThreadUrl } from "@/lib/telegram-proxy.server";

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

  it("extracts message_id and chat_id from the result", () => {
    const result = parseTelegramResult(
      { ok: true, result: { message_id: 42, chat: { id: -10012345 } } },
      true,
    );
    expect(result).toMatchObject({ ok: true, message_id: 42, chat_id: -10012345 });
  });

  it("extracts message_id/chat_id from the first item of sendMediaGroup arrays", () => {
    const result = parseTelegramResult([{ result: { message_id: 7, chat: { id: -1009 } } }], true);
    expect(result).toMatchObject({ ok: true, message_id: 7, chat_id: -1009 });
  });
});

describe("telegramThreadUrl", () => {
  it("strips the -100 prefix of supergroups", () => {
    expect(telegramThreadUrl(-1001395881396, 12)).toBe("https://t.me/c/1395881396/12");
  });

  it("keeps ids without the -100 prefix as-is", () => {
    expect(telegramThreadUrl(1395881396, 5)).toBe("https://t.me/c/1395881396/5");
  });
});
