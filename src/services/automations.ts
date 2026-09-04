import { createCrud, notImplemented } from "./base";
import { supabase } from "@/integrations/supabase/client";
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

  /** Execução real do fluxo da automação. */
  run(): never {
    return notImplemented("execução de automações");
  },
};

export const automationRulesService = createCrud("automation_rules");
