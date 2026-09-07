import { forwardRef, useEffect, useState } from "react";
import type { BannerConfig } from "@/types/banner";
import { CheckCircle2, ShoppingBag, Sparkles, Tag } from "lucide-react";
import { MarketplaceLogo, marketplaceLabel } from "@/components/marketplace/MarketplaceLogo";

function ProductPhoto({
  url,
  alt,
  className,
  style,
  fallbackClassName,
}: {
  url?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  fallbackClassName?: string;
}) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [url]);

  if (!url || broken) {
    return <ShoppingBag className={fallbackClassName} />;
  }

  return (
    <img
      src={url}
      alt={alt}
      draggable={false}
      onError={() => setBroken(true)}
      className={className}
      style={style}
    />
  );
}

interface BannerCanvasProps {
  config: BannerConfig;
  className?: string;
  isPreview?: boolean;
}

export const BannerCanvas = forwardRef<HTMLDivElement, BannerCanvasProps>(
  ({ config, className = "", isPreview = false }, ref) => {
    const {
      title,
      subtitle,
      originalPrice,
      currentPrice,
      discountBadge,
      installmentText,
      couponCode,
      buttonText,
      showButton = true,
      showTitle = true,
      showSubtitle = true,
      showPrices = true,
      showBadge = true,
      showCoupon = true,
      showTagline = true,
      showMarketplace = true,
      imageUrl,
      imageScale = 1,
      imagePositionX = 0,
      imagePositionY = 0,
      aspectRatio,
      marketplace,
      style,
      tagline,
      showSticker,
      stickerText,
    } = config;

    const getAspectRatioClass = () => {
      switch (aspectRatio) {
        case "9:16":
          return "aspect-[9/16] min-h-[500px]";
        case "16:9":
          return "aspect-[16/9] min-h-[280px]";
        case "4:5":
          return "aspect-[4/5] min-h-[420px]";
        case "1:1":
        default:
          return "aspect-square min-h-[380px]";
      }
    };

    const isHorizontal = aspectRatio === "16:9";
    const isVertical = aspectRatio === "9:16";
    const isCompactText = !showTitle && !showSubtitle;

    const isLightTheme =
      style.textColor?.includes("slate-950") ||
      style.textColor?.includes("slate-900") ||
      style.textColor?.includes("black") ||
      style.backgroundGradient?.includes("slate-100") ||
      style.backgroundGradient?.includes("white");

    return (
      <div
        ref={ref}
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${style.backgroundGradient} p-6 shadow-2xl transition-all duration-300 flex flex-col justify-between select-none ${getAspectRatioClass()} ${className}`}
        style={{
          backgroundColor: style.backgroundColor,
        }}
      >
        {style.patternOverlay === "dots" && (
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, #fff 1.5px, transparent 1.5px)",
              backgroundSize: "20px 20px",
            }}
          />
        )}
        {style.patternOverlay === "grid" && (
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "30px 30px",
            }}
          />
        )}
        {style.patternOverlay === "waves" && (
          <div className="absolute inset-0 opacity-15 pointer-events-none overflow-hidden">
            <svg
              className="absolute -top-10 -right-10 w-96 h-96 text-white/20"
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="currentColor"
                d="M44.5,-73.4C56.6,-67.2,64.8,-53.8,70.9,-40.1C77,-26.4,81.1,-12.4,80.1,1.2C79.1,14.8,73,28,64.7,39.8C56.4,51.6,45.9,62.1,33.4,68.9C20.9,75.7,6.4,78.9,-7.7,77.7C-21.8,76.5,-35.5,70.9,-46.8,61.9C-58.1,52.9,-67,40.5,-72.1,26.7C-77.2,12.9,-78.5,-2.3,-75.1,-16.9C-71.7,-31.5,-63.6,-45.5,-52.1,-52.2C-40.6,-58.9,-25.7,-58.3,-11.5,-60.1C2.7,-61.9,32.4,-79.6,44.5,-73.4Z"
                transform="translate(100 100)"
              />
            </svg>
          </div>
        )}

        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {showTagline && tagline && (
              <span
                className={`inline-flex items-center gap-1 rounded-full backdrop-blur-md px-3 py-1 text-xs font-semibold tracking-wide uppercase shadow-sm ${
                  isLightTheme
                    ? "bg-slate-900/10 text-slate-900 border border-slate-900/15"
                    : "bg-white/20 text-white border border-white/20"
                }`}
              >
                <Sparkles
                  className={`h-3 w-3 ${isLightTheme ? "text-amber-600" : "text-yellow-300"}`}
                />
                {tagline}
              </span>
            )}
            {showMarketplace && marketplace !== "none" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-900 dark:text-white shadow-md border border-white/40">
                <MarketplaceLogo marketplace={marketplace} size={18} />
                <span>{marketplaceLabel(marketplace)}</span>
              </span>
            )}
          </div>

          {showSticker && stickerText && (
            <div className="relative animate-bounce">
              <div className="rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 font-black px-3 py-1 text-xs shadow-lg uppercase tracking-wider transform rotate-3 border-2 border-white/80">
                {stickerText}
              </div>
            </div>
          )}
        </div>

        {isHorizontal ? (
          <div className="relative z-10 grid grid-cols-12 gap-3 items-center my-auto flex-1 min-h-0">
            <div
              className={`${isCompactText ? "col-span-6" : "col-span-5"} flex justify-center items-center h-full min-h-0`}
            >
              <div
                className={`relative ${isCompactText ? "h-44" : "h-36"} w-full rounded-xl ${
                  isLightTheme
                    ? "bg-black/5 border-black/10 shadow-lg"
                    : "bg-white/10 border-white/20 shadow-xl"
                } backdrop-blur-md p-2 overflow-hidden flex items-center justify-center`}
              >
                <ProductPhoto
                  url={imageUrl}
                  alt={title}
                  className="max-h-full max-w-full object-contain drop-shadow-2xl transition-transform duration-300"
                  style={{
                    transform: `scale(${imageScale}) translate(${imagePositionX}px, ${imagePositionY}px)`,
                  }}
                  fallbackClassName={`h-14 w-14 ${isLightTheme ? "text-slate-400" : "text-white/40"}`}
                />
                {showBadge && discountBadge && (
                  <div className="absolute top-2 left-2 rounded-lg bg-red-600 text-white font-extrabold px-2 py-0.5 text-[11px] shadow-md">
                    {discountBadge}
                  </div>
                )}
              </div>
            </div>

            <div className={`${isCompactText ? "col-span-6" : "col-span-7"} space-y-1.5 text-left`}>
              {showTitle && (
                <h2
                  className={`font-black tracking-tight leading-tight line-clamp-2 ${style.textColor} text-base sm:text-lg`}
                >
                  {title || "NOME DO PRODUTO"}
                </h2>
              )}
              {showSubtitle && subtitle && (
                <p
                  className={`text-[11px] line-clamp-1 font-medium ${isLightTheme ? "text-slate-600" : "text-white/80"}`}
                >
                  {subtitle}
                </p>
              )}

              {showPrices && (
                <div className="pt-0.5 flex items-baseline gap-1.5 flex-wrap">
                  {originalPrice && (
                    <span
                      className={`text-[11px] line-through font-semibold ${isLightTheme ? "text-slate-500" : "text-white/60"}`}
                    >
                      {originalPrice}
                    </span>
                  )}
                  <span className={`text-xl sm:text-2xl font-black ${style.accentColor} drop-shadow-md`}>
                    {currentPrice || "R$ 0,00"}
                  </span>
                  {installmentText && (
                    <span
                      className={`text-[10px] font-medium ${isLightTheme ? "text-slate-600" : "text-white/80"}`}
                    >
                      {installmentText}
                    </span>
                  )}
                </div>
              )}

              {showCoupon && couponCode && (
                <div
                  className={`inline-flex items-center gap-1 rounded-lg backdrop-blur-sm border border-dashed px-2 py-0.5 text-[11px] font-mono font-bold ${
                    isLightTheme
                      ? "bg-slate-900/10 border-slate-900/30 text-slate-900"
                      : "bg-black/30 border-white/40 text-white"
                  }`}
                >
                  <Tag
                    className={`h-3 w-3 ${isLightTheme ? "text-amber-600" : "text-yellow-400"}`}
                  />
                  CUPOM:{" "}
                  <span
                    className={isLightTheme ? "text-amber-700 font-extrabold" : "text-yellow-300"}
                  >
                    {couponCode}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex-1 min-h-0 flex flex-col justify-between items-center my-2 text-center gap-2">
            <div
              className={`relative w-full flex-1 min-h-0 flex items-center justify-center ${
                isCompactText ? (isVertical ? "max-h-[260px]" : "max-h-[220px]") : isVertical ? "max-h-[200px]" : "max-h-[140px]"
              }`}
            >
              <div
                className={`relative h-full w-full ${
                  isCompactText ? "max-w-[320px]" : "max-w-[260px]"
                } rounded-2xl ${
                  isLightTheme
                    ? "bg-black/5 border-black/10 shadow-lg"
                    : "bg-white/10 border-white/20 shadow-2xl"
                } backdrop-blur-md p-2 overflow-hidden flex items-center justify-center`}
              >
                <ProductPhoto
                  url={imageUrl}
                  alt={title}
                  className="max-h-full max-w-full object-contain drop-shadow-2xl transition-transform duration-300"
                  style={{
                    transform: `scale(${imageScale}) translate(${imagePositionX}px, ${imagePositionY}px)`,
                  }}
                  fallbackClassName={`h-16 w-16 ${isLightTheme ? "text-slate-400" : "text-white/40"}`}
                />

                {showBadge && discountBadge && (
                  <div
                    className={`absolute top-2 right-2 rounded-lg ${style.badgeBg} ${style.badgeText} px-2.5 py-1 text-[11px] tracking-wider shadow-xl transform rotate-2 border border-white/40`}
                  >
                    {discountBadge}
                  </div>
                )}
              </div>
            </div>

            {(showTitle || (showSubtitle && subtitle)) && (
              <div className="space-y-0.5 max-w-xs mx-auto shrink-0">
                {showTitle && (
                  <h2
                    className={`font-black tracking-tight leading-snug line-clamp-2 ${style.textColor} ${
                      isVertical ? "text-xl sm:text-2xl" : "text-sm sm:text-base"
                    }`}
                  >
                    {title || "TÍTULO DO PRODUTO"}
                  </h2>
                )}
                {showSubtitle && subtitle && (
                  <p
                    className={`text-[11px] font-medium line-clamp-1 px-2 ${isLightTheme ? "text-slate-600" : "text-white/80"}`}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            )}

            {showPrices && (
              <div
                className={`shrink-0 space-y-0.5 ${
                  isLightTheme
                    ? "bg-slate-900/10 border-slate-900/15"
                    : "bg-black/20 border-white/15"
                } backdrop-blur-md px-4 py-1.5 rounded-xl border inline-block w-full max-w-[260px] shadow-inner`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {originalPrice && (
                    <span
                      className={`text-[11px] line-through font-medium ${isLightTheme ? "text-slate-500" : "text-white/60"}`}
                    >
                      De: {originalPrice}
                    </span>
                  )}
                  <span
                    className={`text-[11px] font-bold ${isLightTheme ? "text-slate-700" : "text-white/80"}`}
                  >
                    Por:
                  </span>
                </div>
                <div
                  className={`text-2xl sm:text-3xl font-black leading-none ${style.accentColor} tracking-tight drop-shadow-lg`}
                >
                  {currentPrice || "R$ 0,00"}
                </div>
                {installmentText && (
                  <p
                    className={`text-[10px] font-semibold ${isLightTheme ? "text-slate-700" : "text-white/90"}`}
                  >
                    {installmentText}
                  </p>
                )}
              </div>
            )}

            {showCoupon && couponCode && (
              <div
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg backdrop-blur-md border px-3 py-1 text-[11px] font-mono font-bold shadow-md ${
                  isLightTheme
                    ? "bg-slate-900/10 border-slate-900/20 text-slate-900"
                    : "bg-white/20 border-white/30 text-white"
                }`}
              >
                <Tag
                  className={`h-3 w-3 ${isLightTheme ? "text-amber-600" : "text-yellow-300"}`}
                />
                CUPOM:{" "}
                <span
                  className={`underline font-extrabold ${
                    isLightTheme
                      ? "text-amber-700 decoration-amber-600"
                      : "text-yellow-300 decoration-yellow-400"
                  }`}
                >
                  {couponCode}
                </span>
              </div>
            )}
          </div>
        )}

        {showButton && (
          <div className="relative z-10 pt-1 shrink-0">
            <button
              type="button"
              className={`w-full rounded-xl py-2.5 px-4 text-center font-black tracking-wider shadow-2xl transition-all duration-200 flex items-center justify-center gap-2 uppercase text-xs sm:text-sm ${style.buttonBg} ${
                isPreview ? "cursor-default" : "hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              <span>{buttonText || "GARANTIR OFERTA"}</span>
              <CheckCircle2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  },
);

BannerCanvas.displayName = "BannerCanvas";
