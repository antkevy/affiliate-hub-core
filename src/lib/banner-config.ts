import type { Banner, Json } from "@/types";
import type { BannerConfig, BannerStyle } from "@/types/banner";

export const EMPTY_BANNER_CONFIG: BannerConfig = {
  templateId: "clean-nordic-white",
  title: "",
  subtitle: "",
  originalPrice: "",
  currentPrice: "",
  discountBadge: "",
  installmentText: "",
  couponCode: "",
  buttonText: "VER OFERTA",
  imageUrl: "",
  imageScale: 1,
  imagePositionX: 0,
  imagePositionY: 0,
  aspectRatio: "1:1",
  marketplace: "none",
  tagline: "",
  showSticker: false,
  stickerText: "",
  showButton: true,
  style: {
    backgroundGradient: "from-slate-950 via-zinc-900 to-black",
    textColor: "text-white",
    accentColor: "text-amber-400",
    badgeBg: "bg-yellow-400",
    badgeText: "text-red-950 font-extrabold",
    buttonBg: "bg-yellow-400 hover:bg-yellow-300 text-red-950 font-black",
    buttonText: "COMPRAR COM DESCONTO",
    patternOverlay: "dots",
    glassmorphism: true,
  },
};

export function bannerConfigOf(banner: Banner): BannerConfig {
  const stored = (banner.configuration ?? {}) as BannerConfig;
  const style: BannerStyle = {
    ...EMPTY_BANNER_CONFIG.style,
    ...(stored.style ?? {}),
  };
  return {
    ...EMPTY_BANNER_CONFIG,
    ...stored,
    templateId: stored.templateId ?? EMPTY_BANNER_CONFIG.templateId,
    aspectRatio: stored.aspectRatio ?? EMPTY_BANNER_CONFIG.aspectRatio,
    marketplace: stored.marketplace ?? EMPTY_BANNER_CONFIG.marketplace,
    showButton: stored.showButton ?? true,
    style,
  };
}

export function buildBannerConfiguration(config: BannerConfig): Json {
  return config as unknown as Json;
}
