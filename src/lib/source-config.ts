import { SOURCE_TYPES, type Json, type Source, type SourceType } from "@/types";

export interface SourceFormValues {
  name: string;
  type: SourceType;
  identifier: string;
  notes: string;
}

export const SOURCE_IDENTIFIER_HINTS: Record<SourceType, string> = {
  telegram: "@canal ou link de convite",
  whatsapp: "Link do grupo ou número",
  amazon: "ASINs ou links de produto (um por linha)",
  api: "URL base da API",
  feed: "https://exemplo.com/feed.xml",
  manual: "Referência de identificação",
};

export function sourceConfiguration(source: Source): { notes?: string } {
  return typeof source.configuration === "object" && source.configuration !== null
    ? (source.configuration as { notes?: string })
    : {};
}

export function buildSourceConfiguration(values: SourceFormValues): Json {
  return { notes: values.notes.trim() ? values.notes.trim() : null };
}

export function initialSourceForm(source: Source | null | undefined): SourceFormValues {
  if (!source) {
    return {
      name: "",
      type: SOURCE_TYPES[0]!.value,
      identifier: "",
      notes: "",
    };
  }
  return {
    name: source.name,
    type: source.type,
    identifier: source.identifier ?? "",
    notes: sourceConfiguration(source).notes ?? "",
  };
}
