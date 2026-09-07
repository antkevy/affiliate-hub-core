import type { Banner, Json } from "@/types";
import type { BannerConfig, BannerStyle } from "@/types/banner";

export const EMPTY_BANNER_CONFIG: BannerConfig = {
  templateId: "black-gold-default",
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
  showTitle: true,
  showSubtitle: true,
  showPrices: true,
  showBadge: true,
  showCoupon: true,
  showTagline: true,
  showMarketplace: true,
  style: {
    backgroundGradient: "from-slate-950 via-zinc-900 to-black",
    textColor: "text-white",
    accentColor: "text-amber-400",
    badgeBg: "bg-amber-400",
    badgeText: "text-slate-950 font-black",
    buttonBg: "bg-amber-400 hover:bg-amber-300 text-slate-950 font-black",
    buttonText: "VER OFERTA",
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
    showTitle: stored.showTitle ?? true,
    showSubtitle: stored.showSubtitle ?? true,
    showPrices: stored.showPrices ?? true,
    showBadge: stored.showBadge ?? true,
    showCoupon: stored.showCoupon ?? true,
    showTagline: stored.showTagline ?? true,
    showMarketplace: stored.showMarketplace ?? true,
    isDefault: stored.isDefault ?? false,
    style,
  };
}

export function buildBannerConfiguration(config: BannerConfig): Json {
  return config as unknown as Json;
}
