import { describe, expect, it } from "vitest";
import { couponBonus, removeOptionalLines } from "@/lib/template-lines";

const TEMPLATE = [
  "➡️ 🔥 {titulo}",
  "",
  "⚡ {desconto} OFF",
  "🏷️ Cupom: {cupom}",
  "",
  "🛒 {link}",
].join("\n");

describe("removeOptionalLines", () => {
  it("mantém cupom e desconto quando existem", () => {
    const out = removeOptionalLines(TEMPLATE, {
      coupon: "HUB40",
      discount_percentage: 40,
    });
    expect(out).toContain("⚡ {desconto} OFF");
    expect(out).toContain("🏷️ Cupom: {cupom}");
    expect(out).toContain("🛒 {link}");
  });

  it("remove a linha de cupom quando não há cupom", () => {
    const out = removeOptionalLines(TEMPLATE, {
      coupon: null,
      discount_percentage: 40,
    });
    expect(out).not.toContain("Cupom");
    expect(out).toContain("⚡ {desconto} OFF");
    expect(out).toContain("🛒 {link}");
  });

  it("remove a linha de desconto quando não há desconto", () => {
    const out = removeOptionalLines(TEMPLATE, {
      coupon: "HUB40",
      discount_percentage: null,
    });
    expect(out).not.toContain("{desconto}");
    expect(out).toContain("🏷️ Cupom: {cupom}");
  });

  it("remove cupom e desconto quando ambos faltam, sem linhas vazias em excesso", () => {
    const out = removeOptionalLines(TEMPLATE, { coupon: "", discount_percentage: undefined });
    expect(out).not.toContain("Cupom");
    expect(out).not.toContain("{desconto}");
    expect(out).not.toMatch(/\n{3,}/);
    expect(out).toContain("➡️ 🔥 {titulo}");
    expect(out).toContain("🛒 {link}");
  });

  it("remove a linha inteira mesmo com token inline junto de outro texto", () => {
    const out = removeOptionalLines("Título: {titulo} Cupom {cupom}", {
      coupon: null,
      discount_percentage: 40,
    });
    expect(out).toBe("");
  });

  it("considera desconto 0% como presente", () => {
    const out = removeOptionalLines("⚡ {desconto} OFF", {
      coupon: null,
      discount_percentage: 0,
    });
    expect(out).toContain("{desconto}");
  });

  it("aceita aliases coupon e discount_percentage", () => {
    const out = removeOptionalLines("{coupon}", { coupon: null, discount_percentage: null });
    expect(out).toBe("");
    const out2 = removeOptionalLines("{discount_percentage}", {
      coupon: null,
      discount_percentage: null,
    });
    expect(out2).toBe("");
  });

  it("remove linha de moedas quando não há moedas e mantém com moedas", () => {
    const tpl = "🎟 Moedas: {moedas}";
    expect(removeOptionalLines(tpl, { coupon: "BRFS8", coins: "" })).toBe("");
    expect(removeOptionalLines(tpl, { coupon: "BRFS8", coins: "581 moedas no APP" })).toContain(
      "{moedas}",
    );
  });

  it("couponBonus extrai moedas do cupom", () => {
    expect(couponBonus("BRFS8 + 581 moedas no APP")).toBe("581 moedas no APP");
    expect(couponBonus("HUB40")).toBe("");
    expect(couponBonus(null)).toBe("");
  });
});
