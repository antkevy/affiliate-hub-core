import { describe, expect, it } from "vitest";
import { extractCouponBonus, extractCouponWithBonus } from "@/lib/telegram";

describe("extractCouponBonus", () => {
  it("extrai moedas do AliExpress (mesma linha)", () => {
    expect(extractCouponBonus("🎟 Cupom: BRFS8 + 581 moedas no APP")).toBe("581 moedas no APP");
  });

  it('extrai moedas sem o prefixo "+"', () => {
    expect(extractCouponBonus("Cupom: BRFS8\n581 moedas no APP")).toBe("581 moedas no APP");
  });

  it("suporta milhares e outras grafias", () => {
    expect(extractCouponBonus("🎟 Cupom: AFF10 + 1.581 moedas no app")).toBe("1.581 moedas no app");
    expect(extractCouponBonus("🏷️ Cupom: X + 250 moedas")).toBe("250 moedas");
  });

  it("retorna null sem moedas", () => {
    expect(extractCouponBonus("🎟 Cupom: BRFS8")).toBeNull();
    expect(extractCouponBonus("sem nada")).toBeNull();
  });
});

describe("extractCouponWithBonus", () => {
  it("junta código + moedas", () => {
    expect(extractCouponWithBonus("🎟 Cupom: BRFS8 + 581 moedas no APP")).toBe(
      "BRFS8 + 581 moedas no APP",
    );
  });

  it("mantém apenas o código quando não há moedas", () => {
    expect(extractCouponWithBonus("🏷️ Cupom: HUB40")).toBe("HUB40");
  });

  it("mantém apenas moedas se não houver código", () => {
    expect(extractCouponWithBonus("🎟 581 moedas no APP")).toBe("581 moedas no APP");
  });
});
