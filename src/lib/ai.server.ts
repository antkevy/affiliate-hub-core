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
  raw_message?: string | null;
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
    offer.raw_message
      ? `\nTexto/Mensagem original capturada do concorrente:\n"""\n${offer.raw_message}\n"""`
      : null,
  ].filter((line): line is string => Boolean(line));

  const hasCustomTemplate = Boolean(data.hasCustomTemplate);
  const isCoupon = Boolean(offer.coupon?.trim()) || /cupom|cupons|voucher/i.test(offer.title ?? "");

  const couponDefaultInstruction =
    "Esta captura é sobre um CUPOM DE DESCONTO. Pegue o texto original/título e reescreva-o " +
    "com palavras DIFERENTES e atraentes para o público de afiliados, utilizando o seguinte formato base:\n" +
    "➡️ 🔥 [Título ou chamada sobre o cupom reescrita com palavras diferentes]\n\n" +
    "✅ [Preço ou Valor do cupom: ex: R$ 60,00]\n" +
    "⚡ [Desconto] OFF\n" +
    "🏷️ Cupom: `[Código do cupom, se houver]`\n\n" +
    "🛒 [Link]\n" +
    "IMPORTANTE: Analise a mensagem capturada do concorrente para identificar qualquer informação adicional " +
    "(múltiplos cupons ex: 'BRFS1 ou IFPJOE0C', moedas no app ex: '741 moedas no APP', orientação de abas ex: 'aba Moedas ou BRASIL no APP', cupons de loja). " +
    "REAMODELE E INCLUA TODAS ESSAS INFORMAÇÕES na mensagem, colocando CADA CÓDIGO DE CUPOM INDIVIDUALMENTE ENTRE CRASES (ex: `BRFS1` ou `IFPJOE0C`).";

  const defaultInstruction =
    "Escreva em português do Brasil, tom persuasivo para canal de ofertas. " +
    "Siga estritamente este formato base, linha por linha (preenchendo com os dados reais):\n" +
    "➡️ {titulo}\n\n" +
    "✅ {preco}\n" +
    "⚡ {desconto} OFF\n" +
    "🏷️ Cupom: {cupom}\n\n" +
    "🛒 {link}\n" +
    "REAMODELAGEM DE CONTEÚDO ADICIONAL: Analise a mensagem capturada do concorrente. Se houver informações " +
    "adicionais (como múltiplos cupons ex: 'BRFS1 ou IFPJOE0C', moedas no aplicativo ex: '741 moedas no APP', " +
    "orientações de abas ex: 'aba Moedas ou BRASIL no APP', cupons de loja ou frete grátis), REAMODELE E INCLUA " +
    "essas informações na mensagem (de preferência na linha do cupom ou em destaques logo acima do link). " +
    "Coloque CADA CÓDIGO DE CUPOM INDIVIDUALMENTE ENTRE CRASES (ex: `BRFS1` ou `IFPJOE0C`) para cópia de 1 toque no Telegram. " +
    "Omita a linha de desconto se não houver desconto e a linha de cupom se não houver cupom.";

  const templateInstruction =
    'Reescreva a mensagem SEGUINDO O TEMPLATE DO USUÁRIO em "Mensagem original do template do usuário", ' +
    "mantendo a estrutura e ordem. Analise a mensagem capturada do concorrente para reamodelar qualquer " +
    "informação adicional (cupons, moedas, abas do app) de forma harmônica, " +
    'envolvendo CADA CÓDIGO DE CUPOM INDIVIDUALMENTE ENTRE CRASES (ex: `BRFS1` ou `IFPJOE0C`).';

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
    "Você é um copywriter de ofertas afiliadas. O usuário configurou um TEMPLATE PERSONALIZADO. " +
    "Sua tarefa é reproduzir a mensagem final copiando a estrutura do template, preenchendo os dados reais " +
    "e REAMODELANDO qualquer informação adicional (múltiplos cupons, moedas no app, abas do app, cupons de loja) " +
    "presentes na mensagem capturada. Coloque CADA CÓDIGO DE CUPOM INDIVIDUALMENTE ENTRE CRASES para cópia de 1 toque no Telegram. " +
    "Responda apenas com a mensagem final pronta para publicação, sem comentários.";

  const couponSystemPrompt =
    "Você é um copywriter de elite para canais de ofertas de afiliados. " +
    "Quando a captura for sobre CUPOM, reescreva a chamada de forma atraente no formato base:\n" +
    "➡️ 🔥 [Título ou chamada reescrita]\n\n" +
    "✅ [Preço ou Valor do cupom]\n" +
    "⚡ [Desconto] OFF\n" +
    "🏷️ Cupom: `[Código do cupom]`\n\n" +
    "🛒 [Link]\n" +
    "REAMODELAGEM DE CONTEÚDO: Coloque CADA CÓDIGO DE CUPOM INDIVIDUALMENTE ENTRE CRASES (ex: `BRFS1` ou `IFPJOE0C`). " +
    "Se a mensagem capturada contiver moedas do app, cupons de loja ou instrução de abas (ex: 'aba de Moedas ou BRASIL somente pelo APP'), " +
    "REAMODELE E INCLUA essas informações na mensagem final. Responda apenas com a mensagem pronta para envio.";

  const generalSystemPrompt =
    "Você é um copywriter de elite para canais de ofertas de afiliados. " +
    "Sua função é PREVALECER na formatação e reescrita de todas as mensagens capturadas, " +
    "garantindo um visual extremamente profissional, atraente e organizado.\n\n" +
    "MODELO BASE PADRÃO DE PUBLICAÇÃO:\n" +
    "➡️ [Título atraente e limpo da oferta]\n\n" +
    "✅ [Preço atual formatado em R$]\n" +
    "⚡ [Desconto]% OFF\n" +
    "🏷️ Cupom: [Cupons e informações extras de resgate]\n\n" +
    "🛒 [Link de afiliado]\n\n" +
    "REGRAS DE REAMODELAGEM E PREVALÊNCIA DA IA:\n" +
    "1. MANTENHA O PADRÃO VISUAL: Siga a estrutura limpa com as linhas de Título, Preço, Desconto, Cupom e Link.\n" +
    "2. REAMODELAGEM DE CONTEÚDO ADICIONAL: Examine atentamente o texto original capturado do concorrente/fonte. Se houver informações ou observações adicionais úteis (por exemplo: múltiplos cupons 'BRFS1 ou IFPJOE0C', moedas no aplicativo '741 moedas no app', cupons de loja, frete grátis, orientação de abas 'aba de Moedas ou BRASIL no APP', etc.), REAMODELE E INCLUA TODAS ESSAS INFORMAÇÕES na mensagem final (integrando-as na linha do cupom ou em destaques adicionais acima do link).\n" +
    "3. COPIÁVEL DE 1 TOQUE (CRASES INDIVIDUAIS): Todo e qualquer código de cupom capturado DEVE ser colocado entre crases INDIVIDUAIS (ex: `BRFS1` ou `IFPJOE0C`). Nunca coloque dois cupons na mesma crase.\n" +
    "4. Se a oferta não contiver cupom ou desconto, omita as respectivas linhas sem inventar dados.\n" +
    "5. Responda APENAS com a mensagem final em Markdown formatada pronta para postagem no Telegram, sem introdução, sem saudações e sem comentários.";

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
