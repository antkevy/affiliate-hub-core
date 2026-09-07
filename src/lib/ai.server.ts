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
  /** Se true, indica que o conteúdo foi gerado por um template customizado do usuário. */
  hasCustomTemplate?: boolean;
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

  const hasCustomTemplate = Boolean(data.hasCustomTemplate);
  const isCoupon = Boolean(offer.coupon?.trim()) || /cupom|cupons|voucher/i.test(offer.title ?? "");

  const couponDefaultInstruction =
    "Esta captura é sobre um CUPOM DE DESCONTO. Pegue o texto original/título e reescreva-o " +
    "com palavras DIFERENTES e atraentes para o público de afiliados, utilizando o seguinte formato base:\n" +
    "➡️ 🔥 [Título ou chamada sobre o cupom reescrita com palavras diferentes]\n\n" +
    "🔥 [Preço ou Valor do cupom: ex: R$ 60,00]\n" +
    "⚡ [Desconto] OFF\n" +
    "🏷️ Cupom: `[Código do cupom, se houver]`\n\n" +
    "🛒 [Link]\n" +
    "O código do cupom deve ficar entre crases para ser copiável com 1 toque no Telegram. Reescreva com palavras diferentes. Use emojis com moderação (sem exagerar). Omita a linha de cupom apenas se não houver código. " +
    'Se o cupom incluir moedas do AliExpress (ex.: "BRFS8 + 581 moedas no APP"), mantenha a informação de moedas completa na mesma linha de cupom.';

  const defaultInstruction =
    "Escreva em português do Brasil, tom persuasivo para canal de ofertas. " +
    "Use exatamente este formato, linha por linha (troque tudo entre {} pelos valores reais):\n" +
    "➡️ {titulo}\n\n" +
    "🔥 {preco}\n" +
    "⚡ {desconto} OFF\n" +
    "🏷️ Cupom: {cupom}\n\n" +
    "🛒 {link}\n" +
    "Use emojis com moderação (sem exagerar). Omita a linha de desconto se não houver " +
    "desconto e a linha de cupom se não houver cupom; se não houver nem cupom nem desconto, " +
    "deixe apenas título, preço e link. Se o cupom incluir moedas do AliExpress (ex.: " +
    '"BRFS8 + 581 moedas no APP"), mantenha o trecho de moedas completo na linha de cupom.';

  const templateInstruction =
    'Reescreva a mensagem SEGUINDO EXATAMENTE o template abaixo ("Mensagem original do template do usuário"), ' +
    "mantendo as mesmas linhas, emojis, formatação e ordem. Não invente linhas nem altere a " +
    'estrutura; apenas corrija as inconsistências com os dados reais da oferta. Valores "—" ' +
    "significam dado ausente: remova a linha inteira. Se não houver nem cupom nem desconto, " +
    "mantenha apenas o restante. Mantenha a informação de moedas/bônus do AliExpress " +
    '(ex.: "581 moedas no APP") quando presente no cupom.';

  const userInstruction = data.instruction?.trim();
  const instruction = hasCustomTemplate
    ? userInstruction
      ? `${templateInstruction}\n\nInstrução adicional de estilo do usuário: ${userInstruction}`
      : templateInstruction
    : userInstruction || (isCoupon ? couponDefaultInstruction : defaultInstruction);

  if (hasCustomTemplate && data.content) {
    parts.push(`\nMensagem original do template do usuário:\n${data.content}`);
  }

  const templateSystemPrompt =
    "Você é um copywriter de ofertas afiliadas. O usuário configurou um TEMPLATE PERSONALIZADO " +
    "para suas publicações. Sua ÚNICA tarefa é reproduzir a mensagem final copiando EXATAMENTE a estrutura, " +
    'emojis, linhas e ordem do template do usuário fornecido em "Mensagem original do template do usuário", ' +
    'preenchendo os dados reais da oferta e removendo apenas linhas cujo valor está ausente ("—"). ' +
    "NÃO altere nem desobedeça a estrutura do template criado pelo usuário. Responda apenas com a mensagem final pronta para publicação, sem comentários.";

  const couponSystemPrompt =
    "Você é um copywriter de elite para canais de ofertas de afiliados. " +
    "Quando a captura for sobre CUPOM, você deve PEGAR O TEXTO ORIGINAL E REESCREVER " +
    "a chamada com palavras DIFERENTES e atraentes, estruturando no padrão base:\n" +
    "➡️ 🔥 [Título ou chamada reescrita com palavras diferentes]\n\n" +
    "🔥 [Preço ou Valor do cupom]\n" +
    "⚡ [Desconto] OFF\n" +
    "🏷️ Cupom: `[Código do cupom (se houver)]`\n\n" +
    "🛒 [Link]\n" +
    "Coloque o código do cupom entre crases. Utilize emojis moderados (sem exageros). Responda apenas com a mensagem final pronta para publicação no Telegram/WhatsApp, sem comentários. " +
    'Se o cupom tiver moedas do AliExpress (ex.: "BRFS8 + 581 moedas no APP"), mantenha a informação de moedas na linha de cupom.';

  const generalSystemPrompt =
    "Você é um copywriter de ofertas afiliadas. Recebe apenas os dados de uma oferta e deve " +
    "produzir a mensagem final pronta para publicação em um canal do Telegram/WhatsApp " +
    "seguindo a estrutura:\n" +
    "➡️ [Título]\n\n" +
    "🔥 [Preço]\n" +
    "⚡ [Desconto] OFF\n" +
    "🏷️ Cupom: [Cupom]\n\n" +
    "🛒 [Link]\n" +
    "Omita a linha de desconto se não houver desconto e a linha de cupom se não houver " +
    "cupom; se não houver nem cupom nem desconto, deixe apenas título, preço e link. Se o " +
    'cupom tiver moedas do AliExpress (ex.: "BRFS8 + 581 moedas no APP"), mantenha a ' +
    "informação de moedas na linha de cupom. Sem " +
    "comentários adicionais, usando emojis moderados e sem exagero.";

  const systemPrompt = hasCustomTemplate
    ? templateSystemPrompt
    : isCoupon
      ? couponSystemPrompt
      : generalSystemPrompt;

  try {
    const client = new Groq({ apiKey });
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.7,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content: systemPrompt,
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
