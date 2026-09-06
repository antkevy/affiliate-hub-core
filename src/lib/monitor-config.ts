import type { Json, Monitor, MonitorConfiguration } from "@/types";

export interface MonitorFormValues {
  name: string;
  source_ids: string[];
  marketplace_ids: string[];
  destination_id: string | null;
  template_id: string | null;
  min_discount: number | null;
  max_price: number | null;
  keywords: string;
  blocked_keywords: string;
  spacing_minutes: number | null;
  ai_enabled: boolean;
  ai_instruction: string;
  include_banner: boolean;
  banner_id: string | null;
  notes: string;
}

export function configurationOf(monitor: Monitor): MonitorConfiguration {
  return (monitor.configuration ?? {}) as MonitorConfiguration;
}

export function buildConfiguration(values: MonitorFormValues): Json {
  return {
    source_ids: values.source_ids,
    marketplace_ids: values.marketplace_ids,
    destination_id: values.destination_id || null,
    template_id: values.template_id || null,
    min_discount: values.min_discount,
    max_price: values.max_price,
    keywords: parseKeywords(values.keywords),
    blocked_keywords: parseKeywords(values.blocked_keywords),
    spacing_minutes: values.spacing_minutes,
    ai_enabled: values.ai_enabled,
    ai_instruction: values.ai_instruction.trim() || null,
    include_banner: values.include_banner,
    banner_id: values.banner_id || null,
    notes: values.notes || null,
  };
}

export function initialForm(monitor: Monitor | null | undefined): MonitorFormValues {
  const config = (monitor?.configuration ?? {}) as MonitorConfiguration;
  return {
    name: monitor?.name ?? "",
    source_ids: config.source_ids ?? [],
    marketplace_ids: config.marketplace_ids ?? [],
    destination_id: config.destination_id ?? null,
    template_id: config.template_id ?? null,
    min_discount: config.min_discount ?? null,
    max_price: config.max_price ?? null,
    keywords: (config.keywords ?? []).join(", "),
    blocked_keywords: (config.blocked_keywords ?? []).join(", "),
    spacing_minutes: config.spacing_minutes ?? null,
    ai_enabled: config.ai_enabled ?? false,
    ai_instruction: config.ai_instruction ?? "",
    include_banner: config.include_banner ?? false,
    banner_id: config.banner_id ?? null,
    notes: config.notes ?? "",
  };
}

function parseKeywords(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
