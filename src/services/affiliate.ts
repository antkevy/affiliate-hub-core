import { createCrud, notImplemented } from "./base";
import { supabase } from "@/integrations/supabase/client";
import type { Marketplace } from "@/types";

export const affiliateLinksService = {
  ...createCrud("affiliate_links"),

  /** Conversão real de URL para link de afiliado via API do marketplace. */
  generate(): never {
    return notImplemented("geração de links de afiliado");
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
