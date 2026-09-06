// ============================================================
// Offer Engine - MessageParser
//
// Analyzes raw message text and extracts structured offer data
// (title, prices, discount, coupon, urls, product codes).
// Tolerant of many formats; never fails hard when a field is missing.
// ============================================================

import type { ParsedOffer } from "@/lib/engine/types";
import { computeDiscount, parsePrice } from "@/lib/engine/formatters";
import { urlExtractor } from "@/lib/engine/UrlExtractor";

// Coupon: uppercase alphanumeric, 3-20 chars, often after "cupom:"/"code:"
const COUPON_RE =
  /\b(?:cupom|cupo[mn]|c(?:ódigo|odigo)|codigo?|code)\s*:?[\s:-]*([A-Za-z0-9][A-Za-z0-9_-]{2,19})/i;

// Standalone coupon-looking token (uppercase with digits, 4-16 chars)
const TOKEN_COUPON_RE = /\b([A-Z][A-Z0-9]{3,15})\b(?![A-Za-z0-9])/;

// "De R$ X / Por R$ Y" (explicit De + Por markers)
const PRICE_PAIR_RE =
  /\bDe\s*:?\s*R?\$?\s*([0-9][0-9.,]*)\s*(?:por|para|→|->)\s*:?\s*R?\$?\s*([0-9][0-9.,]*)/i;

// Bare "R$ X por R$ Y" (both sides must carry a currency marker)
const BARE_PAIR_RE = /\bR\$\s*([0-9][0-9.,]*)\s*(?:por|para|→|->)\s*R?\$?\s*([0-9][0-9.,]*)/i;

// "De R$ X" / "Por R$ Y" on separate zones
const DE_ONLY_RE = /\bDe\s*:?\s*R?\$?\s*([0-9][0-9.,]*)/i;
const POR_ONLY_RE = /\bPor\s*:?\s*R?\$?\s*([0-9][0-9.,]*)/i;

// Any single "R$ X"
const SINGLE_PRICE_RE = /R\$\s*([0-9][0-9.,]*)/i;

interface MessageParserOptions {
  extractTitle?: boolean;
}

export class MessageParser {
  private opts: MessageParserOptions;

  constructor(opts: MessageParserOptions = {}) {
    this.opts = opts;
  }

  parse(text: string): ParsedOffer {
    const raw = String(text ?? "").trim();

    const urls = urlExtractor.extract(raw);
    const safeUrl = urls.find((u) => u.safe && u.normalized.startsWith("http"));
    const url = safeUrl ? safeUrl.normalized : urlExtractor.firstSafe(raw);

    // Prices
    let oldPrice: number | null = null;
    let price: number | null = null;

    // Prefer explicit "De X / Por Y" markers (avoids matching title numbers)
    const pair = raw.match(PRICE_PAIR_RE);
    if (pair) {
      oldPrice = parsePrice(pair[1]);
      price = parsePrice(pair[2]);
    }

    // Bare "R$ X por R$ Y" where the first side clearly carries a price
    if (price == null) {
      const bare = raw.match(BARE_PAIR_RE);
      if (bare) {
        oldPrice = parsePrice(bare[1]);
        price = parsePrice(bare[2]);
      }
    }

    // If pair failed, look for "De R$ X" then "Por R$ Y" separately
    if (price == null) {
      const deMatch = raw.match(DE_ONLY_RE);
      const porMatch = raw.match(POR_ONLY_RE);
      if (deMatch) oldPrice = parsePrice(deMatch[1]);
      if (porMatch) price = parsePrice(porMatch[1]);
    }

    // Fallback: any single price (current price)
    if (price == null || price <= 0) {
      const single = raw.match(SINGLE_PRICE_RE);
      if (single) price = parsePrice(single[1]);
    }

    let discountPercentage: number | null = null;
    const discountParsed = computeDiscount(oldPrice, price);
    if (discountParsed != null && discountParsed > 0) {
      discountPercentage = discountParsed;
    } else {
      // "30% off" / "30% de desconto"
      const pct = raw.match(/(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:off|desconto|de desconto|de\s*off)/i);
      if (pct) {
        const pctValue = pct[1];
        if (pctValue != null) {
          const parsedPct = parseFloat(pctValue.replace(",", "."));
          if (!isNaN(parsedPct) && parsedPct > 0 && parsedPct <= 100) {
            discountPercentage = parsedPct;
          }
        }
      }
    }

    // Coupon
    let coupon: string | null = null;
    const couponMatch = raw.match(COUPON_RE);
    if (couponMatch) {
      const value = couponMatch[1];
      if (value != null) coupon = value.trim().toUpperCase();
    } else {
      const token = raw.match(TOKEN_COUPON_RE);
      // Only treat as coupon if it's clearly in a "cupom-ish" context or looks like a code
      if (token && /\b(cupom|code|codigo|código)\b/i.test(raw)) {
        coupon = token[1] ?? null;
      }
    }

    // Title: prefer first line that is not a URL and not a price-only line
    let title: string | null = null;
    if (this.opts.extractTitle !== false) {
      title = this.extractTitle(
        raw,
        urls.map((u) => u.original),
      );
    }

    // Product code
    let productCode: string | null = null;
    const codeMatch = raw.match(/\b(?:sku|code|codigo|código|id)\s*:?\s*([A-Za-z0-9-]{4,30})/i);
    if (codeMatch) {
      const code = codeMatch[1];
      if (code != null) productCode = code.trim();
    }

    return {
      title,
      description: null,
      price,
      oldPrice,
      discountPercentage,
      coupon,
      url,
      productCode,
      rawText: raw,
    };
  }

  private extractTitle(text: string, excludedUrls: string[]): string | null {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    for (const line of lines) {
      // Skip URLs
      if (/^https?:\/\//i.test(line)) continue;
      // Skip price-only / discount-only / coupon lines
      if (/^(de|por|r\$|cupom|code|codigo|código|#|🔗|🛒|💰|🏷|🔥)[\s:]*/i.test(line)) continue;
      if (/^\d{1,3}([.,]\d+)?%/.test(line)) continue;
      // Skip lines that are pure numbers/currency
      if (/^R?\$\s?[0-9.,]+\s*$/i.test(line)) continue;
      // Take the first meaningful line as title
      return line.replace(/^[#*\-•🔥✨⭐]+\s*/u, "").trim() || null;
    }

    // Fallback: strip prices/urls from whole text and take first sentence
    const cleaned = text
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/\bR?\$?[0-9][0-9.,]*\b/g, "")
      .replace(/^\s*[#*\-•]+\s*/gm, "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 5 && !/^(de|por|r\$|cupom|code)[\s:]*/i.test(l));
    return cleaned[0] || null;
  }
}

export const messageParser = new MessageParser();
