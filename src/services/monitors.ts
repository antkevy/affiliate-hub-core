import { createCrud, notImplemented } from "./base";
import { supabase } from "@/integrations/supabase/client";

export const monitorsService = {
  ...createCrud("monitors"),

  async activate(id: string) {
    return this.update(id, { status: "active" });
  },

  async pause(id: string) {
    return this.update(id, { status: "paused" });
  },

  /** Total de ofertas capturadas por fonte, para exibir na lista de monitores. */
  async offerCounts(): Promise<Record<string, number>> {
    const { data, error } = await supabase.from("offers").select("source_id");
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = {};
    for (const offer of data ?? []) {
      if (offer.source_id) counts[offer.source_id] = (counts[offer.source_id] ?? 0) + 1;
    }
    return counts;
  },

  /** Monitoramento real de fontes (Telegram, WhatsApp, feeds, APIs). */
  start(): never {
    return notImplemented("monitoramento de fontes");
  },
};
