import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { RESVG_WASM_BASE64 } from "./assets/resvg-wasm-base64";
import { DMSANS_400_BASE64 } from "./assets/dmsans-400-base64";
import { DMSANS_700_BASE64 } from "./assets/dmsans-700-base64";
import { BANNER_TEMPLATES } from "@/components/banners/bannerTemplatesData";
import { detectMarketplace } from "@/lib/telegram";
import { bannerConfigOf } from "@/lib/banner-config";
import type { BannerConfig, BannerStyle, MarketplaceBrand } from "@/types/banner";
import type { Offer } from "@/types";

const BRANDS: MarketplaceBrand[] = ["mercado-livre", "shopee", "amazon", "magalu", "aliexpress"];

let wasmReady: Promise<void> | null = null;

function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = (async () => {
      await initWasm(base64ToBytes(RESVG_WASM_BASE64));
    })().catch((error) => {
      wasmReady = null;
      throw error;
    });
  }
  return wasmReady;
}

/** Converte uma string base64 em bytes (sem prefixo de data URI). */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function brandFromSlug(slug: string | null): MarketplaceBrand {
  if (slug && BRANDS.some((brand) => brand === slug)) return slug as MarketplaceBrand;
  return "none";
}

/** Monta a configuração do banner a partir dos dados da oferta (espelho do cliente, sem DOM). */
export function buildOfferBannerConfigServer(
  offer: Offer,
  marketplaceName: string | null,
  saved?: BannerConfig | null,
): BannerConfig {
  const brand = brandFromSlug(detectMarketplace(offer.original_url ?? null, offer.title));
  const discount =
    offer.discount_percentage !== null && offer.discount_percentage !== undefined
      ? `${offer.discount_percentage}% OFF`
      : "";
  const fallback = BANNER_TEMPLATES[0]?.defaultConfig ?? ({} as BannerConfig);
  const money = formatBRL(offer.sale_price);

  return {
    ...fallback,
    ...(saved ?? {}),
    templateId: saved?.templateId ?? fallback.templateId,
    title: (offer.title ?? "").slice(0, 70) || fallback.title,
    currentPrice: money || fallback.currentPrice,
    originalPrice: offer.original_price ? formatBRL(offer.original_price) : fallback.originalPrice,
    discountBadge: discount || fallback.discountBadge,
    couponCode: offer.coupon ?? saved?.couponCode ?? fallback.couponCode ?? "",
    marketplace: brand !== "none" ? brand : (saved?.marketplace ?? "none"),
    tagline: marketplaceName
      ? `${marketplaceName} · Oferta verificada`
      : (saved?.tagline ?? fallback.tagline ?? ""),
    showSticker: discount ? true : (saved?.showSticker ?? fallback.showSticker ?? false),
    stickerText: discount || (saved?.stickerText ?? ""),
    showButton: saved?.showButton ?? fallback.showButton ?? true,
    showTitle: saved?.showTitle ?? fallback.showTitle ?? true,
    showSubtitle: saved?.showSubtitle ?? fallback.showSubtitle ?? true,
    showPrices: saved?.showPrices ?? fallback.showPrices ?? true,
    showBadge: saved?.showBadge ?? fallback.showBadge ?? true,
    showCoupon: saved?.showCoupon ?? fallback.showCoupon ?? true,
    showTagline: saved?.showTagline ?? fallback.showTagline ?? true,
    showMarketplace: saved?.showMarketplace ?? fallback.showMarketplace ?? true,
    buttonText: saved?.buttonText ?? "GARANTIR OFERTA",
    aspectRatio: saved?.aspectRatio ?? "1:1",
    subtitle: saved?.subtitle ?? "Aproveite enquanto dura · Oferta verificada",
  };
}

