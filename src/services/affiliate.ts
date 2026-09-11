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
   * Invoca a Supabase Edge Function 'generate-affiliate-link' para gerar
   * o link de afiliado do Mercado Livre com sessão/cookies persistidos.
   */
  async generateMercadoLivreLink(url: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke("generate-affiliate-link", {
      body: { url, platform: "mercadolivre" },
    });

    if (error) {
      throw new Error(error.message || "Erro ao invocar a função de geração de link de afiliado.");
    }

    if (data?.error) {
      const err = new Error(data.error);
      if (data.code === "SESSION_EXPIRED") {
        (err as Error & { code?: string }).code = "SESSION_EXPIRED";
      }
      throw err;
    }

    if (!data?.affiliate_url) {
      throw new Error("A função não retornou a URL de afiliado.");
    }

    return data.affiliate_url;
  },

  /**
   * Converte a URL original em link de afiliado no navegador ou via Edge Function.
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

    // Se for Mercado Livre, tenta gerar via Edge Function com suporte a sessão/cookies
    if (slug === "mercadolivre" || slug === "mercado-livre") {
      try {
        const affiliateUrl = await this.generateMercadoLivreLink(link.original_url);
        await linksRepo.update(id, {
          affiliate_url: affiliateUrl,
          marketplace_id: marketplace?.id ?? link.marketplace_id ?? null,
          status: "generated",
        });
        return (await linksRepo.getById(id)) ?? link;
      } catch (mlError) {
        console.warn("Edge function Mercado Livre falhou, tentando conversão local:", mlError);
      }
    }

    const accounts = await accountsRepo.list();
    const account: AffiliateAccount | undefined = accounts.find(
      (item) => item.marketplace_id === marketplace?.id && item.status === "connected",
    );
    const trackingId = readTrackingId(account?.configuration ?? null);

    const options: AffiliateConversionOptions = {
      marketplaceSlug: slug,
      trackingId,
      subid: readSubid(account?.configuration ?? null),
    };
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

/** Extrai o SubID de campanha do JSON de configuração da conta. */
function readSubid(configuration: Json | null): string | null {
  if (!configuration || typeof configuration !== "object") return null;
  const value = (configuration as Record<string, unknown>)["subid"];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
