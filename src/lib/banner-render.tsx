import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { toPng } from "html-to-image";
import { BannerCanvas } from "@/components/banners/BannerCanvas";
import { BANNER_TEMPLATES } from "@/components/banners/bannerTemplatesData";
import { detectMarketplace } from "@/lib/telegram";
import type { BannerConfig, MarketplaceBrand } from "@/types/banner";
import type { Offer } from "@/types";

const BRANDS: MarketplaceBrand[] = ["mercado-livre", "shopee", "amazon", "magalu", "aliexpress"];

function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Mapeia slug de marketplace detectado para a marca suportada pelo banner. */
function brandFromSlug(slug: string | null): MarketplaceBrand {
  if (slug && BRANDS.some((brand) => brand === slug)) return slug as MarketplaceBrand;
  return "none";
}

/** Monta a configuração do banner a partir dos dados da oferta (e de um banner salvo opcional). */
export function buildOfferBannerConfig(
  offer: Offer,
  marketplaceName: string | null,
  imageDataUrl: string | null,
  saved?: BannerConfig | null,
): BannerConfig {
  const brand = brandFromSlug(detectMarketplace(offer.original_url ?? null, offer.title));
  const discount =
    offer.discount_percentage !== null && offer.discount_percentage !== undefined
      ? `${offer.discount_percentage}% OFF`
      : "";
  const fallback = BANNER_TEMPLATES[0]?.defaultConfig ?? baseFallback();
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
    imageUrl: imageDataUrl || saved?.imageUrl || "",
    marketplace: brand !== "none" ? brand : (saved?.marketplace ?? "none"),
    tagline: marketplaceName
      ? `${marketplaceName} · Oferta verificada`
      : (saved?.tagline ?? fallback.tagline ?? ""),
    showSticker: discount ? true : (saved?.showSticker ?? fallback.showSticker ?? false),
    stickerText: discount || (saved?.stickerText ?? ""),
    showButton: saved?.showButton ?? fallback.showButton ?? true,
    buttonText: saved?.buttonText ?? "GARANTIR OFERTA",
    aspectRatio: saved?.aspectRatio ?? "1:1",
    subtitle: saved?.subtitle ?? "Aproveite enquanto dura · Oferta verificada",
  };
}

function baseFallback(): BannerConfig {
  return BANNER_TEMPLATES[0]?.defaultConfig ?? ({} as BannerConfig);
}

/** Baixa a imagem do produto como data URL (falha silenciosa em caso de CORS). */
export async function loadImageAsDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Baixa a imagem do produto como Blob cru (para anexar no media group). */
export async function loadImageAsBlob(url: string | null): Promise<Blob | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

/**
 * Monta um BannerCanvas fora da tela e o converte em PNG (client-side).
 * Retorna null se o DOM/html-to-image não estiver disponível (ex.: SSR).
 */
export async function renderBannerToBlob(config: BannerConfig, scale = 2): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:600px;z-index:-2147483647;pointer-events:none;";
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    flushSync(() => {
      root.render(<BannerCanvas config={config} isPreview />);
    });
    await waitForImages(host);
    const canvas = host.querySelector("div") as HTMLElement | null;
    if (!canvas) return null;
    const dataUrl = await toPng(canvas, { quality: 0.95, pixelRatio: scale });
    const response = await fetch(dataUrl);
    return await response.blob();
  } catch {
    return null;
  } finally {
    root.unmount();
    host.remove();
  }
}

function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  const pending = images
    .filter((img) => !img.complete)
    .map(
      (img) =>
        new Promise<unknown>((resolve) => {
          img.onload = () => resolve(undefined);
          img.onerror = () => resolve(undefined);
        }),
    );
  const settled = Promise.allSettled(pending).then(() => undefined);
  return Promise.race([settled, new Promise<void>((resolve) => setTimeout(resolve, 2000))]);
}
