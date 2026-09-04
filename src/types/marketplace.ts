import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];

export type Marketplace = T["marketplaces"]["Row"];
export type AffiliateAccount = T["affiliate_accounts"]["Row"];
export type AffiliateAccountInsert = T["affiliate_accounts"]["Insert"];
export type AffiliateLink = T["affiliate_links"]["Row"];
export type AffiliateLinkInsert = T["affiliate_links"]["Insert"];
export type LinkStatus = Database["public"]["Enums"]["link_status"];
export type AccountStatus = Database["public"]["Enums"]["account_status"];

export const LINK_STATUS_LABEL: Record<LinkStatus, string> = {
  pending: "Pendente",
  generated: "Gerado",
  error: "Erro",
};
