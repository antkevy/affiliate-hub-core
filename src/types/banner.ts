import type { Database } from "@/integrations/supabase/types";

export type BannerAspectRatio = "1:1" | "9:16" | "16:9" | "4:5";

export type MarketplaceBrand =
  "mercado-livre" | "shopee" | "amazon" | "magalu" | "aliexpress" | "none";

export type BannerCategory =
  "promocional" | "datas_especiais" | "minimalista" | "social" | "exclusivo";

export type BannerStyle = {
  backgroundGradient: string;
  backgroundColor?: string;
  textColor: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  buttonBg: string;
  buttonText: string;
  patternOverlay?: "dots" | "waves" | "grid" | "none";
  glassmorphism?: boolean;
};

export type BannerConfig = {
  templateId: string;
  title: string;
  subtitle?: string;
  originalPrice: string;
  currentPrice: string;
  discountBadge: string;
  installmentText?: string;
  couponCode?: string;
  buttonText: string;
  imageUrl: string;
  imageScale?: number;
  imagePositionX?: number;
  imagePositionY?: number;
  aspectRatio: BannerAspectRatio;
  marketplace: MarketplaceBrand;
  style: BannerStyle;
  tagline?: string;
  showSticker?: boolean;
  stickerText?: string;
  showButton?: boolean;
};

export type BannerTemplate = {
  id: string;
  name: string;
  category: BannerCategory;
  description: string;
  defaultConfig: BannerConfig;
};
