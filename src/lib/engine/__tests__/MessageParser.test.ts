import { describe, it, expect } from "vitest";
import { MessageParser, messageParser } from "@/lib/engine/MessageParser";

describe("MessageParser", () => {
  it("parses a full offer message (prices, coupon, url, title)", () => {
    const raw = `🔥 OFERTA!

Smart TV Samsung 50"

De R$ 2.799
Por R$ 1.899

Cupom: TV100

https://www.mercadolivre.com.br/smart-tv-50`;
    const parsed = messageParser.parse(raw);
    expect(parsed.title).toContain("Smart TV Samsung");
    expect(parsed.oldPrice).toBe(2799);
    expect(parsed.price).toBe(1899);
    expect(parsed.discountPercentage).toBeCloseTo(32.19, 0);
    expect(parsed.coupon).toBe("TV100");
    expect(parsed.url).toContain("mercadolivre.com.br");
  });

  it("tolerates missing old price, discount and coupon", () => {
    const raw = `Fone Bluetooth\nR$ 89,90\nhttps://shopee.com.br/produto-123`;
    const parsed = messageParser.parse(raw);
    expect(parsed.price).toBe(89.9);
    expect(parsed.oldPrice).toBeNull();
    expect(parsed.discountPercentage).toBeNull();
    expect(parsed.coupon).toBeNull();
  });

  it("parses inline percent discount when old price absent", () => {
    const raw = `Teclado Mecânico\nR$ 150\n30% de desconto\nhttps://example.com/p`;
    const parsed = messageParser.parse(raw);
    expect(parsed.price).toBe(150);
    expect(parsed.discountPercentage).toBe(30);
  });

  it("handles brazilian thousands separators", () => {
    const parsed = messageParser.parse("De R$ 1.500,00\nPor R$ 999,90\nhttps://example.com/x");
    expect(parsed.oldPrice).toBe(1500);
    expect(parsed.price).toBeCloseTo(999.9, 1);
  });

  it("handles 'por'/'de' inline pattern", () => {
    const parsed = messageParser.parse("Mouse R$ 120 por R$ 80 https://example.com/y");
    expect(parsed.oldPrice).toBe(120);
    expect(parsed.price).toBe(80);
  });

  it("returns no url when text has none", () => {
    const parsed = messageParser.parse("Oferta sem link");
    expect(parsed.url).toBeNull();
  });

  it("extracts price from plain current-price line without De/Por", () => {
    const parsed = messageParser.parse("Monitor 27\nPor R$ 999\nhttps://example.com/m");
    expect(parsed.price).toBe(999);
    expect(parsed.oldPrice).toBeNull();
  });
});
