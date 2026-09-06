// ============================================================
// Offer Engine - TemplateEngine
//
// Renders a template string replacing {var} placeholders with
// real offer data. Missing variables never break the publish;
// they are simply left as placeholders and reported.
// ============================================================

import type { NormalizedOffer, RenderedTemplate } from "@/lib/engine/types";
import { formatDiscount, formatPrice } from "@/lib/engine/formatters";

export interface TemplateContext {
  [key: string]: string;
}

export type BuiltTemplateContext = {
  titulo: string;
  descricao: string;
  preco: string;
  preco_antigo: string;
  desconto: string;
  cupom: string;
  link: string;
  marketplace: string;
  categoria: string;
};

export const TEMPLATE_VARIABLES = [
  "titulo",
  "descricao",
  "preco",
  "preco_antigo",
  "desconto",
  "cupom",
  "link",
  "marketplace",
  "categoria",
] as const;

/**
 * Build a variable context from a NormalizedOffer.
 */
export function buildContext(offer: NormalizedOffer): BuiltTemplateContext {
  const category = (offer.metadata?.["category"] as string | undefined) || "";

  return {
    titulo: offer.title || "",
    descricao: offer.description || "",
    preco: formatPrice(offer.price),
    preco_antigo: offer.oldPrice != null ? formatPrice(offer.oldPrice) : "",
    desconto: formatDiscount(offer.discountPercentage),
    cupom: offer.coupon || "",
    link: offer.affiliateUrl || offer.canonicalUrl || offer.originalUrl || "",
    marketplace: offer.marketplaceName || "",
    categoria: category,
  };
}

export class TemplateEngine {
  /**
   * Render a template string against a context.
   * Missing variables are left as placeholders and reported in missingVariables.
   */
  render(template: string, context: TemplateContext): RenderedTemplate {
    let content = String(template ?? "");
    const missing: string[] = [];
    const used: string[] = [];

    const regex = /\{([a-zA-Z0-9_]+)\}/g;
    let match: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((match = regex.exec(content)) !== null) {
      const key = match[1];
      if (key == null) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      if (key in context && context[key] !== "") {
        used.push(key);
      } else if (!(key in context)) {
        missing.push(key);
      }
    }

    for (const key of Object.keys(context)) {
      const value = context[key];
      if (value != null) {
        content = content.split(`{${key}}`).join(value);
      }
    }

    return { content, usedVariables: used, missingVariables: missing };
  }

  /**
   * Render a template against an offer, building the context automatically.
   */
  renderOffer(template: string, offer: NormalizedOffer): RenderedTemplate {
    return this.render(template, buildContext(offer));
  }
}

export const templateEngine = new TemplateEngine();
