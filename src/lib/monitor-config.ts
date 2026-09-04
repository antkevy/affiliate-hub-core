import type { Json, Monitor, MonitorConfiguration } from "@/types";

export interface MonitorFormValues {
  name: string;
  source_id: string | null;
  marketplace_id: string | null;
  destination_id: string | null;
  template_id: string | null;
  min_discount: number | null;
  max_price: number | null;
  keywords: string;
  notes: string;
}

export function configurationOf(monitor: Monitor): MonitorConfiguration {
  return (monitor.configuration ?? {}) as MonitorConfiguration;
}

export function buildConfiguration(values: MonitorFormValues): Json {
  return {
    marketplace_id: values.marketplace_id || null,
    destination_id: values.destination_id || null,
    template_id: values.template_id || null,
    min_discount: values.min_discount,
    max_price: values.max_price,
    keywords: parseKeywords(values.keywords),
    notes: values.notes || null,
  };
}

export function initialForm(monitor: Monitor | null | undefined): MonitorFormValues {
  const config = (monitor?.configuration ?? {}) as MonitorConfiguration;
  return {
    name: monitor?.name ?? "",
    source_id: monitor?.source_id ?? "",
    marketplace_id: config.marketplace_id ?? "",
    destination_id: config.destination_id ?? "",
    template_id: config.template_id ?? "",
    min_discount: config.min_discount ?? null,
    max_price: config.max_price ?? null,
    keywords: (config.keywords ?? []).join(", "),
    notes: config.notes ?? "",
  };
}

function parseKeywords(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
