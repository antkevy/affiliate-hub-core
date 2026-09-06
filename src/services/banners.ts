import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { createCrud } from "./base";
import type { Banner } from "@/types";

export const bannersService = {
  ...createCrud("banners"),

  /** Renderiza o nó do banner em um Blob PNG em alta resolução. */
  async renderBannerToBlob(node: HTMLElement, scale = 2): Promise<Blob> {
    const dataUrl = await toPng(node, { quality: 0.95, pixelRatio: scale });
    const response = await fetch(dataUrl);
    return response.blob();
  },

  /** Faz upload da prévia no storage público e devolve a URL pública. */
  async uploadPreview(userId: string, bannerId: string, blob: Blob): Promise<string> {
    const path = `${userId}/${bannerId}.png`;
    const { error } = await supabase.storage.from("banners").upload(path, blob, {
      contentType: "image/png",
      upsert: true,
    });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from("banners").getPublicUrl(path);
    return data.publicUrl;
  },

  /** Atualiza a URL de prévia do banner na tabela. */
  async updatePreview(bannerId: string, url: string): Promise<Banner> {
    return bannersService.update(bannerId, { preview_url: url });
  },

  /** Baixa o banner renderizado como arquivo PNG local. */
  async downloadPng(node: HTMLElement, filename: string): Promise<void> {
    const dataUrl = await toPng(node, { quality: 0.95, pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
  },
};
