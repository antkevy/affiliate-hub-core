import { createCrud } from "./base";
import { supabase } from "@/integrations/supabase/client";
import { runAutomation, type AutomationReport } from "@/lib/capture";
import type { Automation, AutomationRule } from "@/types";

export const automationsService = {
  ...createCrud("automations"),

  async rules(automationId: string): Promise<AutomationRule[]> {
    const { data, error } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("automation_id", automationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async duplicate(automation: Automation): Promise<Automation> {
    const rules = await this.rules(automation.id);
    const created = await this.create({
      name: `${automation.name} (cópia)`,
      description: automation.description,
      status: "paused",
      source_id: automation.source_id,
      destination_id: automation.destination_id,
      template_id: automation.template_id,
      configuration: automation.configuration,
    });
    if (rules.length) {
      const { error } = await supabase.from("automation_rules").insert(
        rules.map((rule) => ({
          automation_id: created.id,
          type: rule.type,
          operator: rule.operator,
          value: rule.value,
          configuration: rule.configuration,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return created;
  },

  /**
   * Executa o fluxo da automação: captura da fonte, aplica o template
   * e publica no destino vinculado.
   */
  async run(id: string): Promise<AutomationReport> {
    const automation = await this.getById(id);
    if (!automation) throw new Error("Automação não encontrada.");
    const config = (automation.configuration ?? {}) as {
      ai_enabled?: boolean;
      ai_instruction?: string | null;
      include_banner?: boolean;
      banner_id?: string | null;
    };
    return runAutomation({
      source_id: automation.source_id,
      destination_id: automation.destination_id,
      template_id: automation.template_id,
      configuration: config,
    });
  },
};

export const automationRulesService = createCrud("automation_rules");
