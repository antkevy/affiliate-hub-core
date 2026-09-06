// ============================================================
// Offer Engine - PublicationBuilder
//
// Assembles the final publication payload (text, media, link,
// template, banner, destination). Kept separate from connectors.
// ============================================================

import type { NormalizedOffer, PublicationPayload, RenderedTemplate } from "@/lib/engine/types";

export interface PublicationBuildInput {
  offer: NormalizedOffer;
  rendered: RenderedTemplate;
  destinationId?: string;
  bannerUrl?: string | null;
  mediaOverride?: { type: "image" | "video"; url: string }[];
}

export class PublicationBuilder {
  build(input: PublicationBuildInput): PublicationPayload {
    const { offer, rendered, destinationId, bannerUrl, mediaOverride } = input;

    const selectedLink = offer.affiliateUrl || offer.canonicalUrl || offer.originalUrl;

    // Prefer explicit media; else offer image as media; else banner as image
    let media: { type: "image" | "video"; url: string }[] | undefined;
    if (mediaOverride && mediaOverride.length) {
      media = mediaOverride;
    } else if (offer.image) {
      media = [{ type: "image", url: offer.image }];
    } else if (bannerUrl) {
      media = [{ type: "image", url: bannerUrl }];
    }

    return {
      text: rendered.content,
      ...(media && media.length ? { media } : {}),
      link: selectedLink || null,
      templateName: null,
      bannerUrl: bannerUrl || null,
      ...(destinationId != null ? { destinationId } : {}),
    };
  }
}

export const publicationBuilder = new PublicationBuilder();
