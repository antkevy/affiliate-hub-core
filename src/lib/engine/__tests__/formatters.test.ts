import { describe, it, expect } from "vitest";
import { computeDiscount, parsePrice, formatDiscount, formatPrice } from "@/lib/engine/formatters";
import { validateUrl, normalizeUrl, extractUrls, safeUrl } from "@/lib/engine/validation/urlSafety";

describe("formatters", () => {
  it("computes discount percentage correctly", () => {
    expect(computeDiscount(200, 100)).toBe(50);
    expect(computeDiscount(2799, 1899)).toBeCloseTo(32.19, 0);
  });

  it("returns null for invalid values (division by zero, negative)", () => {
    expect(computeDiscount(0, 100)).toBeNull();
    expect(computeDiscount(100, 0)).toBeNull();
    expect(computeDiscount(-100, 50)).toBeNull();
    expect(computeDiscount(100, -50)).toBeNull();
  });

  it("returns null when price higher than old price", () => {
    expect(computeDiscount(100, 150)).toBeNull();
  });

  it("parses brazilian and plain price formats", () => {
    expect(parsePrice("R$ 1.899,00")).toBe(1899);
    expect(parsePrice("1.899,00")).toBe(1899);
    expect(parsePrice("129,90")).toBeCloseTo(129.9, 1);
    // dot without comma is a thousands separator in the brazilian convention
    expect(parsePrice("2.799")).toBe(2799);
    expect(parsePrice("199.9")).toBe(1999);
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice("abc")).toBeNull();
  });

  it("formats discount and price strings", () => {
    expect(formatDiscount(32.19)).toBe("32%");
    expect(formatDiscount(null)).toBe("");
    expect(formatPrice(129.9)).toContain("129");
  });
});

describe("urlSafety", () => {
  it("accepts valid public https URLs", () => {
    expect(validateUrl("https://www.mercadolivre.com.br/x").ok).toBe(true);
    expect(validateUrl("http://example.com/x").ok).toBe(true);
  });

  it("blocks private/localhost/metadata urls", () => {
    expect(validateUrl("http://localhost:3000").ok).toBe(false);
    expect(validateUrl("http://127.0.0.1/x").ok).toBe(false);
    expect(validateUrl("http://10.0.0.5/x").ok).toBe(false);
    expect(validateUrl("http://192.168.1.1/x").ok).toBe(false);
    expect(validateUrl("http://172.16.0.10/x").ok).toBe(false);
    expect(validateUrl("http://169.254.169.254/latest/meta-data").ok).toBe(false);
    expect(validateUrl("http://metadata.google.internal").ok).toBe(false);
  });

  it("rejects non-http(s) protocols", () => {
    expect(validateUrl("file:///etc/passwd").ok).toBe(false);
    expect(validateUrl("ftp://example.com/x").ok).toBe(false);
    expect(validateUrl("javascript:alert(1)").ok).toBe(false);
  });

  it("rejects malformed urls", () => {
    expect(validateUrl("not a url").ok).toBe(false);
    expect(validateUrl("").ok).toBe(false);
  });

  it("extracts urls from text and dedupes", () => {
    const urls = extractUrls(
      "veja https://shopee.com.br/a e https://shopee.com.br/a e https://amazon.com.br/b",
    );
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("shopee.com.br");
  });

  it("normalizeUrl strips fragments and tracking params", () => {
    const norm = normalizeUrl("https://example.com/produto?ref=foo&utm_source=x&id=123#secao");
    expect(norm).toContain("id=123");
    expect(norm).not.toContain("ref=");
    expect(norm).not.toContain("utm_source");
    expect(norm).not.toContain("#secao");
  });

  it("safeUrl returns null for unsafe urls", () => {
    expect(safeUrl("http://localhost/x")).toBeNull();
    expect(safeUrl("https://example.com/x")).toContain("example.com");
  });
});
