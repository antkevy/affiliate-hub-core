import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];

export type Monitor = T["monitors"]["Row"];
export type MonitorInsert = T["monitors"]["Insert"];
export type MonitorUpdate = T["monitors"]["Update"];

export interface MonitorConfiguration {
  /** Fontes (grupos/canais) que o monitor acompanha. Vazio = nenhuma. */
  source_ids?: string[];
  /** Marketplaces permitidos. Vazio = todos os marketplaces. */
  marketplace_ids?: string[];
  destination_id?: string | null;
  template_id?: string | null;
  min_discount?: number | null;
  max_price?: number | null;
  keywords?: string[];
  /** Palavras que excluem a oferta (blacklist). Caixa e acento são ignorados. */
  blocked_keywords?: string[];
  /**
   * Espaço mínimo entre publicações (minutos), para evitar spam.
   * 1 = no máximo 1 oferta por ciclo. Só publica ofertas novas além do intervalo.
   */
  spacing_minutes?: number | null;
  notes?: string | null;
}
