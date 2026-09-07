import { forwardRef } from "react";
import type { BannerConfig } from "@/types/banner";
import { CheckCircle2, ShoppingBag, Sparkles, Tag } from "lucide-react";
import { MarketplaceLogo, marketplaceLabel } from "@/components/marketplace/MarketplaceLogo";

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
            {tagline && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase border border-white/20 shadow-sm">
                <Sparkles className="h-3 w-3 text-yellow-300" />
                {tagline}
              </span>
            )}
            {marketplace !== "none" && (
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
          <div className="relative z-10 grid grid-cols-12 gap-4 items-center my-auto">
            <div className="col-span-5 flex justify-center items-center">
              <div className="relative h-44 w-full rounded-xl bg-white/10 backdrop-blur-md p-2 border border-white/20 shadow-xl overflow-hidden flex items-center justify-center">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={title}
                    className="max-h-full max-w-full object-contain drop-shadow-2xl transition-transform duration-300"
                    style={{
                      transform: `scale(${imageScale}) translate(${imagePositionX}px, ${imagePositionY}px)`,
                    }}
                  />
                ) : (
                  <ShoppingBag className="h-16 w-16 text-white/40" />
                )}
                {discountBadge && (
                  <div className="absolute top-2 left-2 rounded-lg bg-red-600 text-white font-extrabold px-2.5 py-1 text-xs shadow-md">
                    {discountBadge}
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-7 space-y-2 text-left">
              <h2
                className={`font-black tracking-tight leading-tight line-clamp-2 ${style.textColor} text-xl`}
              >
                {title || "NOME DO PRODUTO"}
              </h2>
              {subtitle && (
                <p className="text-xs text-white/80 line-clamp-1 font-medium">{subtitle}</p>
              )}

              <div className="pt-1 flex items-baseline gap-2 flex-wrap">
                {originalPrice && (
                  <span className="text-xs text-white/60 line-through font-semibold">
                    {originalPrice}
                  </span>
                )}
                <span className={`text-2xl font-black ${style.accentColor} drop-shadow-md`}>
                  {currentPrice || "R$ 0,00"}
                </span>
                {installmentText && (
                  <span className="text-[11px] text-white/80 font-medium">{installmentText}</span>
                )}
              </div>

              {couponCode && (
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-black/30 backdrop-blur-sm border border-dashed border-white/40 px-2.5 py-1 text-xs font-mono font-bold text-white">
                  <Tag className="h-3 w-3 text-yellow-400" />
                  CUPOM: <span className="text-yellow-300">{couponCode}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex-1 flex flex-col justify-center items-center my-3 text-center space-y-4">
            <div
              className={`relative w-full ${isVertical ? "h-64" : "h-48"} flex items-center justify-center`}
            >
              <div className="relative h-full w-full max-w-[280px] rounded-2xl bg-white/10 backdrop-blur-md p-3 border border-white/20 shadow-2xl overflow-hidden flex items-center justify-center">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={title}
                    className="max-h-full max-w-full object-contain drop-shadow-2xl transition-transform duration-300"
                    style={{
                      transform: `scale(${imageScale}) translate(${imagePositionX}px, ${imagePositionY}px)`,
                    }}
                  />
                ) : (
                  <ShoppingBag className="h-20 w-20 text-white/40" />
                )}

                {discountBadge && (
                  <div
                    className={`absolute top-3 right-3 rounded-xl ${style.badgeBg} ${style.badgeText} px-3 py-1.5 text-xs tracking-wider shadow-xl transform rotate-2 border border-white/40`}
                  >
                    {discountBadge}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5 max-w-xs mx-auto">
              <h2
                className={`font-black tracking-tight leading-snug line-clamp-2 ${style.textColor} ${
                  isVertical ? "text-2xl" : "text-lg"
                }`}
              >
                {title || "TÍTULO DO PRODUTO"}
              </h2>
              {subtitle && (
                <p className="text-xs text-white/80 font-medium line-clamp-2 px-2">{subtitle}</p>
              )}
            </div>

            <div className="space-y-1 bg-black/20 backdrop-blur-md px-5 py-2.5 rounded-xl border border-white/15 inline-block w-full max-w-xs shadow-inner">
              <div className="flex items-center justify-center gap-2">
                {originalPrice && (
                  <span className="text-xs text-white/60 line-through font-medium">
                    De: {originalPrice}
                  </span>
                )}
                <span className="text-xs text-white/80 font-bold">Por apenas:</span>
              </div>
              <div
                className={`text-3xl font-black ${style.accentColor} tracking-tight drop-shadow-lg`}
              >
                {currentPrice || "R$ 0,00"}
              </div>
              {installmentText && (
                <p className="text-[11px] text-white/90 font-semibold">{installmentText}</p>
              )}
            </div>

            {couponCode && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 px-3.5 py-1.5 text-xs font-mono font-bold text-white shadow-md">
                <Tag className="h-3.5 w-3.5 text-yellow-300" />
                CUPOM:{" "}
                <span className="text-yellow-300 underline decoration-yellow-400 font-extrabold">
                  {couponCode}
                </span>
              </div>
            )}
          </div>
        )}

        {showButton && (
          <div className="relative z-10 pt-2">
            <button
              type="button"
              className={`w-full rounded-xl py-3 px-4 text-center font-black tracking-wider shadow-2xl transition-all duration-200 flex items-center justify-center gap-2 uppercase text-sm ${style.buttonBg} ${
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
