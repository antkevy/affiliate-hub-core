import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];

export type Offer = T["offers"]["Row"];
export type OfferInsert = T["offers"]["Insert"];
export type OfferUpdate = T["offers"]["Update"];
export type OfferStatus = Database["public"]["Enums"]["offer_status"];

export type OfferMedia = T["offer_media"]["Row"];
export type MediaType = Database["public"]["Enums"]["media_type"];

export type Product = T["products"]["Row"];
export type ProductInsert = T["products"]["Insert"];

export const OFFER_STATUSES: OfferStatus[] = [
  "captured",
  "processing",
  "processed",
  "approved",
  "rejected",
  "published",
  "error",
];

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  captured: "Capturada",
  processing: "Processando",
  processed: "Processada",
  approved: "Aprovada",
  rejected: "Rejeitada",
  published: "Publicada",
  error: "Erro",
};
