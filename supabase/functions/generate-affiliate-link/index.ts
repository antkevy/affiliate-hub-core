import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestPayload {
  url?: string;
  platform?: string;
}

/**
 * Converte a string de cookies atual em pares chave=valor,
 * mescla com todos os novos cookies recebidos nos cabeçalhos Set-Cookie
 * e reconstrói a string consolidada no formato: key1=val1; key2=val2.
 */
function mergeCookies(currentCookies: string, setCookieHeaders: string[]): string {
  const cookieMap = new Map<string, string>();

  // Parse existing cookies
  if (currentCookies && currentCookies.trim() !== "") {
    const pairs = currentCookies.split(";");
    for (const pair of pairs) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        cookieMap.set(key, value);
      }
    }
  }

  // Parse and merge new set-cookie headers
  for (const header of setCookieHeaders) {
    if (!header || header.trim() === "") continue;
    // Set-Cookie header contains key=value; Path=/; Domain=...; Expires=...
    const cookiePart = header.split(";")[0].trim();
    const eqIdx = cookiePart.indexOf("=");
    if (eqIdx > 0) {
      const key = cookiePart.slice(0, eqIdx).trim();
      const value = cookiePart.slice(eqIdx + 1).trim();
      // Only set if key is not a standard cookie directive
      const lowerKey = key.toLowerCase();
      if (!["path", "domain", "expires", "max-age", "samesite", "httponly", "secure"].includes(lowerKey)) {
        cookieMap.set(key, value);
      }
    }
  }

  // Reconstruct cookie string
  const result: string[] = [];
  for (const [key, value] of cookieMap.entries()) {
    result.push(`${key}=${value}`);
  }
  return result.join("; ");
}

/**
 * Valida se a URL é do Mercado Livre
 */
function isValidMercadoLivreUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    return (
      host.endsWith("mercadolivre.com.br") ||
      host.endsWith("mercadolibre.com") ||
      host.endsWith("mercadolibre.com.ar") ||
      host.endsWith("mercadolivre.com") ||
      host.includes("mercadolivre") ||
      host.includes("mercadolibre")
    );
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  // 1. Tratar requisições OPTIONS (CORS preflight)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 2. Parse e Validação do Payload
    const payload: RequestPayload = await req.json().catch(() => ({}));
    const targetUrl = payload.url?.trim();
    const platform = payload.platform?.trim() || "mercadolivre";

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: "A URL do produto é obrigatória." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidMercadoLivreUrl(targetUrl)) {
      return new Response(
        JSON.stringify({ error: "A URL fornecida não pertence ao Mercado Livre." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Recuperação de Sessão via Supabase Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Variáveis de ambiente do Supabase não configuradas no servidor." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: sessionData, error: sessionError } = await supabase
      .from("platform_sessions")
      .select("cookies, user_agent")
      .eq("platform", platform)
      .single();

    if (sessionError || !sessionData || !sessionData.cookies || sessionData.cookies.trim() === "") {
      return new Response(
        JSON.stringify({
          error: `Sessão para a plataforma '${platform}' não encontrada ou com cookies vazios. A sessão precisa ser inicializada.`,
          code: "SESSION_NOT_FOUND",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const initialCookies = sessionData.cookies;
    const userAgent = sessionData.user_agent;

    // 4. Simulação de acesso ao Link Builder GET para renovar/capturar novos cookies
    const linkBuilderUrl = "https://www.mercadolivre.com.br/afiliados/linkbuilder";
    const getResponse = await fetch(linkBuilderUrl, {
      method: "GET",
      headers: {
        "User-Agent": userAgent,
        "Cookie": initialCookies,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    // Extrair novos set-cookie
    const setCookieHeaders: string[] = [];
    if (typeof getResponse.headers.getSetCookie === "function") {
      setCookieHeaders.push(...getResponse.headers.getSetCookie());
    } else {
      const rawHeader = getResponse.headers.get("set-cookie");
      if (rawHeader) {
        setCookieHeaders.push(...rawHeader.split(/,\s*(?=[A-Za-z0-9_ -]+=)/));
      }
    }

    // 5. Mesclar cookies e atualizar a sessão no banco
    const updatedCookies = mergeCookies(initialCookies, setCookieHeaders);

    await supabase
      .from("platform_sessions")
      .update({
        cookies: updatedCookies,
        updated_at: new Date().toISOString(),
      })
      .eq("platform", platform);

    // 6. Requisição POST para criar o link de afiliado
    const createApiUrl = "https://www.mercadolivre.com.br/afiliados/api/linkbuilder/create";
    const postResponse = await fetch(createApiUrl, {
      method: "POST",
      headers: {
        "User-Agent": userAgent,
        "Cookie": updatedCookies,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        urls: [targetUrl],
      }),
    });

    // 7. Tratamento de Resposta e Erros
    if (postResponse.status === 401 || postResponse.status === 403) {
      return new Response(
        JSON.stringify({
          error: "A sessão do Mercado Livre expirou. Os cookies precisam ser atualizados manualmente.",
          code: "SESSION_EXPIRED",
        }),
        { status: postResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!postResponse.ok) {
      const errorText = await postResponse.text().catch(() => "");
      return new Response(
        JSON.stringify({
          error: `Erro retornado pelo Mercado Livre (HTTP ${postResponse.status}): ${errorText || postResponse.statusText}`,
          code: "MERCADO_LIVRE_API_ERROR",
        }),
        { status: postResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const responseJson = await postResponse.json();

    // Extrair o link encurtado de afiliado do payload
    let shortenUrl: string | null = null;

    if (responseJson && typeof responseJson === "object") {
      if (typeof responseJson.shorten_url === "string") {
        shortenUrl = responseJson.shorten_url;
      } else if (Array.isArray(responseJson.urls) && responseJson.urls[0]?.shorten_url) {
        shortenUrl = responseJson.urls[0].shorten_url;
      } else if (Array.isArray(responseJson.data) && responseJson.data[0]?.shorten_url) {
        shortenUrl = responseJson.data[0].shorten_url;
      } else if (Array.isArray(responseJson.results) && responseJson.results[0]?.shorten_url) {
        shortenUrl = responseJson.results[0].shorten_url;
      } else if (responseJson.url && typeof responseJson.url === "string") {
        shortenUrl = responseJson.url;
      }
    }

    if (!shortenUrl) {
      return new Response(
        JSON.stringify({
          error: "Não foi possível extrair o link de afiliado da resposta da plataforma.",
          raw_response: responseJson,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        original_url: targetUrl,
        affiliate_url: shortenUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `Erro interno no servidor: ${errorMessage}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
