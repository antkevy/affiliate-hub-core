import type { Automation, Json } from "@/types";

export interface AutomationConfigValues {
  interval_minutes: number | null;
  ai_enabled: boolean;
  ai_instruction: string;
  include_banner: boolean;
  banner_id: string | null;
  cta_enabled: boolean;
  cta_mode: "manual" | "random" | null;
  cta_manual: string;
  cta_random: string;
  post_days: string;
  post_start: string;
  post_end: string;
}

const EMPTY: AutomationConfigValues = {
  interval_minutes: null,
  ai_enabled: true,
  ai_instruction: "",
  include_banner: false,
  banner_id: null,
  cta_enabled: false,
  cta_mode: null,
  cta_manual: "",
  cta_random: "",
  post_days: "",
  post_start: "",
  post_end: "",
};

export function automationConfigOf(automation: Automation): AutomationConfigValues {
  const config = (automation.configuration ?? {}) as Record<string, unknown>;
  return {
    interval_minutes:
      typeof config["interval_minutes"] === "number" ? config["interval_minutes"] : null,
    ai_enabled: config["ai_enabled"] !== false,
    ai_instruction: typeof config["ai_instruction"] === "string" ? config["ai_instruction"] : "",
    include_banner: config["include_banner"] === true,
    banner_id: typeof config["banner_id"] === "string" ? config["banner_id"] : null,
    cta_enabled: config["cta_enabled"] === true,
    cta_mode:
      config["cta_mode"] === "manual" || config["cta_mode"] === "random"
        ? config["cta_mode"]
        : null,
    cta_manual: Array.isArray(config["cta_manual"])
      ? (config["cta_manual"] as string[]).join("\n")
      : "",
    cta_random: Array.isArray(config["cta_random"])
      ? (config["cta_random"] as string[]).join("\n")
      : "",
    post_days: Array.isArray(config["post_days"])
      ? (config["post_days"] as number[]).join(",")
      : "",
    post_start: typeof config["post_start"] === "string" ? config["post_start"] : "",
    post_end: typeof config["post_end"] === "string" ? config["post_end"] : "",
  };
}

export function automationConfigValues(config: AutomationConfigValues): Json {
  return {
    interval_minutes: config.interval_minutes,
    ai_enabled: config.ai_enabled,
    ai_instruction: config.ai_instruction.trim() || null,
    include_banner: config.include_banner,
    banner_id: config.banner_id || null,
    cta_enabled: config.cta_enabled,
    cta_mode: config.cta_mode,
    cta_manual: parseLines(config.cta_manual),
    cta_random: parseLines(config.cta_random),
    post_days: parseDays(config.post_days),
    post_start: config.post_start || null,
    post_end: config.post_end || null,
  };
}

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Converte "0,1,3" (0=domingo) em números 0..6. */
function parseDays(value: string): number[] | null {
  const days = value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);
  if (days.length === 0) return null;
  return [...new Set(days)].sort((a, b) => a - b);
}

export { EMPTY as EMPTY_AUTOMATION_CONFIG };
