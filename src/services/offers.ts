import { createCrud } from "./base";
import { supabase } from "@/integrations/supabase/client";
import { runCapture, type CaptureReport } from "@/lib/capture";
import type { Offer, OfferMedia } from "@/types";

export const offersService = {
  ...createCrud("offers"),

  async listWithRelations(filters: {
    search?: string;
    status?: string;
    marketplaceId?: string;
    orderBy?: string;
    ascending?: boolean;
  }): Promise<(Offer & { image_url?: string | null })[]> {
    let query = supabase
      .from("offers")
      .select("*, products (image_url), offer_media (url, position)")
      .order(filters.orderBy ?? "created_at", { ascending: filters.ascending ?? false });

    if (filters.status) query = query.eq("status", filters.status as Offer["status"]);
    if (filters.marketplaceId) query = query.eq("marketplace_id", filters.marketplaceId);
    if (filters.search) query = query.ilike("title", `%${filters.search}%`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => {
      const record = row as unknown as Record<string, unknown>;
      const { offer_media: media, products, ...offer } = record;
      return {
        ...offer,
        image_url:
          firstOfferImage(media) ??
          (products as { image_url?: string | null } | null)?.image_url ??
          (offer["image_url"] as string | null) ??
          null,
      };
    }) as Offer[];
  },

  async media(offerId: string): Promise<OfferMedia[]> {
    const { data, error } = await supabase
      .from("offer_media")
      .select("*")
      .eq("offer_id", offerId)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Remove todas as ofertas capturadas do usuário atual e retorna quantas foram removidas. */
  async clearAll(): Promise<number> {
    const { data, error } = await supabase.from("offers").delete().select("id");
    if (error) throw new Error(error.message);
    return (data ?? []).length;
  },

  /** Captura automática a partir de fontes monitoradas. */
  captureFromSource(): Promise<CaptureReport> {
    return runCapture();
  },
};

export const productsService = createCrud("products");
export const offerMediaService = createCrud("offer_media");

/** Primeira imagem de `offer_media` (ordenada por position) de uma oferta. */
function firstOfferImage(media: unknown): string | null {
  if (!Array.isArray(media) || media.length === 0) return null;
  return (
    [...(media as Array<{ url?: string | null; position?: number | null }>)]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .find((item) => typeof item.url === "string" && item.url.trim().length > 0)
      ?.url?.trim() ?? null
  );
}