/** Mapeia tokens Tailwind usados nos templates para cores hex (server-side). */
const TAILWIND_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  // slate
  "slate-50": "#f8fafc",
  "slate-100": "#f1f5f9",
  "slate-200": "#e2e8f0",
  "slate-300": "#cbd5e1",
  "slate-400": "#94a3b8",
  "slate-500": "#64748b",
  "slate-600": "#475569",
  "slate-700": "#334155",
  "slate-800": "#1e293b",
  "slate-900": "#0f172a",
  "slate-950": "#020617",
  // gray
  "gray-50": "#f9fafb",
  "gray-100": "#f3f4f6",
  "gray-200": "#e5e7eb",
  "gray-300": "#d1d5db",
  "gray-400": "#9ca3af",
  "gray-500": "#6b7280",
  "gray-600": "#4b5563",
  "gray-700": "#374151",
  "gray-800": "#1f2937",
  "gray-900": "#111827",
  "gray-950": "#030712",
  // zinc
  "zinc-50": "#fafafa",
  "zinc-100": "#f4f4f5",
  "zinc-200": "#e4e4e7",
  "zinc-300": "#d4d4d8",
  "zinc-400": "#a1a1aa",
  "zinc-500": "#71717a",
  "zinc-600": "#52525b",
  "zinc-700": "#3f3f46",
  "zinc-800": "#27272a",
  "zinc-900": "#18181b",
  "zinc-950": "#09090b",
  // red
  "red-500": "#ef4444",
  "red-600": "#dc2626",
  "red-700": "#b91c1c",
  "red-800": "#991b1b",
  "red-900": "#7f1d1d",
  "red-950": "#450a0a",
  // orange
  "orange-500": "#f97316",
  "orange-600": "#ea580c",
  "orange-700": "#c2410c",
  "orange-900": "#7c2d12",
  "orange-950": "#431407",
  // amber
  "amber-300": "#fcd34d",
  "amber-400": "#fbbf24",
  "amber-500": "#f59e0b",
  "amber-600": "#d97706",
  "amber-700": "#b45309",
  "amber-900": "#78350f",
  // yellow
  "yellow-300": "#fde047",
  "yellow-400": "#facc15",
  "yellow-500": "#eab308",
  "yellow-600": "#ca8a04",
  // emerald
  "emerald-300": "#6ee7b7",
  "emerald-400": "#34d399",
  "emerald-500": "#10b981",
  "emerald-600": "#059669",
  "emerald-800": "#065f46",
  "emerald-900": "#064e3b",
  "emerald-950": "#022c22",
  // teal
  "teal-300": "#5eead4",
  "teal-400": "#2dd4bf",
  "teal-500": "#14b8a6",
  "teal-600": "#0d9488",
  "teal-700": "#0f766e",
  "teal-800": "#115e59",
  "teal-900": "#134e4a",
  // cyan
  "cyan-50": "#ecfeff",
  "cyan-100": "#cffafe",
  "cyan-200": "#a5f3fc",
  "cyan-300": "#67e8f9",
  "cyan-400": "#22d3ee",
  "cyan-500": "#06b6d4",
  "cyan-600": "#0891b2",
  "cyan-800": "#155e75",
  "cyan-900": "#164e63",
  // sky
  "sky-400": "#38bdf8",
  "sky-500": "#0ea5e9",
  "sky-600": "#0284c7",
  // blue
  "blue-600": "#2563eb",
  "blue-700": "#1d4ed8",
  "blue-800": "#1e40af",
  "blue-900": "#1e3a8a",
  "blue-950": "#172554",
  // indigo
  "indigo-500": "#6366f1",
  "indigo-600": "#4f46e5",
  "indigo-700": "#4338ca",
  "indigo-900": "#312e81",
  // violet
  "violet-400": "#a78bfa",
  "violet-500": "#8b5cf6",
  "violet-700": "#6d28d9",
  "violet-900": "#4c1d95",
  "violet-950": "#2e1065",
  // purple
  "purple-500": "#a855f7",
  "purple-600": "#9333ea",
  "purple-700": "#7e22ce",
  "purple-900": "#581c87",
  "purple-950": "#3b0764",
  // fuchsia
  "fuchsia-300": "#f0abfc",
  "fuchsia-400": "#e879f9",
  "fuchsia-500": "#d946ef",
  "fuchsia-600": "#c026d3",
  "fuchsia-800": "#a21caf",
  "fuchsia-900": "#701a75",
  // pink
  "pink-300": "#f9a8d4",
  "pink-400": "#f472b6",
  "pink-500": "#ec4899",
  "pink-600": "#db2777",
  // rose
  "rose-300": "#fda4af",
  "rose-400": "#fb7185",
  "rose-500": "#f43f5e",
  "rose-600": "#e11d48",
  "rose-700": "#be123c",
  "rose-800": "#9f1239",
  "rose-900": "#881337",
  "rose-950": "#4c0519",
  // lime
  "lime-400": "#a3e635",
  "lime-500": "#84cc16",
  // green
  "green-500": "#22c55e",
  "green-600": "#16a34a",
};

