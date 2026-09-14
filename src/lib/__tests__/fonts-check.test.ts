import { describe, expect, it } from "vitest";
import zlib from "node:zlib";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { RESVG_WASM_BASE64 } from "@/lib/assets/resvg-wasm-base64";
import { DMSANS_400_BASE64 } from "@/lib/assets/dmsans-400-base64";
import { DMSANS_700_BASE64 } from "@/lib/assets/dmsans-700-base64";

function decodeLuma(png: Uint8Array): {
  w: number;
  h: number;
  brightPixels: number;
  totalPixels: number;
} {
  let w = 0;
  let h = 0;
  let ct = 6;
  const idat: Buffer[] = [];
  let pos = 8;
  const buf = Buffer.from(png);
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
  const bpp = ct === 6 ? 4 : 3;
  const stride = w * bpp;
  let bright = 0;
  for (let y = 0; y < h; y += 5) {
    const off = y * stride;
    for (let x = 0; x < w; x += 5) {
      const i = off + x * bpp;
      const lum = 0.3 * (raw[i] ?? 0) + 0.59 * (raw[i + 1] ?? 0) + 0.11 * (raw[i + 2] ?? 0);
      if (lum > 150) bright++;
    }
  }
  return { w, h, brightPixels: bright, totalPixels: Math.ceil(w / 5) * Math.ceil(h / 5) };
}

describe("fontes embutidas", () => {
  it("texto desenha com as fontes DM Sans e some sem elas", async () => {
    await initWasm(Buffer.from(RESVG_WASM_BASE64, "base64"));
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500"><rect width="900" height="500" fill="#111"/><text x="40" y="200" font-family="DM Sans" font-weight="400" font-size="54" fill="#fff">Oferta verifiçada R$ 199,90</text><text x="40" y="300" font-family="DM Sans" font-weight="700" font-size="80" fill="#fbbf24">50% OFF</text></svg>';

    const withFonts = new Resvg(svg, {
      font: {
        fontBuffers: [
          Buffer.from(DMSANS_400_BASE64, "base64"),
          Buffer.from(DMSANS_700_BASE64, "base64"),
        ],
        loadSystemFonts: false,
        defaultFontFamily: "DM Sans",
      },
    })
      .render()
      .asPng();

    const withoutFonts = new Resvg(svg, {
      font: { fontBuffers: [], loadSystemFonts: false, defaultFontFamily: "DM Sans" },
    })
      .render()
      .asPng();

    const a = decodeLuma(withFonts);
    const b = decodeLuma(withoutFonts);
    expect(a.w).toBe(900);
    expect(a.brightPixels).toBeGreaterThan(50);
    expect(a.brightPixels).toBeGreaterThan(b.brightPixels + 50);
  });
});
