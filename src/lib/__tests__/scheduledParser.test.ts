import { describe, it, expect } from "vitest";
import { parseFeedXmlServer, parseJsonEntriesServer } from "@/lib/scheduled.server";

describe("parseFeedXmlServer", () => {
  it("parses RSS items with prices and coupon", () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Fone Bluetooth XZ</title>
    <link>https://example.com/produto-1</link>
    <salePrice>R$ 149,90</salePrice>
    <originalPrice>R$ 249,90</originalPrice>
    <price>149.90</price>
    <coupon>HUB40</coupon>
  </item>
  <item><title>Sem preço</title><link>https://example.com/produto-2</link></item>
</channel></rss>`;

    const items = parseFeedXmlServer(xml, "source-1");
    expect(items).toHaveLength(2);
    expect(items[0]?.title).toBe("Fone Bluetooth XZ");
    expect(items[0]?.sale_price).toBeCloseTo(149.9);
    expect(items[0]?.original_price).toBeCloseTo(249.9);
    expect(items[0]?.discount_percentage).toBe(40);
    expect(items[0]?.coupon).toBe("HUB40");
    expect(items[0]?.original_url).toBe("https://example.com/produto-1");
    expect(items[1]?.sale_price).toBeNull();
  });

  it("reads Atom link via href attribute", () => {
    const xml = `<feed><entry>
      <title>Headset RGB</title>
      <link href="https://example.com/headset" rel="alternate"/>
    </entry></feed>`;
    const items = parseFeedXmlServer(xml, "source-1");
    expect(items[0]?.original_url).toBe("https://example.com/headset");
  });
});

describe("parseJsonEntriesServer", () => {
  it("extracts results array and nested product fields", () => {
    const items = parseJsonEntriesServer(
      {
        results: [
          {
            product: {
              title: "Notebook",
              price: "R$ 2.799,00",
              original_price: 3999,
              url: "https://example.com/nb",
            },
            coupon: "NOTE20",
          },
        ],
      },
      "source-1",
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Notebook");
    expect(items[0]?.sale_price).toBeCloseTo(2799);
    expect(items[0]?.original_price).toBe(3999);
    expect(items[0]?.coupon).toBe("NOTE20");
    expect(items[0]?.original_url).toBe("https://example.com/nb");
  });
});
