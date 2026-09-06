// ============================================================
// Offer Engine - Value formatters & math helpers
// ============================================================

/**
 * Parse a price string into a number (Brazilian decimal convention:
 * comma as decimal separator, dot as thousands separator).
 * Returns null if not parseable.
 */
export function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = String(raw).trim().replace(/\s/g, "");

  const R$Match = cleaned.match(/R\$\s?([0-9][0-9.,]*)/i);
  const numPart = R$Match ? R$Match[1] : cleaned;
  if (!numPart) return null;

  // Only digits, separators are allowed
  if (!/^[0-9][0-9.,]*$/.test(numPart)) return null;

  // If a comma is present, it is the decimal separator (Brazilian).
  // Dots are thousands separators -> remove them.
  if (numPart.includes(",")) {
    const normalized = numPart.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return isFinite(parsed) ? parsed : null;
  }

  // No comma: dots, if any, are thousands separators (e.g. 2.799 -> 2799).
  const noThousands = numPart.includes(".") ? numPart.replace(/\./g, "") : numPart;
  if (!/^\d+$/.test(noThousands)) return null;
  const parsed = Number(noThousands);
  return isFinite(parsed) ? parsed : null;
}

/**
 * Compute discount percentage safely.
 * Returns null on invalid inputs (negative, zero old price, NaN, Infinity).
 */
export function computeDiscount(oldPrice: number | null, price: number | null): number | null {
  if (oldPrice == null || price == null) return null;
  if (!isFinite(oldPrice) || !isFinite(price)) return null;
  if (oldPrice <= 0 || price <= 0) return null;
  if (price > oldPrice) return null; // price higher than original => no discount
  const discount = ((oldPrice - price) / oldPrice) * 100;
  if (!isFinite(discount)) return null;
  return Math.round(discount * 100) / 100;
}

/**
 * Human-readable discount string.
 */
export function formatDiscount(percentage: number | null): string {
  if (percentage == null || !isFinite(percentage)) return "";
  return `${Math.round(percentage)}%`;
}

/**
 * Format a number as BRL currency string.
 */
export function formatPrice(value: number | null): string {
  if (value == null || !isFinite(value)) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Safe division returning null instead of Infinity/NaN.
 */
export function safeDivide(a: number, b: number): number | null {
  if (b === 0 || !isFinite(a) || !isFinite(b)) return null;
  return a / b;
}
