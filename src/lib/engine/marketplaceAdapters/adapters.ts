// ============================================================
// Offer Engine - Marketplace Adapters
//
// Each adapter is independent and implements the MarketplaceAdapter
// contract. Integration is real only when credentials are present;
// otherwise the adapter reports NOT_CONNECTED and does NOT fabricate
// affiliate links.
// ============================================================

import type { MarketplaceAdapter, MarketplaceDetection, MarketplaceKey } from "@/lib/engine/types";
import { generateShopeeAffiliateLink } from "@/services/shopeeApi";

// Registry of known marketplace slugs to display names.
export const MARKETPLACE_NAMES: Record<string, string> = {
  "mercado-livre": "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
  magalu: "Magalu",
  aliexpress: "AliExpress",
  shein: "Shein",
};

export function marketplaceName(key: string): string {
  return MARKETPLACE_NAMES[key] || key;
}

abstract class BaseAdapter implements MarketplaceAdapter {
  abstract key: MarketplaceKey;
  abstract domainPatterns: RegExp[];

  status(): "NOT_CONNECTED" | "CONNECTED" {
    // No official API integration is wired yet (no credentials flow).
    // Report NOT_CONNECTED so the UI never claims real generation.
    return "NOT_CONNECTED";
  }

  detectUrl(url: string): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return this.domainPatterns.some((p) => p.test(host));
    } catch {
      return false;
    }
  }

  normalizeUrl(url: string): string | null {
    try {
      const u = new URL(url);
      u.hash = "";
      u.search = "";
      return u.toString();
    } catch {
      return null;
    }
  }

  extractProductId(_url: string): string | null {
    // Products ids require marketplace-specific parsing. Adapters that have
    // not implemented it return null rather than guessing.
    return null;
  }

  async getProductMeta(_url: string): Promise<{ title?: string; image?: string } | null> {
    // Fetching remote product metadata is an SSRF-sensitive operation.
    // Not implemented until a secure backend fetch path exists.
    return null;
  }

  async generateAffiliateLink(
    _url: string,
    _opts?: { accountId?: string; subIds?: Record<string, string> },
  ): Promise<string | null> {
    // No real credential-backed generation available -> return null.
    // The AffiliateLinkService will surface "integration unavailable".
    return null;
  }
}

export class MercadoLivreAdapter extends BaseAdapter {
  key: MarketplaceKey = "mercado-livre";
  domainPatterns = [
    /(^|\.)mercadolivre\.com\.br$/,
    /(^|\.)mercadolibre\.com(\.|$)/,
    /(^|\.)meli\.la$/,
  ];

  override extractProductId(url: string): string | null {
    // MLN IDs look like ML... (alphanumeric) or MLA/MLB-xxxx.
    const m = url.match(/ML[AB]?-?[A-Z0-9-]{8,}/i);
    const id = m ? m[0] : undefined;
    return id ? id.toUpperCase() : null;
  }
}

export class ShopeeAdapter extends BaseAdapter {
  key: MarketplaceKey = "shopee";
  domainPatterns = [/(^|\.)shopee\.com\.br$/, /(^|\.)shopee\.com$/];

  private getCredentials(): { appKey: string; appSecret: string } | null {
    try {
      const saved = localStorage.getItem("affiliate_tags");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.shopeeAppKey && parsed.shopeeAppSecret) {
          return { appKey: parsed.shopeeAppKey, appSecret: parsed.shopeeAppSecret };
        }
      }
    } catch (e) {
      console.error("Erro ao ler credenciais Shopee do localStorage", e);
    }
    return null;
  }

  override status(): "NOT_CONNECTED" | "CONNECTED" {
    const creds = this.getCredentials();
    return creds ? "CONNECTED" : "NOT_CONNECTED";
  }

  override extractProductId(url: string): string | null {
    // Shopee product urls: /product/.../...  or /<shop>-i.<id>/...
    const m = url.match(/(?:-i\.)(\d{5,})/i) || url.match(/(?:-i\.)(\d{5,})/i);
    const seg = url.match(/-i\.(\d{5,})/i);
    const id = seg ? seg[1] : m ? m[1] : undefined;
    return id ?? null;
  }

  override async generateAffiliateLink(
    url: string,
    opts?: { accountId?: string; subIds?: Record<string, string> },
  ): Promise<string | null> {
    const creds = this.getCredentials();
    if (!creds) return null;

    const result = await generateShopeeAffiliateLink(
      url,
      creds,
      opts?.subIds ? { subIds: opts.subIds } : undefined,
    );
    return result.ok && result.shortLink ? result.shortLink : null;
  }
}

export class AmazonAdapter extends BaseAdapter {
  key: MarketplaceKey = "amazon";
  domainPatterns = [/(^|\.)amazon\.com\.br$/, /(^|\.)amazon\.com$/, /(^|\.)amzn$/];

  override extractProductId(url: string): string | null {
    // Amazon ASINs are 10-character alphanumeric strings.
    const m = url.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i);
    const id = m ? m[1] : undefined;
    return id ?? null;
  }
}

export class MagaluAdapter extends BaseAdapter {
  key: MarketplaceKey = "magalu";
  domainPatterns = [/(^|\.)magazineluiza\.com\.br$/, /(^|\.)magalu\.com$/];
}

export class AliExpressAdapter extends BaseAdapter {
  key: MarketplaceKey = "aliexpress";
  domainPatterns = [/(^|\.)aliexpress\.com$/, /(^|\.)aliexpress\.com\.br$/];
}

export class SheinAdapter extends BaseAdapter {
  key: MarketplaceKey = "shein";
  domainPatterns = [/(^|\.)shein\.com$/, /(^|\.)shein\.com\.br$/];
}

export class UnknownAdapter extends BaseAdapter {
  key: MarketplaceKey = "unknown";
  domainPatterns = [/.*/];
}

export const DEFAULT_ADAPTERS: MarketplaceAdapter[] = [
  new MercadoLivreAdapter(),
  new ShopeeAdapter(),
  new AmazonAdapter(),
  new MagaluAdapter(),
  new AliExpressAdapter(),
  new SheinAdapter(),
];
