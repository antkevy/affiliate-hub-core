import { createCrud } from "./base";
import { supabase } from "@/integrations/supabase/client";
import {
  createAffiliateUrl,
  detectMarketplaceUrl,
  type AffiliateConversionOptions,
} from "@/lib/affiliate-converter";
import type { AffiliateAccount, AffiliateLink, Json, Marketplace } from "@/types";

const linksRepo = createCrud("affiliate_links");
const accountsRepo = createCrud("affiliate_accounts");

export const affiliateLinksService = {
  ...createCrud("affiliate_links"),

  /**
   * Converte a URL original em link de afiliado no navegador,
   * usando o ID/tag cadastrado na conta afiliada do marketplace.
   */
  async generate(id: string): Promise<AffiliateLink> {
    const link = await linksRepo.getById(id);
    if (!link) throw new Error("Link não encontrado.");

    const marketplaces = await listMarketplaces();
    const byId = new Map(marketplaces.map((item) => [item.id, item]));
    const detectedSlug = detectMarketplaceUrl(link.original_url);
    let marketplace = link.marketplace_id ? (byId.get(link.marketplace_id) ?? null) : null;
    if (detectedSlug) {
      const matched = marketplaces.find((item) => item.slug?.toLowerCase() === detectedSlug);
      if (matched) marketplace = matched;
    }

    const slug = marketplace?.slug?.toLowerCase() ?? detectedSlug;
    const accounts = await accountsRepo.list();
    const account: AffiliateAccount | undefined = accounts.find(
      (item) => item.marketplace_id === marketplace?.id && item.status === "connected",
    );
    const trackingId = readTrackingId(account?.configuration ?? null);

    const options: AffiliateConversionOptions = { marketplaceSlug: slug, trackingId };
    if (trackingId) options.store = trackingId;

    const result = createAffiliateUrl(link.original_url, options);

    if (result.method === "original") {
      await linksRepo.update(id, { status: "error" });
      throw new Error(result.note ?? "Não foi possível gerar o link de afiliado.");
    }

    try {
      await linksRepo.update(id, {
        affiliate_url: result.url,
        marketplace_id: marketplace?.id ?? link.marketplace_id ?? null,
        status: "generated",
      });
    } catch (error) {
      await linksRepo.update(id, { status: "error" }).catch(() => undefined);
      throw error;
    }
    return (await linksRepo.getById(id)) ?? link;
  },
};

export const affiliateAccountsService = createCrud("affiliate_accounts");

export async function listMarketplaces(): Promise<Marketplace[]> {
  const { data, error } = await supabase
    .from("marketplaces")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Extrai o ID/tag de afiliado do JSON de configuração da conta. */
function readTrackingId(configuration: Json | null): string | null {
  if (!configuration || typeof configuration !== "object") return null;
  const record = configuration as Record<string, unknown>;
  for (const key of ["tag", "tracking_id", "trackingId", "affiliate_id", "affiliateId"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
