import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];

export type Automation = T["automations"]["Row"];
export type AutomationInsert = T["automations"]["Insert"];
export type AutomationUpdate = T["automations"]["Update"];
export type AutomationRule = T["automation_rules"]["Row"];
export type AutomationRuleInsert = T["automation_rules"]["Insert"];

export type EntityStatus = Database["public"]["Enums"]["entity_status"];

export const ENTITY_STATUS_LABEL: Record<EntityStatus, string> = {
  active: "Ativa",
  paused: "Pausada",
  error: "Erro",
};

export type AutomationRuleType =
  | "marketplace"
  | "price"
  | "discount"
  | "category"
  | "keywords"
  | "coupon"
  | "source"
  | "schedule"
  | "quantity";

export const AUTOMATION_RULE_TYPES: { value: AutomationRuleType; label: string }[] = [
  { value: "marketplace", label: "Marketplace" },
  { value: "price", label: "Preço" },
  { value: "discount", label: "Desconto" },
  { value: "category", label: "Categoria" },
  { value: "keywords", label: "Palavras-chave" },
  { value: "coupon", label: "Cupom" },
  { value: "source", label: "Origem" },
  { value: "schedule", label: "Horário" },
  { value: "quantity", label: "Quantidade" },
];

export const RULE_OPERATORS: { value: string; label: string }[] = [
  { value: "eq", label: "igual a" },
  { value: "neq", label: "diferente de" },
  { value: "gt", label: "maior que" },
  { value: "gte", label: "maior ou igual a" },
  { value: "lt", label: "menor que" },
  { value: "lte", label: "menor ou igual a" },
  { value: "contains", label: "contém" },
  { value: "not_contains", label: "não contém" },
];
