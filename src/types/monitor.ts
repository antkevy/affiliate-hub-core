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
  /** Reescreve a mensagem com IA (Groq) antes de publicar. */
  ai_enabled?: boolean;
  /** Instrução de estilo/idioma para a IA. */
  ai_instruction?: string | null;
  /** Gera e anexa um banner (com a imagem do produto) na publicação. */
  include_banner?: boolean;
  /** Banner salvo usado como base visual. Vazio = template padrão. */
  banner_id?: string | null;
  /** Adiciona uma chamada para ação (CTA) no início da publicação. */
  cta_enabled?: boolean;
  /**
   * Modo do CTA: "manual" casa palavras-chave do título com frases;
   * "random" sorteia uma frase da lista.
   */
  cta_mode?: "manual" | "random" | null;
  /** Frases na forma "palavra => frase". Usado no modo manual. */
  cta_manual?: string[];
  /** Frases usadas no modo random. */
  cta_random?: string[];
  /**
   * Dias da semana permitidos para publicar, usando JS Date.getDay()
   * (0 = domingo ... 6 = sábado). Vazio = todos os dias.
   */
  post_days?: number[];
  /** Início da janela de publicação no formato "HH:MM" (horário local). */
  post_start?: string | null;
  /** Fim da janela de publicação no formato "HH:MM". Integra madrugada ("22:00" → "06:00"). */
  post_end?: string | null;
  notes?: string | null;
}
