// ============================================================
// Offer Engine - UrlExtractor
//
// Finds, normalizes, deduplicates and validates URLs in raw text.
// Only HTTP/HTTPS are accepted. Everything passes through the
// SSRF-safe validation layer.
// ============================================================

import { extractUrls, normalizeUrl, validateUrl } from "@/lib/engine/validation/urlSafety";

export interface ExtractedUrl {
  original: string;
  normalized: string;
  safe: boolean;
}

export class UrlExtractor {
  /**
   * Extract URLs from arbitrary text.
   */
  extract(text: string): ExtractedUrl[] {
    const raw = extractUrls(text);
    return raw.map((u) => {
      const check = validateUrl(u);
      const normalized = check.ok ? normalizeUrl(u) : null;
      return {
        original: u,
        normalized: normalized || u,
        safe: check.ok,
      };
    });
  }

  /**
   * First safe URL found in the text, or null.
   */
  firstSafe(text: string): string | null {
    const all = this.extract(text);
    const safe = all.find((u) => u.safe);
    return safe ? safe.normalized : null;
  }

  /**
   * Deduplicate a list of normalized URLs.
   */
  dedupe(urls: string[]): string[] {
    return Array.from(new Set(urls.filter(Boolean)));
  }
}

export const urlExtractor = new UrlExtractor();
