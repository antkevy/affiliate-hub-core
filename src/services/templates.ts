import { createCrud } from "./base";
import type { Offer } from "@/types";

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
  const values: Record<string, string> = offer
    ? {
        titulo: offer.title ?? SAMPLE.titulo,
        preco: formatMoney(offer.sale_price),
        preco_antigo: formatMoney(offer.original_price),
        desconto:
          offer.discount_percentage !== null && offer.discount_percentage !== undefined
            ? `${offer.discount_percentage}%`
            : "—",
        cupom: offer.coupon ?? "—",
        link: offer.affiliate_url ?? offer.original_url ?? "—",
        marketplace: offer.marketplace ?? "—",
        categoria: "—",
      }
    : SAMPLE;

  return content.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
