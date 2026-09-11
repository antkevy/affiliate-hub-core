import { createCrud } from "./base";
import type { Offer } from "@/types";
import { couponBonus, removeOptionalLines } from "@/lib/template-lines";

export const templatesService = createCrud("templates");

const SAMPLE = {
  titulo: "Fone Bluetooth XZ 5.3",
  preco: "R$ 149,90",
  preco_antigo: "R$ 249,90",
  desconto: "40%",
  cupom: "HUB40",
  link: "https://exemplo.com/oferta",
  marketplace: "Mercado Livre",
  categoria: "Eletrônicos",
};

/** Substitui variáveis do template. Usa dados de exemplo no preview. */
export function renderTemplate(
  content: string,
  offer?: Partial<Offer> & { marketplace?: string },
  cta?: string | null,
) {
  const salePriceFormatted = formatMoney(offer?.sale_price);
  const origPriceFormatted = formatMoney(offer?.original_price);
  const discountFormatted =
    offer?.discount_percentage !== null && offer?.discount_percentage !== undefined
      ? `${offer.discount_percentage}%`
      : "—";

  const couponFormatted = formatCouponCode(offer?.coupon);
  const ctaFormatted = cta?.trim() || "—";

  const values: Record<string, string> = offer
    ? {
        titulo: offer.title ?? SAMPLE.titulo,
        title: offer.title ?? SAMPLE.titulo,
        preco: salePriceFormatted,
        price: salePriceFormatted,
        sale_price: salePriceFormatted,
        preco_antigo: origPriceFormatted,
        original_price: origPriceFormatted,
        desconto: discountFormatted,
        discount: discountFormatted,
        discount_percentage: discountFormatted,
        cupom: couponFormatted,
        coupon: couponFormatted,
        moedas: couponBonus(offer.coupon) || "—",
        link: offer.affiliate_url ?? offer.original_url ?? "—",
        url: offer.affiliate_url ?? offer.original_url ?? "—",
        marketplace: offer.marketplace ?? "—",
        categoria: "—",
        cta: ctaFormatted,
      }
    : {
        ...SAMPLE,
        title: SAMPLE.titulo,
        price: SAMPLE.preco,
        sale_price: SAMPLE.preco,
        original_price: SAMPLE.preco_antigo,
        discount: SAMPLE.desconto,
        coupon: formatCouponCode(SAMPLE.cupom),
        moedas: "—",
        url: SAMPLE.link,
        cta: ctaFormatted,
      };

  const rendered = (
    offer
      ? removeOptionalLines(content, {
          coupon: offer.coupon,
          discount_percentage: offer.discount_percentage,
          coins: couponBonus(offer.coupon),
          cta,
        })
      : content
  ).replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
  return rendered.replace(/`+([^`\n]+)`+/g, "`$1`");
}

const NON_CODE_WORDS = new Set([
  "APP",
  "BRASIL",
  "BRL",
  "OFF",
  "COM",
  "OU",
  "SEM",
  "COMBO",
  "FRETE",
  "LOJA",
  "MOEDAS",
  "GRATIS",
  "GRÁTIS",
  "MAIS",
  "PARA",
  "PELO",
  "PELA",
  "TODOS",
  "ATE",
  "ATÉ",
  "TEM",
  "USAR",
  "BAIXO",
  "PRIME",
  "ITEM",
  "DESCONTO",
  "CUPOM",
  "CUPONS",
  "MOEDA",
]);

function formatCouponCode(coupon: string | null | undefined): string {
  if (!coupon || !coupon.trim() || coupon === "—") return "—";
  const clean = coupon.replace(/[`]/g, "").trim();
  if (!clean) return "—";

  if (coupon.includes("`")) {
    return coupon.replace(/`+([^`\n]+)`+/g, "`$1`");
  }

  let hasFormattedCode = false;
  const formatted = clean.replace(/\b([A-Z0-9_-]{3,25})\b/g, (match, code: string) => {
    if (NON_CODE_WORDS.has(code.toUpperCase())) {
      return match;
    }
    const hasLetter = /[A-Z]/i.test(code);
    const hasDigit = /\d/.test(code);
    const isUpperCode = code.length >= 4 && code === code.toUpperCase();

    if (hasLetter && (hasDigit || isUpperCode)) {
      hasFormattedCode = true;
      return `\`${code}\``;
    }
    return match;
  });

  if (!hasFormattedCode && clean.length <= 30 && !clean.includes(" ")) {
    return `\`${clean}\``;
  }

  return formatted;
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
