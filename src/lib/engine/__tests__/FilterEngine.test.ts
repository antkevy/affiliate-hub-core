import { describe, it, expect } from "vitest";
import { buildFilterEngine } from "@/lib/engine/FilterEngine";
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
    affiliateUrl: null,
    image: null,
    media: [],
    source: "manual",
    capturedAt: new Date().toISOString(),
    fingerprint: "fp",
    metadata: { category: "eletronicos" },
    ...overrides,
  };
}

describe("FilterEngine", () => {
  it("passes when all rules match (matchMode=all)", () => {
    const engine = buildFilterEngine(
      [
        { rule_type: "marketplace", rule_value: "Shopee" },
        { rule_type: "min_discount", rule_value: "30" },
        { rule_type: "max_price", rule_value: "300" },
      ],
      "all",
    );
    const result = engine.evaluate(makeOffer());
    expect(result.passed).toBe(true);
    expect(result.blockedBy).toBeNull();
  });

  it("blocks when one rule fails (matchMode=all)", () => {
    const engine = buildFilterEngine(
      [
        { rule_type: "marketplace", rule_value: "Shopee" },
        { rule_type: "min_discount", rule_value: "80" },
      ],
      "all",
    );
    const result = engine.evaluate(makeOffer());
    expect(result.passed).toBe(false);
    expect(result.blockedBy).toBe("min_discount");
  });

  it("passes with matchMode=any when at least one matches", () => {
    const engine = buildFilterEngine(
      [
        { rule_type: "marketplace", rule_value: "Amazon" },
        { rule_type: "marketplace", rule_value: "Shopee" },
      ],
      "any",
    );
    expect(engine.evaluate(makeOffer()).passed).toBe(true);
  });

  it("supports numeric comparison operators on price", () => {
    const gt = buildFilterEngine(
      [{ rule_type: "max_price", rule_value: "50", operator: "greater_than" }],
      "all",
    );
    // price 89.9 > 50 -> pass
    expect(gt.evaluate(makeOffer({ price: 89.9 })).passed).toBe(true);
    expect(gt.evaluate(makeOffer({ price: 30 })).passed).toBe(false);
  });

  it("blocks forbidden words in title or description", () => {
    const engine = buildFilterEngine(
      [{ rule_type: "forbidden_words", rule_value: "iPhone" }],
      "all",
    );
    expect(engine.evaluate(makeOffer({ title: "Fone Bluetooth" })).passed).toBe(true);
    expect(engine.evaluate(makeOffer({ title: "iPhone 15 Pro" })).passed).toBe(false);
  });

  it("requires one of the words for required_words", () => {
    const engine = buildFilterEngine(
      [{ rule_type: "required_words", rule_value: "Bluetooth, Wireless" }],
      "all",
    );
    expect(engine.evaluate(makeOffer({ title: "Fone Bluetooth" })).passed).toBe(true);
    expect(engine.evaluate(makeOffer({ title: "Fone Cabo" })).passed).toBe(false);
  });

  it("coupon_only requires a coupon; no_coupon_only rejects it", () => {
    const withCoupon = buildFilterEngine([{ rule_type: "coupon_only", rule_value: "" }], "all");
    const noCoupon = buildFilterEngine([{ rule_type: "no_coupon_only", rule_value: "" }], "all");
    expect(withCoupon.evaluate(makeOffer({ coupon: "AFF" })).passed).toBe(true);
    expect(withCoupon.evaluate(makeOffer({ coupon: null })).passed).toBe(false);
    expect(noCoupon.evaluate(makeOffer({ coupon: null })).passed).toBe(true);
    expect(noCoupon.evaluate(makeOffer({ coupon: "AFF" })).passed).toBe(false);
  });

  it("passes with no rules configured", () => {
    const engine = buildFilterEngine([], "all");
    expect(engine.evaluate(makeOffer()).passed).toBe(true);
  });
});
