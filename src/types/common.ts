import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type Json = Database["public"]["Tables"]["automations"]["Row"]["configuration"];

export interface ListParams {
  search?: string;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
}

export type AsyncState = "idle" | "loading" | "error" | "empty" | "ready";
