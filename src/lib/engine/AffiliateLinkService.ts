// ============================================================
// Offer Engine - AffiliateLinkService
//
// Turns an original URL into an affiliate URL via the matching
// marketplace adapter and the user's enrolled affiliate account.
//
// IMPORTANT: no affiliate URLs are ever fabricated. If the
// marketplace adapter is NOT_CONNECTED or the user has no
// configured affiliate account/credentials, generation is
// reported unavailable and the offer keeps a null affiliate_url.
// ============================================================

import type { MarketplaceAdapter, NormalizedOffer, RuleOperator } from "@/lib/engine/types";
import { marketplaceDetector } from "@/lib/engine/MarketplaceDetector";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untyped = supabase as unknown as { from: (table: string) => any };

export interface AffiliateGenerationResult {
  ok: boolean;
  url: string | null;
  reason?: string;
}

export interface SubIdTargets {
  automationId?: string;
  destination?: string;
  source?: string;
}

export class AffiliateLinkService {
  /**
   * Generate an affiliate link for an offer for a given user.
   * Returns ok=false with a reason when no real integration is available.
   */
  async generate(
    userId: string,
    offer: NormalizedOffer,
    targets?: SubIdTargets,
  ): Promise<AffiliateGenerationResult> {
    if (!offer.canonicalUrl) {
      return { ok: false, url: null, reason: "no_original_url" };
    }

    const { adapter } = marketplaceDetector.detectWithAdapter(offer.canonicalUrl);

    if (adapter.status() === "NOT_CONNECTED") {
      return { ok: false, url: null, reason: "affiliate_integration_unavailable" };
    }

    // Look up the user's active affiliate account for this marketplace
    const account = await this.findAccount(userId, adapter);
    if (!account) {
      return { ok: false, url: null, reason: "no_affiliate_account_configured" };
    }

    const subIds: Record<string, string> = {};
    if (targets?.automationId) subIds["automation"] = targets.automationId;
    if (targets?.destination) subIds["destination"] = targets.destination;
    if (targets?.source) subIds["source"] = targets.source;

    const url = await adapter.generateAffiliateLink(offer.canonicalUrl, {
      accountId: account.id,
      subIds,
    });

    if (!url) {
      return { ok: false, url: null, reason: "affiliate_generation_failed" };
    }

    return { ok: true, url };
  }

  private async findAccount(
    userId: string,
    adapter: MarketplaceAdapter,
  ): Promise<{ id: string; account_name: string; status: string } | null> {
    const slug = adapter.key;
    const { data: mp } = await untyped
      .from("marketplaces")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!mp) return null;

    const { data } = await untyped
      .from("affiliate_accounts")
      .select("id, account_name, status")
      .eq("user_id", userId)
      .eq("marketplace_id", mp.id)
      .eq("status", "active")
      .maybeSingle();

    return data || null;
  }
}

// Re-export for UI convenience (unused type import guard)
export type { RuleOperator };

export const affiliateLinkService = new AffiliateLinkService();