/** Extrai a cor de um token como `text-amber-400` / `bg-slate-950` / `from-x`. */
function colorFromToken(token: string): string | null {
  const match = token.match(/([a-z]+-[0-9]+|white|black)$/i);
  if (!match?.[1]) return null;
  const value = TAILWIND_COLORS[match[1].toLowerCase()];
  return value ?? null;
}

/** Pluck de cores de um gradiente/token composto como `from-rose-500 via-... to-amber-500`. */
function colorSequence(value: string | undefined, prefix: "from" | "to" | "via"): string[] {
  if (!value) return [];
  const tokens = value.match(new RegExp(`${prefix}-(\\S+)`, "gi")) ?? [];
  const colors = tokens
    .map((token) => colorFromToken(token.replace(new RegExp(`^${prefix}-`, "i"), "")))
    .filter((color): color is string => color !== null);
  return colors;
}

function isLightTheme(style: BannerStyle): boolean {
  const text = style.textColor ?? "";
  if (text.includes("slate-950") || text.includes("slate-900") || text.includes("black"))
    return true;
  if (style.backgroundGradient?.includes("slate-100") ?? false) return true;
  if (style.backgroundGradient?.includes("white") ?? false) return true;
  return false;
}

/** Cor "pura" de um token composto (ex.: `"bg-rose-500 hover:bg-rose-600"`). */
function solidColorOf(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const first = value.split(/\s+/)[0] ?? value;
  return colorFromToken(first) ?? fallback;
}

interface ResolvedStyle {
  gradient: string[];
  textColor: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  buttonGradient: string[];
  buttonText: string;
  mutedText: string;
  surface: string;
  lightTheme: boolean;
}

