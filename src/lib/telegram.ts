// Parsers puros para a captura de ofertas de canais públicos do Telegram
// (preview web https://t.me/s/<username>). Nenhum desses helpers toca o banco
// de dados — a orquestração fica em telegram.server.ts (server fn).

export const TELEGRAM_FETCH_TIMEOUT_MS = 20000;

const BLOCKED_TERMS = [
  "roupa",
  "camisa",
  "camiseta",
  "calça",
  "sapato",
  "tênis",
  "bermuda",
  "blusa",
  "livro",
  "revista",
  "gibi",
  "mangá",
  "brinquedo",
  "boneca",
  "carrinho de brinquedo",
  "alimento",
  "comida",
  "chocolate",
  "café",
  "pão",
  "carro",
  "moto",
  "peça automotiva",
  "pneu",
  "imóvel",
  "apartamento",
  "casa",
  "relógio de pulso",
  "joia",
  "anel",
  "colar",
  "instrumento musical",
  "violão",
  "guitarra",
  "bateria",
  "esporte",
  "bola de futebol",
  "bicicleta",
  "esteira",
  "pet",
  "cachorro",
  "gato",
  "ração",
  "coleira",
];

export function shouldCaptureProduct(text: string): boolean {
  const lower = text.toLowerCase();
  return !BLOCKED_TERMS.some((term) => lower.includes(term));
}

/** Normaliza "@usuario", "https://t.me/s/usuario" ou "usuario" para "usuario". */
export function extractTelegramUsername(raw: string): string {
  let u = (raw || "").trim();
  u = u.replace(/\/+$/, "");
  const match = u.match(/(?:t\.me\/(?:s\/)?|@|^)([a-zA-Z0-9_]{4,})/i);
  return match ? match[1]! : u.replace(/^@/, "");
}

