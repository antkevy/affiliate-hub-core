import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { createCrud } from "./base";
import type { Json } from "@/types";
import type { Banner } from "@/types";

export const bannersService = {
  ...createCrud("banners"),

  /** Renderiza o nó do banner em um Blob PNG em alta resolução. */
  async renderBannerToBlob(node: HTMLElement, scale = 2): Promise<Blob> {
    const dataUrl = await toPng(node, { quality: 0.95, pixelRatio: scale });
    const response = await fetch(dataUrl);
    return response.blob();
  },

  /** Faz upload da prévia no storage privado e devolve o caminho do arquivo. */
  async uploadPreview(userId: string, bannerId: string, blob: Blob): Promise<string> {
    const path = `${userId}/${bannerId}.png`;
    const { error } = await supabase.storage.from("banners").upload(path, blob, {
      contentType: "image/png",
      upsert: true,
    });
    if (error) throw new Error(error.message);
    return path;
  },

  /** Gera uma URL assinada temporária para exibir a prévia do banner. */
  async signedPreviewUrl(pathOrUrl: string, expiresIn = 3600): Promise<string | null> {
    if (/^https?:\/\//i.test(pathOrUrl)) {
      const marker = "/banners/";
      const index = pathOrUrl.indexOf(marker);
      if (index === -1) return null;
      pathOrUrl = pathOrUrl.slice(index + marker.length);
    }
    const { data, error } = await supabase.storage
      .from("banners")
      .createSignedUrl(pathOrUrl, expiresIn);
    if (error) return null;
    return data.signedUrl;
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

  /** Define um banner como o padrão para automações/capturas e desmarca os demais. */
  async setDefault(bannerId: string): Promise<void> {
    const { data, error } = await supabase.from("banners").select("id, configuration");
    if (error) throw new Error(error.message);
    const { bannerConfigOf, buildBannerConfiguration } = await import("@/lib/banner-config");
    const toUpdate: { id: string; configuration: Json }[] = [];
    for (const item of data ?? []) {
      const config = bannerConfigOf(item as Banner);
      const isTarget = item.id === bannerId;
      if (Boolean(config.isDefault) !== isTarget) {
        config.isDefault = isTarget;
        toUpdate.push({ id: item.id, configuration: buildBannerConfiguration(config) });
      }
    }
    await Promise.all(
      toUpdate.map((item) => bannersService.update(item.id, { configuration: item.configuration })),
    );
  },
};
