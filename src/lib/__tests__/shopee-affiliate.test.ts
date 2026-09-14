import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureShopeeOffers,
  generateShopeeShortLink,
  parseShopeeProduct,
  parseShopeeProducts,
  shopeeGraphql,
  signShopeeRequest,
} from "@/lib/shopee-affiliate.server";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

describe("signShopeeRequest", () => {
  it("builds the SHA256 Credential header with a deterministic signature", () => {
    const appId = "1001";
    const secret = "my-secret";
    const timestamp = "1700000000";
    const payload = '{"query":"{ hi }"}';
    const expected = createHash("sha256")
      .update(`${appId}${timestamp}${payload}${secret}`, "utf8")
      .digest("hex");
    expect(signShopeeRequest(appId, secret, timestamp, payload)).toBe(
      `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${expected}`,
    );
  });

  it("changes when the payload changes", () => {
    const base = signShopeeRequest("1", "s", "1700000000", '{"a":1}');
    const other = signShopeeRequest("1", "s", "1700000000", '{"a":2}');
    expect(base).not.toBe(other);
  });
});

describe("shopeeGraphql", () => {
  it("returns parsed data on success", async () => {
    mockFetch({ data: { productOfferV2: { nodes: [{ itemId: 123 }] } } });
    const json = await shopeeGraphql("c", "s", {
      query: "query { hi }",
      variables: {},
    });
    expect(json.data?.productOfferV2?.nodes?.[0]).toEqual({ itemId: 123 });
  });

  it("sends the exact JSON payload and the signed header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const payload = { query: "query { hi }", variables: { url: "https://x" } };
    await shopeeGraphql("c", "s", payload);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://open-api.affiliate.shopee.com.br/graphql");
    expect(String(init?.body)).toBe(JSON.stringify(payload));
    expect(String(init?.headers?.Authorization)).toMatch(
      /^SHA256 Credential=c, Timestamp=\d{10}, Signature=[0-9a-f]{64}$/,
    );
  });

  it("maps the signature error code to a friendly message", async () => {
    mockFetch({ errors: [{ message: "error [10020]: Invalid Signature" }] });
    await expect(shopeeGraphql("c", "s", { query: "{}" })).rejects.toThrow(
      /App ID e o App Secret/i,
    );
  });

  it("maps HTTP 429 to a rate limit message", async () => {
    mockFetch({}, 429);
    await expect(shopeeGraphql("c", "s", { query: "{}" })).rejects.toThrow(/Limite/);
  });
});

describe("parseShopeeProduct", () => {
  it("normalizes BR fields (priceMin/priceMax/priceDiscountRate)", () => {
    const product = parseShopeeProduct({
      itemId: 987654321,
      productName: "Fone Bluetooth TWS",
      productLink: "https://shopee.com.br/product/933390061/987654321",
      offerLink: "https://s.shopee.com.br/2qRLhfwL03",
      imageUrl: "https://cf.shopee.com.br/file/br-x.jpg",
      priceMin: 49.9,
      priceMax: 53.9,
      priceDiscountRate: 37,
      shopName: "LK_IMPORTS",
    });
    expect(product).toMatchObject({
      itemId: 987654321,
      title: "Fone Bluetooth TWS",
      url: "https://shopee.com.br/product/933390061/987654321",
      image: "https://cf.shopee.com.br/file/br-x.jpg",
      sale_price: 49.9,
      discount_percentage: 37,
      shopName: "LK_IMPORTS",
    });
    expect(product?.original_price).not.toBeNull();
    const original = product?.original_price;
    const sale = product?.sale_price;
    if (original !== null && original !== undefined && sale !== null && sale !== undefined) {
      expect(original).toBeGreaterThan(sale);
    }
  });

  it("accepts decimal discount strings (0.085 = 9%)", () => {
    const product = parseShopeeProduct({
      itemId: 1,
      productName: "Item",
      productLink: "https://shopee.com.br/product/1/1",
      priceMin: 100,
      priceDiscountRate: "0.085",
    });
    expect(product?.discount_percentage).toBe(9);
  });

  it("returns null for invalid nodes", () => {
    expect(parseShopeeProduct(null)).toBeNull();
    expect(parseShopeeProduct({ itemId: 1 })).toBeNull();
  });

  it("ignores empty titles in a list", () => {
    const products = parseShopeeProducts([{ itemId: 1, productName: "  " }, { itemId: 2 }]);
    expect(products).toHaveLength(0);
  });
});