/** Busca a página pública de prévia do canal. Falha de rede/timeout retorna null. */
export async function fetchTmePublicPreview(username: string): Promise<string | null> {
  const clean = extractTelegramUsername(username);
  const url = `https://t.me/s/${clean}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TELEGRAM_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function cleanEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Extrai a primeira foto de mídia real de um post (ignora sprites de emoji e avatares). */
export function extractImage(rawInner: string): string | null {
  const inner = cleanEntities(rawInner).replace(
    /<div class="tgme_widget_message_user"[^>]*>[\s\S]*?<\/div\s*>/gi,
    "",
  );

  const bgRe = /background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/gi;
  let m: RegExpExecArray | null;
  while ((m = bgRe.exec(inner)) !== null) {
    const url = m[1]!.startsWith("//") ? "https:" + m[1] : m[1]!;
    if (/emoji|telegram\.org\/img\/|userphoto|userpic/i.test(url)) continue;
    return url;
  }

  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  while ((m = imgRe.exec(inner)) !== null) {
    const url = m[1]!.startsWith("//") ? "https:" + m[1] : m[1]!;
    if (/emoji|telegram\.org\/img\/|userphoto|userpic|avatar/i.test(url)) continue;
    return url;
  }

  const posterRe = /<video[^>]+poster=["']([^"']+)["'][^>]*>/gi;
  while ((m = posterRe.exec(inner)) !== null) {
    const url = m[1]!.startsWith("//") ? "https:" + m[1] : m[1]!;
    return url;
  }

  return null;
}

/** Busca a página do produto e tenta extrair a imagem principal (og:image / link / JSON-LD). */
export async function fetchProductImage(url: string): Promise<string | null> {
  try {
    const cleanUrl = url.replace(/&amp;/g, "&");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch(cleanUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
        },
        redirect: "follow",
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) return null;
    const html = await response.text().catch(() => "");
    if (!html) return null;

    const ogMatch =
      html.match(
        /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image|image|og:image:secure_url)["'][^>]+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image|image|og:image:secure_url)["']/i,
      );
    if (ogMatch && ogMatch[1] && !/logo|placeholder|default/i.test(ogMatch[1])) {
      return new URL(ogMatch[1].replace(/&amp;/g, "&"), response.url).href;
    }

    const linkSrc = html.match(
      /<link[^>]+rel=["'](?:image_src|icon)["'][^>]+href=["']([^"']+)["']/i,
    );
    if (linkSrc && linkSrc[1] && !/favicon|logo|icon/i.test(linkSrc[1])) {
      return new URL(linkSrc[1].replace(/&amp;/g, "&"), response.url).href;
    }

    const first = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (first && first[1] && !/logo|icon|spacer|pixel|avatar|loading|banner/i.test(first[1])) {
      return new URL(first[1].replace(/&amp;/g, "&"), response.url).href;
    }

    return null;
  } catch {
    return null;
  }
}

export interface TmePost {
  id: string;
  textHtml: string;
  time: string | null;
  image: string | null;
}

/** Extrai todos os posts da prévia pública do canal. */
export function parseTmePosts(html: string): TmePost[] {
  const posts: TmePost[] = [];
  const itemRe =
    /<div class="tgme_widget_message[^"]*js-widget_message[^"]*"[^>]*data-post="([^"]+)"[^>]*>([\s\S]*?)(?=<div class="tgme_widget_message\b|\s*<\/body>|$)/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(html)) !== null) {
    const id = m[1]!;
    const inner = m[2]!;
    const timeMatch = inner.match(/datetime="([^"]+)"/);
    const time = timeMatch ? timeMatch[1]! : null;
    const textMatch = inner.match(
      /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/,
    );
    const textHtml = textMatch ? textMatch[1]! : inner;
    const image = extractImage(inner);
    posts.push({ id, textHtml, time, image });
  }
  return posts;
}

export function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#036;/g, "$")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function extractTitle(text: string): string {
  const lines = text.split("\n").filter((line) => line.length > 0);
  for (const line of lines) {
    if (/^https?:\/\//i.test(line)) continue;
    if (/^R?\$\s?[0-9.,]+\s*$/i.test(line)) continue;
    if (/^(de|por|cupom|code|codigo|código)[\s:]/i.test(line)) continue;
    return line.slice(0, 200);
  }
  return "Oferta Telegram";
}

export function extractPrice(text: string): number | null {
  const match = text.match(/R\$\s?([0-9][0-9.,]*)/i);
  if (!match) return null;
  const raw = match[1]!.replace(/\s/g, "");
  if (raw.includes(",")) {
    const parsed = Number(raw.replace(/\./g, "").replace(",", "."));
    return isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(raw.replace(/\./g, ""));
  return isFinite(parsed) ? parsed : null;
}

export function extractCoupon(text: string): string | null {
  const match = text.match(/(?:cupom|code|codigo|código)[:\s]*([A-Z0-9]{4,})/i);
  return match ? match[1]!.toUpperCase() : null;
}

export function extractDiscount(text: string): number | null {
  const match = text.match(/(\d{1,3})\s*%\s*OFF/i);
  if (match) {
    const percentage = Number(match[1]);
    return percentage > 0 && percentage <= 100 ? percentage : null;
  }
  return null;
}

export function extractOriginalPrice(text: string, currentPrice: number): number | null {
  const re = /(?:de|antes|por|R\$)\s*([0-9][0-9.,]*)/gi;
  let highest = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const raw = match[1]!.replace(/\s/g, "");
    let value: number;
    if (raw.includes(",")) {
      value = Number(raw.replace(/\./g, "").replace(",", "."));
    } else {
      value = Number(raw.replace(/\./g, ""));
    }
    if (isFinite(value) && value > highest && value > currentPrice) {
      highest = value;
    }
  }
  return highest > 0 ? highest : null;
}

export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"]+/gi);
  return matches ? matches.map((u) => u.replace(/[),.;]+$/, "")) : [];
}

/** Escolhe a URL mais provável do produto (ignora links do próprio canal/telegram). */
export function pickProductUrl(urls: string[]): string | null {
  const junk = /(nerdofertas\.com|t\.me\/|telegram\.org)/i;
  for (const url of urls) {
    if (junk.test(url)) continue;
    return url;
  }
  return null;
}

/** Detecta a loja (slug kebab-case — igual à tabela marketplaces) a partir de URL + texto. */
export function detectMarketplace(url: string | null, text: string): string | null {
  const combined = `${url ?? ""} ${text}`.toLowerCase();
  const pairs: Array<[string, string]> = [
    ["mercado-livre", "mercadolivre|mercadolibre|meli.la"],
    ["shopee", "shopee|shope.ee"],
    ["amazon", "amazon|amzn"],
    ["magalu", "magalu|magazineluiza|magazinevoce"],
    ["aliexpress", "aliexpress|alicdn"],
    ["shein", "shein"],
    ["kabum", "kabum"],
    ["terabyte", "terabyte|terabyteshop"],
    ["pichau", "pichau"],
    ["casas-bahia", "casasbahia|casas bahia"],
    ["ponto", "ponto|pontofrio"],
    ["fast-shop", "fastshop|fast shop"],
    ["samsung", "samsung"],
    ["girafa", "girafa"],
  ];
  for (const [slug, pattern] of pairs) {
    if (new RegExp(pattern, "i").test(combined)) return slug;
  }
  return null;
}

/** Tipo do candidato retornado pela captura Telegram antes de gravar. */
export interface TelegramOfferCandidate {
  title: string;
  original_url: string;
  sale_price: number | null;
  original_price: number | null;
  discount_percentage: number | null;
  coupon: string | null;
  image: string | null;
  time: string | null;
}