function resolveStyle(style: BannerStyle): ResolvedStyle {
  const light = isLightTheme(style);
  const from = colorSequence(style.backgroundGradient, "from");
  const via = colorSequence(style.backgroundGradient, "via");
  const to = colorSequence(style.backgroundGradient, "to");
  const gradient =
    from.length > 0 || to.length > 0
      ? [from[0] ?? "#020617", ...via.slice(0, 1), to[0] ?? from[0] ?? "#020617"]
      : [solidColorOf(style.backgroundGradient, "#020617"), "#020617"];

  const accent = colorFromToken(style.accentColor ?? "") ?? (light ? "#475569" : "#fbbf24");
  const textColor = colorFromToken(style.textColor ?? "") ?? (light ? "#0f172a" : "#ffffff");
  const badgeBg = colorFromToken(style.badgeBg ?? "") ?? "#fbbf24";
  const badgeText = colorFromToken(style.badgeText ?? "") ?? (light ? "#020617" : "#ffffff");

  const btnFrom = colorSequence(style.buttonBg, "from");
  const btnTo = colorSequence(style.buttonBg, "to");
  const btnSolid = solidColorOf(style.buttonBg, "#111827");
  const buttonGradient = [btnFrom[0] ?? btnSolid, btnTo[0] ?? btnFrom[0] ?? btnSolid];
  const buttonText = colorFromToken(style.buttonText ?? "") ?? "#ffffff";

  return {
    gradient,
    textColor,
    accentColor: accent,
    badgeBg,
    badgeText,
    buttonGradient,
    buttonText,
    mutedText: light ? "#475569" : "#e2e8f0",
    surface: light ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.16)",
    lightTheme: light,
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function gradientDefs(id: string, colors: string[]): string {
  const stops = colors
    .map(
      (c, i) => `<stop offset="${(i / Math.max(colors.length - 1, 1)) * 100}%" stop-color="${c}"/>`,
    )
    .join("");
  return `<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient>`;
}

function marketplaceLabel(marketplace: string): string {
  switch (marketplace) {
    case "mercado-livre":
      return "MERCADO LIVRE";
    case "shopee":
      return "SHOPEE";
    case "amazon":
      return "AMAZON";
    case "magalu":
      return "MAGALU";
    case "aliexpress":
      return "ALIEXPRESS";
    default:
      return "";
  }
}

/** Dimensões padrão por aspect ratio. */
function bannerSize(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "16:9":
      return { width: 1920, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "1:1":
    default:
      return { width: 1080, height: 1080 };
  }
}

export interface BannerImagePayload {
  base64?: string | null;
  url?: string | null;
}

function guessMime(base64: string): string {
  if (base64.startsWith("iVBOR") || base64.startsWith("R0lGOD")) return "image/png";
  if (base64.startsWith("/9j")) return "image/jpeg";
  return "image/png";
}

function imageHref(payload: BannerImagePayload | undefined): string {
  if (!payload) return "";
  if (payload.base64) {
    return `data:${guessMime(payload.base64)};base64,${payload.base64}`;
  }
  return payload.url ?? "";
}

function taglinePill(
  tagline: string,
  cx: number,
  y: number,
  sizeH: number,
  style: ResolvedStyle,
): string {
  const width = 56 + tagline.length * (sizeH * 0.46);
  return (
    `<rect x="${cx - width / 2}" y="${y}" width="${width}" height="${sizeH}" rx="${sizeH / 2}" fill="${
      style.lightTheme ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.18)"
    }"/>` +
    `<text x="${cx}" y="${y + sizeH * 0.68}" font-family="DM Sans" font-weight="600" font-size="${sizeH * 0.5}" text-anchor="middle" fill="${style.textColor}">${tagline}</text>`
  );
}

function marketplacePill(
  mkt: string,
  cx: number,
  y: number,
  sizeH: number,
  style: ResolvedStyle,
): string {
  const width = 48 + mkt.length * (sizeH * 0.5);
  return (
    `<rect x="${cx - width / 2}" y="${y}" width="${width}" height="${sizeH}" rx="${sizeH / 2}" fill="${
      style.lightTheme ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.18)"
    }"/>` +
    `<text x="${cx}" y="${y + sizeH * 0.68}" font-family="DM Sans" font-weight="700" font-size="${sizeH * 0.5}" text-anchor="middle" fill="${style.textColor}">${mkt}</text>`
  );
}

function couponChip(
  coupon: string,
  cx: number,
  y: number,
  sizeH: number,
  style: ResolvedStyle,
): string {
  const width = 120 + coupon.length * (sizeH * 0.6);
  const textColor = style.lightTheme ? "#b45309" : "#fde047";
  const fill = style.lightTheme ? "rgba(15,23,42,0.10)" : "rgba(0,0,0,0.35)";
  const stroke = style.lightTheme ? "rgba(15,23,42,0.35)" : "rgba(255,255,255,0.45)";
  return (
    `<rect x="${cx - width / 2}" y="${y}" width="${width}" height="${sizeH}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-dasharray="7 6"/>` +
    `<text x="${cx}" y="${y + sizeH * 0.66}" font-family="DM Sans" font-weight="700" font-size="${sizeH * 0.46}" text-anchor="middle" fill="${textColor}">CUPOM: ${coupon}</text>`
  );
}

function actionButton(
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  style: ResolvedStyle,
): string {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h * 0.32}" fill="url(#btn)"/>` +
    `<text x="${x + w / 2}" y="${y + h * 0.68}" font-family="DM Sans" font-weight="900" font-size="${h * 0.34}" text-anchor="middle" letter-spacing="1" fill="${style.buttonText}">${label}</text>`
  );
}

function discountBadgeFlourish(
  label: string,
  x: number,
  y: number,
  sizeH: number,
  style: ResolvedStyle,
): string {
  const width = 120 + label.length * (sizeH * 0.5);
  return (
    `<g transform="rotate(4 ${x} ${y})">` +
    `<rect x="${x}" y="${y}" width="${width}" height="${sizeH}" rx="14" fill="${style.badgeBg}"/>` +
    `<text x="${x + width / 2}" y="${y + sizeH * 0.68}" font-family="DM Sans" font-weight="800" font-size="${sizeH * 0.5}" text-anchor="middle" fill="${style.badgeText}">${label}</text>` +
    `</g>`
  );
}

