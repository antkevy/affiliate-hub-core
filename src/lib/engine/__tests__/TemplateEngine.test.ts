import { describe, it, expect } from "vitest";
import { templateEngine, buildContext } from "@/lib/engine/TemplateEngine";
import type { NormalizedOffer } from "@/lib/engine/types";

function makeOffer(overrides: Partial<NormalizedOffer> = {}): NormalizedOffer {
  return {
    marketplace: "shopee",
    marketplaceName: "Shopee",
    externalProductId: null,
    title: "Fone Bluetooth Pro",
    description: "",
    price: 89.9,
    oldPrice: 199.9,
    discountPercentage: 55,
    coupon: "AFF55",
    originalUrl: "https://shopee.com.br/x",
    canonicalUrl: "https://shopee.com.br/x",
    affiliateUrl: "https://shopee.com.br/x?aff=123",
    image: null,
    media: [],
    source: "manual",
    capturedAt: new Date().toISOString(),
    fingerprint: "fp",
    metadata: {},
    ...overrides,
  };
}

describe("TemplateEngine", () => {
  const template = [
    "🔥 {titulo}",
    "",
    "💰 De: {preco_antigo}",
    "🏷️ Por: {preco}",
    "",
    "📉 {desconto}% OFF",
    "",
    "🎟️ Cupom: {cupom}",
    "",
    "🛒 COMPRAR:",
    "{link}",
  ].join("\n");

  it("replaces all known variables with real data", () => {
    const offer = makeOffer();
    const res = templateEngine.renderOffer(template, offer);
    expect(res.content).toContain(offer.title);
    expect(res.content).toMatch(/R\$\s+89,90/);
    expect(res.content).toContain("55%");
    expect(res.content).toContain("AFF55");
    expect(res.content).toContain(offer.affiliateUrl!);
  });

  it("does not break when a variable is missing/empty", () => {
    const offer = makeOffer({ coupon: null, oldPrice: null, description: "" });
    const res = templateEngine.renderOffer(template, offer);
    // cupom line becomes empty coupon value but template still renders
    expect(res.content).toContain(offer.title);
  });

  it("handles special characters and unicode emojis safely", () => {
    const templateWithSpecials = 'Título com "aspas" e {titulo} & <t> {preco}';
    const res = templateEngine.renderOffer(templateWithSpecials, makeOffer());
    expect(res.content).not.toContain("{titulo}");
    expect(res.content).not.toContain("{preco}");
  });

  it("reports missing variables", () => {
    const res = templateEngine.render("Olá {variavel_desconhecida} {titulo}", {
      titulo: "teste",
    });
    expect(res.missingVariables).toContain("variavel_desconhecida");
  });

  it("buildContext formats currency pt-BR", () => {
    const ctx = buildContext(
      makeOffer({ price: 89.9, oldPrice: 199.9, discountPercentage: 55, coupon: "X" }),
    );
    expect(ctx.preco).toMatch(/R\$\s+89,90/);
    expect(ctx.preco_antigo).toMatch(/R\$\s+199,90/);
    expect(ctx.desconto).toBe("55%");
    expect(ctx.cupom).toBe("X");
  });
});
