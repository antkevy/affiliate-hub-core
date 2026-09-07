import { useLayoutEffect, useRef, useState } from "react";
import { Edit3, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bannerConfigOf } from "@/lib/banner-config";
import type { Banner } from "@/types";
import { BannerCanvas } from "./BannerCanvas";

function BannerPreview({ banner }: { banner: Banner }) {
  const config = bannerConfigOf(banner);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(0.35);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const node = canvasRef.current;
    if (!box || !node) return;

    const measure = () => {
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      const boxWidth = box.clientWidth - 16;
      const boxHeight = box.clientHeight - 16;
      if (width > 0 && height > 0 && boxWidth > 0 && boxHeight > 0) {
        setScale(Math.min(boxWidth / width, boxHeight / height));
      }
    };

    measure();

    const observer = new ResizeObserver(() => measure());
    observer.observe(box);
    observer.observe(node);

    return () => observer.disconnect();
  }, [config]);

  const canvasWidth =
    config.aspectRatio === "9:16"
      ? "w-[280px]"
      : config.aspectRatio === "16:9"
        ? "w-[520px]"
        : config.aspectRatio === "4:5"
          ? "w-[340px]"
          : "w-[380px]";

  return (
    <div
      ref={boxRef}
      className="h-full w-full overflow-hidden flex items-center justify-center p-2 bg-slate-950/40 relative"
    >
      <div
        ref={canvasRef}
        className={`shrink-0 origin-center ${canvasWidth} pointer-events-none transition-transform duration-150`}
        style={{ transform: `scale(${scale})` }}
      >
        <BannerCanvas config={config} isPreview />
      </div>
    </div>
  );
}

interface SavedBannersGridProps {
  banners: Banner[];
  onSelectEdit: (banner: Banner) => void;
  onDelete: (banner: Banner) => void;
  onSetDefault?: (banner: Banner) => void;
}

export function SavedBannersGrid({
  banners,
  onSelectEdit,
  onDelete,
  onSetDefault,
}: SavedBannersGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {banners.map((banner) => {
        const config = bannerConfigOf(banner);
        const isDefault = config.isDefault === true;
        return (
          <div key={banner.id} className="panel flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <p className="truncate text-sm font-medium">{banner.name}</p>
                {isDefault && (
                  <Badge className="shrink-0 gap-1 bg-amber-500 text-slate-950 font-bold text-[10px]">
                    <Star className="size-3 fill-slate-950 text-slate-950" />
                    Padrão de Automação
                  </Badge>
                )}
                <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                  {config.aspectRatio}
                </Badge>
                {config.showButton === false && (
                  <Badge
                    variant="secondary"
                    className="shrink-0 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  >
                    Post de Grupo
                  </Badge>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(banner.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onSelectEdit(banner)}
              aria-label={`Editar ${banner.name}`}
              className="group relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden bg-secondary"
            >
              <BannerPreview banner={banner} />
            </button>

            <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onSelectEdit(banner)}
              >
                <Edit3 className="mr-1 size-3.5" />
                Editar
              </Button>
              {onSetDefault && (
                <Button
                  size="sm"
                  variant={isDefault ? "secondary" : "outline"}
                  className={
                    isDefault
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                      : "text-muted-foreground hover:text-foreground"
                  }
                  onClick={() => onSetDefault(banner)}
                  title={
                    isDefault
                      ? "Este banner é o padrão atual"
                      : "Definir este banner como padrão nas automações"
                  }
                >
                  <Star
                    className={`mr-1 size-3.5 ${isDefault ? "fill-amber-500 text-amber-500" : ""}`}
                  />
                  {isDefault ? "Padrão" : "Tornar Padrão"}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(banner)}
              >
                <Trash2 className="mr-1 size-3.5" />
                Excluir
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
