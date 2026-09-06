// ============================================================
// Offer Engine - OfferNormalizer
//
// Converts a ParsedOffer + detection into a NormalizedOffer
// (single canonical shape used by the rest of the system).
// ============================================================

import type { IncomingMessage, NormalizedOffer, ParsedOffer } from "@/lib/engine/types";
import type { MarketplaceDetection } from "@/lib/engine/types";
import { buildFingerprint } from "@/lib/engine/hash";
import { computeDiscount } from "@/lib/engine/formatters";

export interface NormalizeInput {
  parsed: ParsedOffer;
  detection: MarketplaceDetection;
  source: string;
  incoming?: IncomingMessage;
  suppliedTitle?: string | null;
}

export class OfferNormalizer {
  async normalize(input: NormalizeInput): Promise<NormalizedOffer> {
    const { parsed, detection, source, incoming, suppliedTitle } = input;

    const title =
      suppliedTitle || parsed.title || this.fallbackTitle(parsed.rawText) || "Oferta sem título";

    const oldPrice = parsed.oldPrice != null && parsed.oldPrice > 0 ? parsed.oldPrice : null;
    const price = parsed.price != null && parsed.price > 0 ? parsed.price : null;

    // Prefer computed discount when reliable prices exist; else parsed value
    const computed = computeDiscount(oldPrice, price);
    const discountPercentage =
      computed != null && computed > 0
        ? computed
        : parsed.discountPercentage != null && parsed.discountPercentage > 0
          ? parsed.discountPercentage
          : null;

    const originalUrl = parsed.url || "";
    const canonicalUrl = parsed.url || "";
    const affiliateUrl: string | null = null;

    const firstImage =
      incoming?.media?.find((m) => m.type === "image")?.url ||
      (incoming?.urls && incoming.urls.find((u) => /\.(png|jpe?g|webp|gif)/i.test(u))) ||
      null;

    const fingerprint = await buildFingerprint({
      marketplace: detection.key,
      url: canonicalUrl,
      productCode: parsed.productCode,
      price: price ?? null,
      coupon: parsed.coupon,
    });

    return {
      marketplace: detection.key,
      marketplaceName: detection.name,
      externalProductId: parsed.productCode,
      title,
      description: parsed.description,
      price: price ?? 0,
      oldPrice,
      discountPercentage,
      coupon: parsed.coupon,
      originalUrl,
      canonicalUrl,
      affiliateUrl,
      image: firstImage,
      media: incoming?.media || [],
      source,
      capturedAt: incoming?.date || new Date().toISOString(),
      fingerprint,
      metadata: {
        rawText: parsed.rawText.slice(0, 4000),
        author: incoming?.author,
        platform: incoming?.platform,
        externalId: incoming?.externalId,
        detectedDomain: detection.domain,
      },
    };
  }

  private fallbackTitle(text: string): string | null {
    const cleaned = text
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/\bR?\$?[0-9][0-9.,]*\b/g, "")
      .trim();
    const firstLine = cleaned.split(/\r?\n/)[0];
    return firstLine && firstLine.length > 3 ? firstLine.slice(0, 120) : null;
  }
}

export const offerNormalizer = new OfferNormalizer();
