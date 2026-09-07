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

export interface AIInstructionPreset {
  id: string;
  label: string;
  hint: string;
  instruction: string;
}

/** Presets de instrução para a aba de IA do monitor. */
export const AI_INSTRUCTION_PRESETS: AIInstructionPreset[] = [
  {
    id: "padrao",
    label: "Padrão (cupom, moedas e desconto)",
    hint: "Formato completo, mantém moedas do AliExpress no cupom.",
    instruction: [
      "Escreva em português do Brasil, tom persuasivo para canal de ofertas. Use exatamente este formato, linha por linha (troque tudo entre { } pelos valores reais):",
      "➡️ {titulo}",
      "",
      "🔥 {preco}",
      "⚡ {desconto} OFF",
      "🏷️ Cupom: {cupom}",
      "",
      "🛒 {link}",
      'Use emojis com moderação (sem exagerar). Omita a linha de desconto se não houver desconto e a linha de cupom se não houver cupom; se não houver nem cupom nem desconto, deixe apenas título, preço e link. Se o cupom incluir moedas do AliExpress (ex.: "BRFS8 + 581 moedas no APP"), mantenha a informação de moedas completa na mesma linha de cupom.',
    ].join("\n"),
  },
  {
    id: "urgente",
    label: "Urgência / relâmpago",
    hint: "Forte senso de escassez e apelo rápido.",
    instruction: [
      "Escreva em português do Brasil com senso de URGÊNCIA e escassez, ideal para ofertas relâmpago. Use a estrutura por linha:",
      "➡️ {titulo}",
      "🔥 {preco}",
      "⚡ {desconto} OFF",
      "🏷️ Cupom: {cupom}",
      "🛒 {link}",
      'Use expressões como "só até", "corre", "estoque limitado" sem exagerar. Emojis moderados. Omita linhas de cupom/desconto sem valor e mantenha moedas do AliExpress (ex.: "581 moedas no APP") na linha de cupom quando houver.',
    ].join("\n"),
  },
  {
    id: "direto",
    label: "Limpo e direto",
    hint: "Objetivo, sem floreios.",
    instruction: [
      "Escreva em português do Brasil, objetivo e sem rodeios. Use a estrutura por linha:",
      "➡️ {titulo}",
      "🔥 {preco}",
      "⚡ {desconto} OFF",
      "🏷️ Cupom: {cupom}",
      "🛒 {link}",
      "Emojis mínimos. Omita linhas de cupom/desconto sem valor; mantenha moedas do AliExpress na linha de cupom quando houver.",
    ].join("\n"),
  },
];

/** Instrução padrão usada como pré-configuração (cupom/moedas/desconto). */
export const AI_DEFAULT_INSTRUCTION = AI_INSTRUCTION_PRESETS[0]!.instruction;

export function configurationOf(monitor: Monitor): MonitorConfiguration {
  const config = (monitor.configuration ?? {}) as MonitorConfiguration;
  return { ...config, ai_enabled: config.ai_enabled ?? true };
}

export function buildConfiguration(values: MonitorFormValues): Json {
  const sanitizeId = (id: string | null) => (id && id !== "none" ? id : null);
  return {
    source_ids: values.source_ids,
    marketplace_ids: values.marketplace_ids,
    destination_id: sanitizeId(values.destination_id),
    template_id: sanitizeId(values.template_id),
    min_discount: values.min_discount,
    max_price: values.max_price,
    keywords: parseKeywords(values.keywords),
    blocked_keywords: parseKeywords(values.blocked_keywords),
    spacing_minutes: values.spacing_minutes,
    ai_enabled: values.ai_enabled,
    ai_instruction: values.ai_instruction.trim() || null,
    include_banner: values.include_banner,
    banner_id: sanitizeId(values.banner_id),
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
    ai_enabled: config.ai_enabled ?? true,
    ai_instruction: config.ai_instruction ?? AI_DEFAULT_INSTRUCTION,
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
