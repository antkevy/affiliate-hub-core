export type IntegrationKind = "channel" | "marketplace";

export type IntegrationState = "not_configured" | "disconnected" | "error";

export interface IntegrationField {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  helper?: string;
}

export interface IntegrationDefinition {
  slug: string;
  name: string;
  kind: IntegrationKind;
  description: string;
  fields: IntegrationField[];
}

export const INTEGRATION_STATE_LABEL: Record<IntegrationState, string> = {
  not_configured: "Não configurada",
  disconnected: "Desconectada",
  error: "Erro",
};
