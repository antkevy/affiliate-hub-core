export interface TemplateOptionalValues {
  coupon?: string | null | undefined;
  discount_percentage?: number | null | undefined;
  coins?: string | null | undefined;
}

const COUPON_TOKEN = /\{(?:cupom|coupon)\}/;
const DISCOUNT_TOKEN = /\{(?:desconto|discount(?:_percentage)?)\}/;
const COINS_TOKEN = /\{(?:moedas|bonus|bonus)\}/;

/**
 * Remove linhas inteiras cujo token de cupom/desconto/moedas não tem valor na oferta.
 * Mantém o resto do template intacto e colapsa linhas vazias em excesso.
 */
export function removeOptionalLines(content: string, values: TemplateOptionalValues): string {
  const hasCoupon = Boolean(values.coupon?.trim());
  const hasDiscount =
    values.discount_percentage !== null && values.discount_percentage !== undefined;
  const hasCoins = Boolean(values.coins?.trim());

  const lines = content.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    const needsCoupon = COUPON_TOKEN.test(line);
    const needsDiscount = DISCOUNT_TOKEN.test(line);
    const needsCoins = COINS_TOKEN.test(line);
    if (
      (needsCoupon && !hasCoupon) ||
      (needsDiscount && !hasDiscount) ||
      (needsCoins && !hasCoins)
    ) {
      continue;
    }
    kept.push(line);
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extrai o trecho de moedas de um cupom (ex.: "BRFS8 + 581 moedas no APP" → "581 moedas no APP").
 */
export function couponBonus(coupon?: string | null): string {
  const match = (coupon ?? "").match(/\d[\d.,]*\s+moedas(?:\s+no\s+app)?/i);
  return match ? match[0].replace(/\s+/g, " ").trim() : "";
}