describe("generateShopeeShortLink", () => {
  it("uses the originUrl form on success", async () => {
    mockFetch({ data: { generateShortLink: { shortLink: "https://s.shopee.com.br/abc" } } });
    const link = await generateShopeeShortLink("c", "s", "https://shopee.com.br/x");
    expect(link).toBe("https://s.shopee.com.br/abc");
  });

  it("falls back to the input form on parse errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ errors: [{ message: "error [10010]: invalid arguments" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: { generateShortLink: { shortLink: "https://s.shopee.com.br/def" } },
          }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const link = await generateShopeeShortLink("c", "s", "https://shopee.com.br/x");
    expect(link).toBe("https://s.shopee.com.br/def");
    expect(String((fetchMock.mock.calls[1] ?? [])[1]?.body)).toContain('"input"');
  });

  it("rejects non-parse errors instead of falling back", async () => {
    mockFetch({ errors: [{ message: "error [10035]: no access" }] });
    await expect(generateShopeeShortLink("c", "s", "https://shopee.com.br/x")).rejects.toThrow(
      /não tem acesso/i,
    );
  });
});

function fakeDb(rows: Record<string, unknown[]>) {
  let offerCounter = 0;

  function chain(result: () => { data: unknown; error: unknown }) {
    const node: Record<string, unknown> = {
      then: (onFulfilled: (value: { data: unknown; error: unknown }) => void) =>
        Promise.resolve(result()).then(onFulfilled),
      eq: () => node,
      order: () => node,
      limit: () => node,
      select: () => node,
      single: () => node,
      insert: (value: unknown) => {
        if (
          value &&
          typeof value === "object" &&
          "offer_id" in (value as Record<string, unknown>)
        ) {
          return insertOutcome({ error: null });
        }
        offerCounter += 1;
        return insertOutcome({ data: { id: `offer-${offerCounter}` }, error: null });
      },
    };
    return node;
  }

  function insertOutcome(outcome: { data?: unknown; error: unknown }) {
    return chain(() => ({ data: outcome.data ?? null, error: outcome.error }));
  }

  return {
    from: (table: string) => ({
      select: () => chain(() => ({ data: rows[table] ?? [], error: null })),
      insert: (value: unknown) => {
        if (
          value &&
          typeof value === "object" &&
          "offer_id" in (value as Record<string, unknown>)
        ) {
          return insertOutcome({ error: null });
        }
        offerCounter += 1;
        return insertOutcome({ data: { id: `offer-${offerCounter}` }, error: null });
      },
    }),
  };
}

describe("captureShopeeOffers", () => {
  it("queries the API by keyword and saves offers + media", async () => {
    mockFetch({
      data: {
        productOfferV2: {
          nodes: [
            {
              itemId: 111,
              productName: "Fone Bluetooth",
              productLink: "https://shopee.com.br/product/1/111",
              imageUrl: "https://cf.shopee.com.br/file/a.jpg",
              priceMin: 29.9,
              priceDiscountRate: 25,
            },
            {
              itemId: 222,
              productName: "Carregador USB-C",
              productLink: "https://shopee.com.br/product/2/222",
              imageUrl: "https://cf.shopee.com.br/file/b.jpg",
              priceMin: 19.9,
              priceMax: 24.9,
              priceDiscountRate: 20,
            },
          ],
        },
      },
    });

    const db = fakeDb({
      marketplaces: [{ id: "mp-shopee", slug: "shopee" }],
      affiliate_accounts: [
        { id: "acc", status: "connected", configuration: { app_id: "1001", app_secret: "s3cret" } },
      ],
      offers: [],
    });
    const report = await captureShopeeOffers(db, {
      identifier: "fone",
      sourceId: "src-1",
      userId: "user-1",
    });

    expect(report.offersCaptured).toBe(2);
    expect(report.offersFailed).toBe(0);
    expect(report.errors).toEqual([]);
  });

  it("reports when the account is not connected", async () => {
    const db = fakeDb({
      marketplaces: [{ id: "mp-shopee", slug: "shopee" }],
      affiliate_accounts: [],
      offers: [],
    });
    const report = await captureShopeeOffers(db, {
      identifier: "fone",
      sourceId: "src-1",
      userId: "user-1",
    });
    expect(report.offersCaptured).toBe(0);
    expect(report.errors.join(" ")).toMatch(/não configurada/i);
  });

  it("reports when the identifier is empty", async () => {
    const db = fakeDb({ marketplaces: [], affiliate_accounts: [], offers: [] });
    const report = await captureShopeeOffers(db, {
      identifier: "  ",
      sourceId: "src-1",
      userId: "user-1",
    });
    expect(report.offersCaptured).toBe(0);
    expect(report.errors.join(" ")).toMatch(/palavras-chave/i);
  });
});
