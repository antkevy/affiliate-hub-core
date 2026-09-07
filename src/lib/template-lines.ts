export interface TemplateOptionalValues {
  coupon?: string | null;
  discount_percentage?: number | null | undefined;
}

const COUPON_TOKEN = /\{(?:cupom|coupon)\}/;
const DISCOUNT_TOKEN = /\{(?:desconto|discount(?:_percentage)?)\}/;

/**
 * Remove linhas inteiras cujo token de cupom/desconto não tem valor na oferta.
 * Mantém o resto do template intacto e colapsa linhas vazias em excesso.
 */
export function removeOptionalLines(content: string, values: TemplateOptionalValues): string {
  const hasCoupon = Boolean(values.coupon?.trim());
  const hasDiscount =
    values.discount_percentage !== null && values.discount_percentage !== undefined;

  const lines = content.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    const needsCoupon = COUPON_TOKEN.test(line);
    const needsDiscount = DISCOUNT_TOKEN.test(line);
    if ((needsCoupon && !hasCoupon) || (needsDiscount && !hasDiscount)) continue;
    kept.push(line);
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
