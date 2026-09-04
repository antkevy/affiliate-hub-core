import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];

export type Monitor = T["monitors"]["Row"];
export type MonitorInsert = T["monitors"]["Insert"];
export type MonitorUpdate = T["monitors"]["Update"];

export interface MonitorConfiguration {
  marketplace_id?: string | null;
  destination_id?: string | null;
  template_id?: string | null;
  min_discount?: number | null;
  max_price?: number | null;
  keywords?: string[];
  notes?: string | null;
}
