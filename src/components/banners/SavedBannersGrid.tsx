import { useEffect, useState } from "react";
import { Edit3, ImageIcon, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bannerConfigOf } from "@/lib/banner-config";
import { bannersService } from "@/services/banners";
import type { Banner } from "@/types";

function BannerPreview({ banner }: { banner: Banner }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!banner.preview_url) return;
    bannersService
      .signedPreviewUrl(banner.preview_url)
      .then((value) => {
        if (active) setUrl(value);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
    };
  }, [banner.preview_url]);

  if (!url) {
    return (
      <span className="flex flex-col items-center gap-2 text-muted-foreground">
        <ImageIcon className="size-6" />
        <span className="text-xs">Sem imagem gerada</span>
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={banner.name}
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
    />
  );
}

interface SavedBannersGridProps {
  banners: Banner[];
  onSelectEdit: (banner: Banner) => void;
  onDelete: (banner: Banner) => void;
}

export function SavedBannersGrid({ banners, onSelectEdit, onDelete }: SavedBannersGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {banners.map((banner) => {
        const config = bannerConfigOf(banner);
        return (
          <div key={banner.id} className="panel flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-medium">{banner.name}</p>
                <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                  {config.aspectRatio}
                </Badge>
                {config.showButton === false && (
                  <Badge variant="secondary" className="shrink-0 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
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

            <div className="flex items-center gap-2 border-t border-border p-3">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onSelectEdit(banner)}
              >
                <Edit3 className="mr-1 size-3.5" />
                Editar
              </Button>
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
