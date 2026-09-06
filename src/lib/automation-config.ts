import type { Automation, Json } from "@/types";

export interface AutomationConfigValues {
  interval_minutes: number | null;
  ai_enabled: boolean;
  ai_instruction: string;
  include_banner: boolean;
  banner_id: string | null;
}

const EMPTY: AutomationConfigValues = {
  interval_minutes: null,
  ai_enabled: false,
  ai_instruction: "",
  include_banner: false,
  banner_id: null,
};

export function automationConfigOf(automation: Automation): AutomationConfigValues {
  const config = (automation.configuration ?? {}) as Record<string, unknown>;
  return {
    interval_minutes:
      typeof config["interval_minutes"] === "number" ? config["interval_minutes"] : null,
    ai_enabled: config["ai_enabled"] === true,
    ai_instruction: typeof config["ai_instruction"] === "string" ? config["ai_instruction"] : "",
    include_banner: config["include_banner"] === true,
    banner_id: typeof config["banner_id"] === "string" ? config["banner_id"] : null,
  };
}

export function automationConfigValues(config: AutomationConfigValues): Json {
  return {
    interval_minutes: config.interval_minutes,
    ai_enabled: config.ai_enabled,
    ai_instruction: config.ai_instruction.trim() || null,
    include_banner: config.include_banner,
    banner_id: config.banner_id || null,
  };
}

export { EMPTY as EMPTY_AUTOMATION_CONFIG };