/** Gera o SVG do banner (espelho server-side do BannerCanvas). */
export function buildOfferSvg(config: BannerConfig, image: BannerImagePayload | undefined): string {
  const { width, height } = bannerSize(config.aspectRatio);
  const style = resolveStyle(config.style);
  const isHorizontal = config.aspectRatio === "16:9";
  const isVertical = config.aspectRatio === "9:16";
  const href = imageHref(image);
  const noImage = !href;

  const title = escapeXml(config.title.split("\n")[0] ?? config.title);
  const subtitle = escapeXml(config.subtitle ?? "");
  const currentPrice = escapeXml(config.currentPrice);
  const originalPrice = escapeXml(config.originalPrice);
  const discountBadge = escapeXml(config.discountBadge);
  const coupon = escapeXml(config.couponCode ?? "");
  const tagline = escapeXml(config.tagline ?? "");
  const mkt = escapeXml(marketplaceLabel(config.marketplace));
  const buttonLabel = escapeXml(config.buttonText || "GARANTIR OFERTA");
  const defs = gradientDefs("bg", style.gradient) + gradientDefs("btn", style.buttonGradient);
  const radius = Math.round(Math.min(width, height) * 0.05);

  if (isHorizontal) {
    // ── 16:9: imagem à esquerda, textos à direita ──
    const pad = 90;
    const contentX = width * 0.52;
    const imageX = pad;
    const imageY = height * 0.15;
    const imageW = width * 0.34;
    const imageH = height * 0.6;
    const imageRadius = Math.round(height * 0.03);
    const t = contentX;
    const b = height * 0.76;
    const priceSize = Math.round(height * 0.085);
    const titleSize = Math.round(height * 0.052);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="DM Sans">
  <defs>${defs}</defs>
  <rect width="${width}" height="${height}" rx="${radius}" fill="url(#bg)"/>
  ${noImage ? "" : `<rect x="${imageX}" y="${imageY}" width="${imageW}" height="${imageH}" rx="${imageRadius}" fill="${style.surface}"/>`}
  ${noImage ? "" : `<image x="${imageX + 34}" y="${imageY + 34}" width="${imageW - 68}" height="${imageH - 68}" href="${escapeXml(href)}" preserveAspectRatio="xMidYMid meet"/>`}
  ${config.showBadge && discountBadge && !noImage ? discountBadgeFlourish(discountBadge, imageX + 30, imageY + 30, Math.round(height * 0.05), style) : ""}

  ${config.showTagline && tagline ? taglinePill(tagline, t + 40, b - height * 0.34, Math.round(height * 0.048), style) : ""}
  ${config.showMarketplace && mkt ? marketplacePill(mkt, t + 40, b - height * 0.27, Math.round(height * 0.042), style) : ""}

  ${config.showTitle && title ? `<text x="${t}" y="${b - height * 0.2}" font-family="DM Sans" font-weight="750" font-size="${titleSize}" fill="${style.textColor}">${title}</text>` : ""}
  ${config.showSubtitle && subtitle ? `<text x="${t}" y="${b - height * 0.125}" font-family="DM Sans" font-weight="500" font-size="${Math.round(height * 0.026)}" fill="${style.mutedText}">${subtitle}</text>` : ""}

  ${
    config.showPrices
      ? `<g>
    ${originalPrice ? `<text x="${t}" y="${b - height * 0.035}" font-family="DM Sans" font-weight="500" font-size="${Math.round(height * 0.033)}" text-decoration="line-through" fill="${style.mutedText}">De: ${originalPrice}</text>` : ""}
    <text x="${t}" y="${b + height * 0.065}" font-family="DM Sans" font-weight="800" font-size="${priceSize}" fill="${style.accentColor}">${currentPrice || "R$ 0,00"}</text>
    ${config.showCoupon && coupon ? couponChip(coupon, t + 40, b + height * 0.15, Math.round(height * 0.05), style) : ""}
  </g>`
      : ""
  }

  ${config.showButton ? actionButton(buttonLabel, t, height * 0.8, width * 0.42, Math.round(height * 0.075), style) : ""}
</svg>`;
  }

  if (isVertical || config.aspectRatio === "4:5") {
    // ── 9:16 e 4:5: empilhado, imagem no topo ──
    const pad = isVertical ? 90 : 70;
    const imgTop = isVertical ? height * 0.2 : height * 0.17;
    const imgH = isVertical ? height * 0.34 : height * 0.33;
    const imgRadius = Math.round(width * 0.045);
    const textTop = imgTop + imgH + (isVertical ? height * 0.08 : height * 0.06);
    const titleSize = isVertical ? Math.round(width * 0.052) : Math.round(width * 0.048);
    const priceSize = isVertical ? Math.round(width * 0.08) : Math.round(width * 0.072);
    const cx = width / 2;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="DM Sans">
  <defs>${defs}</defs>
  <rect width="${width}" height="${height}" rx="${radius}" fill="url(#bg)"/>

  ${config.showTagline && tagline ? taglinePill(tagline, cx, imgTop - (isVertical ? height * 0.06 : height * 0.05), Math.round(width * 0.042), style) : ""}
  ${
    config.showMarketplace && mkt
      ? marketplacePill(
          mkt,
          cx,
          imgTop - (isVertical ? height * 0.055 : height * 0.045),
          Math.round(width * 0.036),
          style,
        )
      : ""
  }

  ${noImage ? "" : `<rect x="${pad}" y="${imgTop}" width="${width - pad * 2}" height="${imgH}" rx="${imgRadius}" fill="${style.surface}"/>`}
  ${noImage ? "" : `<image x="${width * 0.2}" y="${imgTop + 34}" width="${width * 0.6}" height="${imgH - 68}" href="${escapeXml(href)}" preserveAspectRatio="xMidYMid meet"/>`}
  ${config.showBadge && discountBadge && !noImage ? discountBadgeFlourish(discountBadge, width * 0.62, imgTop, Math.round(width * 0.05), style) : ""}

  ${config.showTitle && title ? `<text x="${cx}" y="${textTop}" font-family="DM Sans" font-weight="750" font-size="${titleSize}" text-anchor="middle" fill="${style.textColor}">${title}</text>` : ""}
  ${config.showSubtitle && subtitle ? `<text x="${cx}" y="${textTop + Math.round(titleSize * 1.6)}" font-family="DM Sans" font-weight="500" font-size="${Math.round(width * 0.028)}" text-anchor="middle" fill="${style.mutedText}">${subtitle}</text>` : ""}

  ${
    config.showPrices
      ? `<g>
    ${originalPrice ? `<text x="${cx}" y="${textTop + Math.round(titleSize * 3.4)}" font-family="DM Sans" font-weight="500" font-size="${Math.round(width * 0.034)}" text-decoration="line-through" text-anchor="middle" fill="${style.mutedText}">De: ${originalPrice}</text>` : ""}
    <text x="${cx}" y="${textTop + Math.round(titleSize * 3.4 + priceSize * 1.1)}" font-family="DM Sans" font-weight="800" font-size="${priceSize}" text-anchor="middle" fill="${style.accentColor}">${currentPrice || "R$ 0,00"}</text>
  </g>`
      : ""
  }

  ${config.showCoupon && coupon ? couponChip(coupon, cx, Math.min(textTop + Math.round(titleSize * 5.4), height * 0.8), Math.round(width * 0.05), style) : ""}
  ${config.showButton ? actionButton(buttonLabel, width * 0.16, Math.min(textTop + Math.round(titleSize * 6.6), height * 0.87), width * 0.68, Math.round(width * 0.078), style) : ""}
</svg>`;
  }

  // ── 1:1: quadrado ──
  const pad = 70;
  const imgTop = height * 0.2;
  const imgH = height * 0.3;
  const imgRadius = Math.round(width * 0.045);
  const textTop = imgTop + imgH + height * 0.06;
  const titleSize = Math.round(width * 0.048);
  const priceSize = Math.round(width * 0.072);
  const cx = width / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="DM Sans">
  <defs>${defs}</defs>
  <rect width="${width}" height="${height}" rx="${radius}" fill="url(#bg)"/>

  ${config.showTagline && tagline ? taglinePill(tagline, cx, imgTop - height * 0.05, Math.round(width * 0.042), style) : ""}
  ${config.showMarketplace && mkt ? marketplacePill(mkt, cx, imgTop + height * 0.045, Math.round(width * 0.036), style) : ""}

  ${noImage ? "" : `<rect x="${pad}" y="${imgTop + height * 0.09}" width="${width - pad * 2}" height="${imgH}" rx="${imgRadius}" fill="${style.surface}"/>`}
  ${noImage ? "" : `<image x="${width * 0.2}" y="${imgTop + height * 0.09 + 34}" width="${width * 0.6}" height="${imgH - 68}" href="${escapeXml(href)}" preserveAspectRatio="xMidYMid meet"/>`}
  ${config.showBadge && discountBadge && !noImage ? discountBadgeFlourish(discountBadge, width * 0.62, imgTop + height * 0.09, Math.round(width * 0.05), style) : ""}

  ${config.showTitle && title ? `<text x="${cx}" y="${textTop}" font-family="DM Sans" font-weight="750" font-size="${titleSize}" text-anchor="middle" fill="${style.textColor}">${title}</text>` : ""}
  ${config.showSubtitle && subtitle ? `<text x="${cx}" y="${textTop + Math.round(titleSize * 1.6)}" font-family="DM Sans" font-weight="500" font-size="${Math.round(width * 0.028)}" text-anchor="middle" fill="${style.mutedText}">${subtitle}</text>` : ""}

  ${
    config.showPrices
      ? `<g>
    ${originalPrice ? `<text x="${cx}" y="${textTop + Math.round(titleSize * 3.4)}" font-family="DM Sans" font-weight="500" font-size="${Math.round(width * 0.034)}" text-decoration="line-through" text-anchor="middle" fill="${style.mutedText}">De: ${originalPrice}</text>` : ""}
    <text x="${cx}" y="${textTop + Math.round(titleSize * 3.4 + priceSize * 1.1)}" font-family="DM Sans" font-weight="800" font-size="${priceSize}" text-anchor="middle" fill="${style.accentColor}">${currentPrice || "R$ 0,00"}</text>
  </g>`
      : ""
  }

  ${config.showCoupon && coupon ? couponChip(coupon, cx, Math.min(textTop + Math.round(titleSize * 5.4), height * 0.8), Math.round(width * 0.05), style) : ""}
  ${config.showButton ? actionButton(buttonLabel, width * 0.16, Math.min(textTop + Math.round(titleSize * 6.6), height * 0.86), width * 0.68, Math.round(width * 0.078), style) : ""}
</svg>`;
}

/** Rasteriza o SVG em PNG (base64), com fontes embutidas (sem acesso a disco). */
export async function renderBannerSvgToBase64(svg: string): Promise<string | null> {
  try {
    await ensureWasm();
    const image = new Resvg(svg, {
      background: "transparent",
      font: {
        fontBuffers: [base64ToBytes(DMSANS_400_BASE64), base64ToBytes(DMSANS_700_BASE64)],
        loadSystemFonts: false,
        defaultFontFamily: "DM Sans",
      },
    });
    return bytesToBase64(image.render().asPng());
  } catch (error) {
    console.error("renderBannerSvgToBase64 failed:", error);
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Resolve o banner salvo (id → padrão → primeiro), escopado ao usuário. */
interface BannerRow {
  configuration?: unknown;
  [key: string]: unknown;
}

interface BannerDb {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): { maybeSingle(): Promise<{ data: BannerRow | null }> };
      order(column: string, options: { ascending: boolean }): Promise<{ data: BannerRow[] | null }>;
    };
  };
}

export async function resolveSavedBannerServer(
  db: BannerDb,
  userId: string | undefined,
  bannerId: string | null | undefined,
): Promise<BannerConfig | null> {
  let saved: BannerConfig | null = null;
  try {
    if (bannerId) {
      const chain = db.from("banners").select("*");
      const { data } = await chain.eq("id", bannerId).maybeSingle();
      if (data) saved = bannerConfigOf(data as never);
    }
    if (!saved) {
      const { data } = await db
        .from("banners")
        .select("*")
        .order("created_at", { ascending: true });
      const rows = (data ?? []) as BannerRow[];
      const parsed = rows
        .map((row) => bannerConfigOf(row as never))
        .sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)));
      saved = parsed[0] ?? null;
    }
  } catch {
    // best-effort: banner é um extra, nunca derruba o post
  }
  return saved;
}
