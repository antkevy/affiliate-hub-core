// ============================================================
// Offer Engine - MarketplaceDetector
//
// Identifies the marketplace from a URL/domain using adapters,
// avoiding long if/else chains.
// ============================================================

import type { MarketplaceAdapter, MarketplaceDetection, MarketplaceKey } from "@/lib/engine/types";
import {
  DEFAULT_ADAPTERS,
  UnknownAdapter,
  marketplaceName,
} from "@/lib/engine/marketplaceAdapters/adapters";

export interface MarketplaceDetectorOptions {
  adapters?: MarketplaceAdapter[];
}

export class MarketplaceDetector {
  private adapters: MarketplaceAdapter[];

  constructor(opts: MarketplaceDetectorOptions = {}) {
    this.adapters = opts.adapters || DEFAULT_ADAPTERS;
  }

  /**
   * Detect the marketplace for a URL. Returns a detection with confidence.
   */
  detect(url: string | null | undefined): MarketplaceDetection {
    if (!url) {
      return { key: "unknown", name: marketplaceName("unknown"), domain: null, confidence: 0 };
    }

    let host = "";
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      return { key: "unknown", name: marketplaceName("unknown"), domain: url, confidence: 0 };
    }

    for (const adapter of this.adapters) {
      if (adapter.key === "unknown") continue;
      if (adapter.detectUrl(url)) {
        return {
          key: adapter.key,
          name: marketplaceName(adapter.key),
          domain: host,
          confidence: 0.95,
        };
      }
    }

    return {
      key: "unknown",
      name: marketplaceName("unknown"),
      domain: host,
      confidence: 0.2,
    };
  }

  /**
   * Detect and additionally return the matching adapter (or unknown).
   */
  detectWithAdapter(url: string | null | undefined): {
    detection: MarketplaceDetection;
    adapter: MarketplaceAdapter;
  } {
    const detection = this.detect(url);
    const adapter = this.adapters.find((a) => a.key === detection.key) || new UnknownAdapter();
    return { detection, adapter };
  }

  /**
   * Whether the marketplace key is known (not unknown).
   */
  isKnown(key: MarketplaceKey | string): boolean {
    return key !== "unknown";
  }
}

export const marketplaceDetector = new MarketplaceDetector();
