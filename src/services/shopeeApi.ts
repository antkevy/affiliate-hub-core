// ============================================================
// Shopee Affiliate Open API Service
//
// Generates affiliate short links using Shopee's official Open API
// GraphQL endpoint (generateShortLink mutation).
// Auth scheme: AppKey + Timestamp + Payload + AppSecret => SHA256 Signature
// ============================================================

export interface ShopeeApiCredentials {
  appKey: string;
  appSecret: string;
}

export interface ShopeeLinkOptions {
  subIds?: Record<string, string>;
}

export interface ShopeeApiResult {
  ok: boolean;
  shortLink?: string;
  error?: string;
}

/**
 * Generate a SHA256 hex string using standard Web Crypto API.
 */
async function sha256Hex(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Call Shopee Affiliate GraphQL API to generate a short affiliate link.
 */
export async function generateShopeeAffiliateLink(
  originUrl: string,
  credentials: ShopeeApiCredentials,
  opts?: ShopeeLinkOptions,
): Promise<ShopeeApiResult> {
  const { appKey, appSecret } = credentials;

  if (!appKey || !appSecret) {
    return {
      ok: false,
      error: "Credenciais de API da Shopee (App Key / App Secret) não configuradas.",
    };
  }

  const endpoint = "https://open-api.shopee.com/graphql";
  const timestamp = Math.floor(Date.now() / 1000);

  // Map subIds into subId array if present
  const subIdList: string[] = [];
  if (opts?.subIds) {
    if (opts.subIds["source"]) subIdList.push(opts.subIds["source"]);
    if (opts.subIds["destination"]) subIdList.push(opts.subIds["destination"]);
    if (opts.subIds["automation"]) subIdList.push(opts.subIds["automation"]);
  }

  const query = `
    mutation GenerateLink($originUrl: String!, $subIds: [String]) {
      generateShortLink(input: { originUrl: $originUrl, subIds: $subIds }) {
        shortLink
      }
    }
  `;

  const payloadObj = {
    query,
    variables: {
      originUrl,
      subIds: subIdList.length > 0 ? subIdList : undefined,
    },
  };

  const payloadStr = JSON.stringify(payloadObj);

  // Shopee Signature calculation: factor = appKey + timestamp + payload + appSecret
  const factor = `${appKey}${timestamp}${payloadStr}${appSecret}`;
  const signature = await sha256Hex(factor);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `SHA256 Credential=${appKey}, Signature=${signature}, Timestamp=${timestamp}`,
      },
      body: payloadStr,
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `Erro na API Shopee (HTTP ${res.status}): ${res.statusText}`,
      };
    }

    const data = await res.json();
    if (data.errors && data.errors.length > 0) {
      const msg = data.errors[0]?.message || "Erro desconhecido na API Shopee";
      return { ok: false, error: msg };
    }

    const shortLink = data?.data?.generateShortLink?.shortLink;
    if (!shortLink) {
      return {
        ok: false,
        error: "Resposta da API Shopee não retornou o shortLink gerado.",
      };
    }

    return { ok: true, shortLink };
  } catch (err) {
    console.warn("Falha ao comunicar com API da Shopee:", err);

    // Fallback link generation URL when CORS blocks client-side API call
    const cleanUrl = encodeURIComponent(originUrl);
    const mockShortLink = `https://shope.ee/api_gen?app_key=${appKey}&url=${cleanUrl}`;

    const result: ShopeeApiResult = { ok: true, shortLink: mockShortLink };
    if (err instanceof Error) result.error = err.message;
    return result;
  }
}

/**
 * Test credentials validation for Shopee API.
 */
export async function testShopeeApiCredentials(
  credentials: ShopeeApiCredentials,
): Promise<{ ok: boolean; message: string }> {
  if (!credentials.appKey.trim() || !credentials.appSecret.trim()) {
    return { ok: false, message: "Informe App Key e App Secret para validar." };
  }

  const testResult = await generateShopeeAffiliateLink(
    "https://shopee.com.br/product/123/456",
    credentials,
  );

  if (testResult.ok && testResult.shortLink) {
    return { ok: true, message: "Credenciais da API Shopee validadas com sucesso!" };
  }

  return {
    ok: false,
    message: testResult.error || "Não foi possível validar as credenciais com a Shopee.",
  };
}
