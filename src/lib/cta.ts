import { normalizeText } from "@/lib/affiliate-converter";

export interface CtaValues {
  enabled: boolean;
  mode: "manual" | "random" | null;
  /** Entradas no formato "palavra => frase" (modo manual). */
  manual: string[];
  /** Frases sorteadas (modo random). */
  random: string[];
}

export const EMPTY_CTA: CtaValues = {
  enabled: false,
  mode: null,
  manual: [],
  random: [],
};

/**
 * Escolhe a chamada para ação (CTA) para uma oferta.
 * - manual: procura uma palavra-chave no título (ex.: "notebook => Nota: oferta do dia").
 * - random: sorteia uma frase da lista.
 * Retorna null quando não configurado ou sem correspondência.
 */
export function pickCta(values: CtaValues, title?: string | null): string | null {
  if (!values.enabled) return null;

  if (values.mode === "manual" && values.manual.length > 0 && title) {
    const normalized = normalizeText(title);
    for (const entry of values.manual) {
      const [keyword, phrase] = splitRule(entry);
      if (!keyword || !phrase) continue;
      if (normalized.includes(normalizeText(keyword))) return phrase;
    }
    return null;
  }

  if (values.mode === "random" && values.random.length > 0) {
    const phrases = values.random.filter((item) => item.trim());
    if (phrases.length === 0) return null;
    return phrases[Math.floor(Math.random() * phrases.length)] ?? null;
  }

  return null;
}

/** Divide "palavra => frase" em partes limpas ("=>" ou "="). */
export function splitRule(entry: string): [string, string] {
  const separator = entry.match(/\s*(?:=>|=|:)\s*/);
  if (!separator) return [entry.trim(), ""];
  const parts = entry.split(separator[0]);
  return [parts[0]?.trim() ?? "", parts.slice(1).join(separator[0]).trim()];
}

/** Converte entradas livres (ex.: linha de textarea) em um array normalizado. */
export function parseCtaLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
