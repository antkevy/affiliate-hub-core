import { createServerFn } from "@tanstack/react-start";
import Groq from "groq-sdk";

/** Dados da oferta que a IA pode usar para reescrever a mensagem. */
export interface AIOfferInput {
  title: string;
  sale_price: number | null;
  original_price: number | null;
  discount_percentage: number | null;
  coupon: string | null;
  marketplace?: string;
  url: string | null;
}

export interface AIFormatPayload {
  offer: AIOfferInput;
  /** Conteúdo original (template renderizado) para a IA melhorar. */
  content: string;
  /** Instrução opcional de estilo/idioma/emoji. */
  instruction?: string | null;
}

export interface AIFormatResult {
  ok: boolean;
  text?: string;
  error?: string;
}

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

/**
 * Reescreve a mensagem de uma oferta usando o Groq (modelos GPT/Llama).
 * Roda no servidor para proteger a API key. Sem chave configurada, retorna
 * ok=false e o pipeline cai no template padrão.
 */
export const formatOfferWithAI = createServerFn({ method: "POST" })
  .validator((payload: AIFormatPayload) => payload)
  .handler(async ({ data }): Promise<AIFormatResult> => rewriteOfferWithAI(data));

/** Núcleo reutilizável por server fn e pelo job agendado do servidor. */
export async function rewriteOfferWithAI(data: AIFormatPayload): Promise<AIFormatResult> {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    return { ok: false, error: "GROQ_API_KEY não configurada." };
  }

  const model = process.env["GROQ_MODEL"] ?? DEFAULT_MODEL;
  const offer = data.offer;
  const parts = [
    `Título: ${offer.title}`,
    offer.sale_price !== null ? `Preço atual: R$ ${offer.sale_price.toFixed(2)}` : null,
    offer.original_price !== null ? `Preço original: R$ ${offer.original_price.toFixed(2)}` : null,
    offer.discount_percentage !== null ? `Desconto: ${offer.discount_percentage}%` : null,
    offer.coupon ? `Cupom: ${offer.coupon}` : null,
    offer.marketplace ? `Marketplace: ${offer.marketplace}` : null,
    offer.url ? `Link: ${offer.url}` : null,
  ].filter((line): line is string => Boolean(line));

  const instruction =
    data.instruction?.trim() ||
    "Escreva em português do Brasil, tom persuasivo para canal de ofertas, " +
      "use emojis com moderação e destaque o desconto e o preço.";
  if (data.content) parts.push(`\nMensagem original:\n${data.content}`);

  try {
    const client = new Groq({ apiKey });
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.7,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content:
            "Você é um copywriter de ofertas afiliadas. Recebe os dados de uma oferta e " +
            "deve produzir apenas a mensagem final pronta para publicação em um canal do " +
            "Telegram, sem comentários adicionais.",
        },
        {
          role: "user",
          content: [
            `Instrução: ${instruction}`,
            "Dados da oferta:",
            parts.join("\n"),
            "Gere a mensagem final:",
          ].join("\n\n"),
        },
      ],
    });
    const text = completion.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, error: "A IA retornou uma resposta vazia." };
    return { ok: true, text };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao chamar a IA.",
    };
  }
}
