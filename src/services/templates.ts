import { createCrud } from "./base";
import type { Offer } from "@/types";
import { removeOptionalLines } from "@/lib/template-lines";

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
export function renderTemplate(content: string, offer?: Partial<Offer> & { marketplace?: string }) {
  const salePriceFormatted = formatMoney(offer?.sale_price);
  const origPriceFormatted = formatMoney(offer?.original_price);
  const discountFormatted =
    offer?.discount_percentage !== null && offer?.discount_percentage !== undefined
      ? `${offer.discount_percentage}%`
      : "—";

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
        cupom: offer.coupon ?? "—",
        coupon: offer.coupon ?? "—",
        link: offer.affiliate_url ?? offer.original_url ?? "—",
        url: offer.affiliate_url ?? offer.original_url ?? "—",
        marketplace: offer.marketplace ?? "—",
        categoria: "—",
      }
    : {
        ...SAMPLE,
        title: SAMPLE.titulo,
        price: SAMPLE.preco,
        sale_price: SAMPLE.preco,
        original_price: SAMPLE.preco_antigo,
        discount: SAMPLE.desconto,
        coupon: SAMPLE.cupom,
        url: SAMPLE.link,
      };

  return removeOptionalLines(content, offer ?? {}).replace(
    /\{(\w+)\}/g,
    (match, key: string) => values[key] ?? match,
  );
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
