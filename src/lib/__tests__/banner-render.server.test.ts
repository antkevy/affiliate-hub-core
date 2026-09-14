import { describe, expect, it } from "vitest";
import zlib from "node:zlib";
import {
  buildOfferBannerConfigServer,
  buildOfferSvg,
  renderBannerSvgToBase64,
} from "@/lib/banner-render.server";
import { EMPTY_BANNER_CONFIG } from "@/lib/banner-config";
import type { BannerAspectRatio, BannerConfig } from "@/types/banner";
import type { Offer } from "@/types";

const offer: Offer = {
  id: "oferta-teste",
  user_id: "u1",
  source_id: "src-1",
  title: "Fone Bluetooth XT-200 com cancelamento de ruído ativo e bateria de 40 horas",
  original_url: "https://shopee.com.br/product/123",
  sale_price: 199.9,
  original_price: 399.9,
  discount_percentage: 50,
  coupon: "FONE50",
  currency: "BRL",
  marketplace_id: "mkt-1",
  status: "captured",
  captured_at: new Date().toISOString(),
  affiliate_url: null,
  created_at: "2026-01-01T00:00:00.000Z",
  processed_at: null,
  product_id: null,
  updated_at: "2026-01-01T00:00:00.000Z",
} as Offer;

const FALLBACK_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function pngInfo(base64: string): {
  width: number;
  height: number;
  brightSamples: number;
} {
  const buf = Buffer.from(base64, "base64");
  expect(buf[0]).toBe(0x89);
  let w = 0;
  let h = 0;
  let ct = 6;
  const idat: Buffer[] = [];
  let pos = 8;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString("ascii");
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      ct = data[9] ?? 6;
    }
    if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const samples = Math.ceil(w / 6) * Math.ceil(h / 6);
  const stride = w * (ct === 6 ? 4 : 3);
  let bright = 0;
  for (let y = 0; y < h; y += 6) {
    const off = y * stride;
    for (let x = 0; x < w; x += 6) {
      const i = off + x * (ct === 6 ? 4 : 3);
      const lum = 0.3 * (raw[i] ?? 0) + 0.59 * (raw[i + 1] ?? 0) + 0.11 * (raw[i + 2] ?? 0);
      if (lum > 150) bright++;
    }
  }
  return { width: w, height: h, brightSamples: bright };
}

describe("banner render server", () => {
  it("gera PNG válido para todos os aspect ratios com imagem embutida", async () => {
    const res = await fetch("https://picsum.photos/seed/fone/900/900");
    const imageBytes = res.ok
      ? Buffer.from(new Uint8Array(await res.arrayBuffer())).toString("base64")
      : FALLBACK_PNG;

    const expected = {
      "1:1": [1080, 1080],
      "4:5": [1080, 1350],
      "9:16": [1080, 1920],
      "16:9": [1920, 1080],
    } as const;

    for (const [aspectRatio, size] of Object.entries(expected)) {
      const saved: BannerConfig = {
        ...EMPTY_BANNER_CONFIG,
        aspectRatio: aspectRatio as BannerAspectRatio,
      };
      const config = buildOfferBannerConfigServer(offer, "Shopee", saved);
      const svg = buildOfferSvg(config, { base64: imageBytes });
      expect(svg).toContain("linearGradient");
      expect(svg).toContain("data:image");
      const png = (await renderBannerSvgToBase64(svg)) as string;
      const info = pngInfo(png);
      expect(info.width).toBe(size[0]);
      expect(info.height).toBe(size[1]);
      expect(info.brightSamples).toBeGreaterThan(0);
    }
  }, 60000);

  it("renderiza sem imagem (placeholder) e com tema claro", async () => {
    for (const saved of [
      { ...EMPTY_BANNER_CONFIG, aspectRatio: "1:1" as const },
      {
        ...EMPTY_BANNER_CONFIG,
        aspectRatio: "16:9" as const,
        style: {
          ...EMPTY_BANNER_CONFIG.style,
          backgroundGradient: "from-slate-100 via-white to-slate-200",
          textColor: "text-slate-950",
          accentColor: "text-blue-700",
          badgeBg: "bg-rose-600",
          badgeText: "text-white",
          buttonBg: "from-blue-700 to-indigo-600",
        },
      },
    ]) {
      const config = buildOfferBannerConfigServer(offer, "Mercado Livre", saved);
      const png = (await renderBannerSvgToBase64(buildOfferSvg(config, {}))) as string;
      expect(png.length).toBeGreaterThan(2000);
    }
  });

  it("config espelha os dados da oferta", () => {
    const config = buildOfferBannerConfigServer(offer, "Shopee", null);
    expect(config.discountBadge).toBe("50% OFF");
    expect(config.couponCode).toBe("FONE50");
    expect(config.marketplace).toBe("shopee");
    expect(config.currentPrice).toContain("199");
  });
});
