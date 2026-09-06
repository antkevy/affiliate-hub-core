import { createServerFn } from "@tanstack/react-start";

export interface TelegramProxyPayload {
  token: string;
  method: "sendMessage" | "sendPhoto" | "sendMediaGroup";
  chat_id: string;
  text?: string;
  /**
   * Arquivos a anexar. `base64` = bytes enviados pelo cliente (banner renderizado);
   * `url` = baixado pelo servidor (imagem do produto — sem CORS no servidor).
   */
  files?: {
    name: string;
    base64?: string | null;
    url?: string | null;
  }[];
}

export interface TelegramProxyResult {
  ok: boolean;
  error?: string;
}

async function readFile(file: {
  name: string;
  base64?: string | null;
  url?: string | null;
}): Promise<Blob | null> {
  try {
    if (file.base64) {
      const binary = atob(file.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: "image/png" });
    }
    if (!file.url) return null;
    const response = await fetch(file.url);
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    return new Blob([bytes], { type: "image/png" });
  } catch {
    return null;
  }
}

/** Interpreta a resposta do Bot API: objeto {ok} OU array (sendMediaGroup). */
export function parseTelegramResult(
  body: unknown,
  responseOk: boolean,
): { ok: boolean; error?: string } {
  const obj = (Array.isArray(body) ? undefined : body) as
    { ok?: boolean; description?: string } | undefined;
  const ok = Array.isArray(body) ? responseOk : obj?.ok === true;
  if (responseOk && ok) return { ok: true };
  return { ok: false, error: obj?.description ?? "" };
}

async function parseResult(response: Response): Promise<TelegramProxyResult> {
  const body = (await response.json().catch(() => ({}))) as unknown;
  const parsed = parseTelegramResult(body, response.ok);
  const obj = (Array.isArray(body) ? undefined : body) as { description?: string } | undefined;
  if (parsed.ok) return { ok: true };
  return {
    ok: false,
    error: parsed.error ?? obj?.description ?? `Telegram HTTP ${response.status}`,
  };
}

/**
 * Encaminha chamadas ao Bot API do Telegram pelo servidor, eliminando
 * o CORS do navegador (o app roda dentro do iframe do Lovable).
 */
export const callTelegramApi = createServerFn({ method: "POST" })
  .validator((payload: TelegramProxyPayload) => payload)
  .handler(async ({ data }): Promise<TelegramProxyResult> => {
    try {
      const { token, method, chat_id, text } = data;
      const url = `https://api.telegram.org/bot${token}/${method}`;

      if (method === "sendMessage") {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id, text }),
        });
        return await parseResult(response);
      }

      const form = new FormData();
      form.append("chat_id", chat_id);
      const uploaded: { name: string; blob: Blob }[] = [];
      for (const file of data.files ?? []) {
        const blob = await readFile(file);
        if (blob) uploaded.push({ name: file.name, blob });
      }
      if (uploaded.length === 0) {
        return { ok: false, error: "Nenhuma imagem pôde ser carregada." };
      }

      const shortCaption = text ? text.slice(0, 1000) : undefined;
      if (method === "sendPhoto") {
        const first = uploaded[0];
        if (!first) return { ok: false, error: "Nenhuma imagem anexada." };
        form.append("photo", first.blob, first.name);
        if (shortCaption) form.append("caption", shortCaption);
      } else {
        const photos = uploaded.map((item, index) => ({
          type: "photo" as const,
          media: `attach://${item.name}`,
          ...(index === 0 && shortCaption ? { caption: shortCaption } : {}),
        }));
        form.append("media", JSON.stringify(photos));
        for (const item of uploaded) form.append(item.name, item.blob, item.name);
      }

      const response = await fetch(url, { method: "POST", body: form });
      return await parseResult(response);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao contactar o Telegram.",
      };
    }
  });
