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
      .select("*, products (image_url)")
      .order(filters.orderBy ?? "created_at", { ascending: filters.ascending ?? false });

    if (filters.status) query = query.eq("status", filters.status as Offer["status"]);
    if (filters.marketplaceId) query = query.eq("marketplace_id", filters.marketplaceId);
    if (filters.search) query = query.ilike("title", `%${filters.search}%`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: Record<string, any>) => ({
      ...row,
      image_url: (row["products"] as { image_url?: string | null } | null)?.image_url ?? (row["image_url"] as string | null) ?? null,
    })) as Offer[];
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

  /** Captura automática a partir de fontes monitoradas. */
  captureFromSource(): Promise<CaptureReport> {
    return runCapture();
  },
};

export const productsService = createCrud("products");
export const offerMediaService = createCrud("offer_media");
