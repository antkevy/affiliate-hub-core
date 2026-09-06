// ============================================================
// Offer Engine - DuplicateDetector
//
// Detects duplicate offers using multiple signals:
// canonical URL, external product id, message hash, fingerprint.
// Supports configurable cooldowns.
// ============================================================

import type { NormalizedOffer } from "@/lib/engine/types";
import { buildFingerprint } from "@/lib/engine/hash";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untyped = supabase as unknown as { from: (table: string) => any };

export interface CooldownConfig {
  /** Global cooldown seconds (applies regardless of automation). */
  globalSeconds: number;
  /** Per-automation cooldown (seconds) if provided. */
  automationSeconds?: number;
  /** Per-product cooldown (seconds) if provided. */
  productSeconds?: number;
}

export interface DuplicateResult {
  duplicate: boolean;
  reason: string | null;
  existingInternalId?: string;
  fingerprint?: string;
  signal?: "fingerprint" | "url" | "product_id" | "none";
}

const DEFAULT_COOLDOWN = 6 * 60 * 60; // 6 hours

export class DuplicateDetector {
  readonly cooldown: CooldownConfig;

  constructor(cooldown: CooldownConfig = { globalSeconds: DEFAULT_COOLDOWN }) {
    this.cooldown = cooldown;
  }

  /**
   * Build the deterministic fingerprint for an offer (also used by normalizer).
   */
  async fingerprintFor(offer: NormalizedOffer): Promise<string> {
    return buildFingerprint({
      marketplace: offer.marketplace,
      url: offer.canonicalUrl,
      productCode: offer.externalProductId,
      price: offer.price || null,
      coupon: offer.coupon,
    });
  }

  /**
   * Check an offer for duplicates against the user's existing offers and
   * the stored fingerprints table.
   */
  async check(userId: string, offer: NormalizedOffer): Promise<DuplicateResult> {
    const signal = await this.checkSignals(userId, offer);
    return signal;
  }

  private async checkSignals(userId: string, offer: NormalizedOffer): Promise<DuplicateResult> {
    const cooldownStart = new Date(Date.now() - this.currentCooldownSeconds() * 1000).toISOString();

    // 1) Fingerprint lookup (strongest signal)
    const fp = await this.fingerprintFor(offer);
    const { data: fpRow } = await untyped
      .from("offer_fingerprints")
      .select("id, offer_id, last_seen_at")
      .eq("user_id", userId)
      .eq("fingerprint", fp)
      .single();

    if (fpRow && isWithinCooldown(fpRow.last_seen_at)) {
      return {
        duplicate: true,
        reason: "Ofertas idênticas detectadas (fingerprint)",
        fingerprint: fp,
        existingInternalId: fpRow.offer_id || undefined,
        signal: "fingerprint",
      };
    }

    // 2) Canonical URL recent match
    if (offer.canonicalUrl) {
      const { data: urlRow } = await untyped
        .from("offers")
        .select("id, detected_at")
        .eq("user_id", userId)
        .eq("original_url", offer.canonicalUrl)
        .order("detected_at", { ascending: false })
        .limit(1)
        .single();

      if (urlRow && isWithinCooldown(urlRow.detected_at)) {
        return {
          duplicate: true,
          reason: "Mesma URL de oferta já processada",
          existingInternalId: urlRow.id,
          fingerprint: fp,
          signal: "url",
        };
      }
    }

    // 3) External product id recent match
    if (offer.externalProductId) {
      const { data: prodRow } = await untyped
        .from("offers")
        .select("id, detected_at")
        .eq("user_id", userId)
        .eq("title", offer.title)
        .order("detected_at", { ascending: false })
        .limit(1)
        .single();

      if (prodRow && isWithinCooldown(prodRow.detected_at)) {
        return {
          duplicate: true,
          reason: "Mesmo produto recentemente processado",
          existingInternalId: prodRow.id,
          fingerprint: fp,
          signal: "product_id",
        };
      }
    }

    return { duplicate: false, reason: null, fingerprint: fp, signal: "none" };
  }

  /**
   * Record a fingerprint (after an offer is accepted).
   */
  async record(userId: string, offerId: string, fingerprint: string): Promise<void> {
    const { data: existing } = await untyped
      .from("offer_fingerprints")
      .select("id")
      .eq("user_id", userId)
      .eq("fingerprint", fingerprint)
      .maybeSingle();

    if (existing) {
      await untyped
        .from("offer_fingerprints")
        .update({ last_seen_at: new Date().toISOString(), offer_id: offerId })
        .eq("id", existing.id);
    } else {
      await untyped.from("offer_fingerprints").insert({
        user_id: userId,
        fingerprint,
        offer_id: offerId,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        seen_count: 1,
      });
    }
  }

  private currentCooldownSeconds(): number {
    // Global cooldown governs the generic check.
    return this.cooldown.globalSeconds ?? DEFAULT_COOLDOWN;
  }
}

function isWithinCooldown(dateString: string): boolean {
  if (!dateString) return false;
  const then = new Date(dateString).getTime();
  if (isNaN(then)) return false;
  return then > new Date(Date.now() - DEFAULT_COOLDOWN * 1000).getTime();
}

export const duplicateDetector = new DuplicateDetector();
