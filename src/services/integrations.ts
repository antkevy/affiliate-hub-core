import { listMarketplaces, affiliateAccountsService } from "./affiliate";
import { supabase } from "@/integrations/supabase/client";
import type { IntegrationDefinition } from "@/types";

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    slug: "telegram",
    name: "Telegram",
    kind: "channel",
    description: "Monitorar canais/grupos e publicar ofertas em canais próprios.",
    fields: [
      { key: "bot_token", label: "Token do bot", secret: true, placeholder: "0000:AA..." },
      { key: "chat_id", label: "ID do canal/grupo", placeholder: "-1001234567890" },
    ],
  },
  {
    slug: "whatsapp",
    name: "WhatsApp",
    kind: "channel",
    description: "Publicar ofertas através de mecanismos oficiais autorizados.",
    fields: [
      { key: "phone_number_id", label: "ID do número", placeholder: "1234567890" },
      { key: "access_token", label: "Token de acesso", secret: true },
    ],
  },
  {
    slug: "mercado-livre",
    name: "Mercado Livre",
    kind: "marketplace",
    description: "Conversão de links e dados de produtos.",
    fields: [
      { key: "client_id", label: "Tag/etiqueta do afiliado", placeholder: "Ex.: fastpromo" },
      {
        key: "cookie",
        label: "Cookie de sessão (createLink)",
        secret: true,
        helper: "Ferramentas do dev → Rede → requisição createLink → cabeçalho Cookie.",
      },
    ],
  },
  {
    slug: "shopee",
    name: "Shopee",
    kind: "marketplace",
    description: "Conversão de links de afiliado.",
    fields: [
      { key: "app_id", label: "App ID" },
      { key: "app_secret", label: "App Secret", secret: true },
    ],
  },
  {
    slug: "amazon",
    name: "Amazon",
    kind: "marketplace",
    description: "Associados Amazon: Creators API para títulos, preços e links.",
    fields: [
      { key: "partner_tag", label: "Tag de associado" },
      { key: "client_id", label: "Client ID (LwA)" },
      { key: "client_secret", label: "Client Secret (LwA)", secret: true },
      {
        key: "marketplace",
        label: "Marketplace (domínio)",
        placeholder: "www.amazon.com.br",
      },
    ],
  },
  {
    slug: "aliexpress",
    name: "AliExpress",
    kind: "marketplace",
    description: "Portals API para links de afiliado.",
    fields: [
      { key: "app_key", label: "App Key" },
      { key: "app_secret", label: "App Secret", secret: true },
    ],
  },
  {
    slug: "magalu",
    name: "Magalu",
    kind: "marketplace",
    description: "Conversão no padrão magazinevoce.com.br.",
    fields: [
      {
        key: "store",
        label: "Loja (magazinevoce)",
        placeholder: "Ex.: suasuperloja",
        helper: "Slug usado no padrão magazinevoce.com.br/{loja}/p/{codigo}/",
      },
    ],
  },
  {
    slug: "kabum",
    name: "KaBuM!",
    kind: "marketplace",
    description: "Conversão de links de afiliado.",
    fields: [{ key: "tracking_id", label: "ID do afiliado", placeholder: "Ex.: seu-id" }],
  },
  {
    slug: "terabyte",
    name: "Terabyte",
    kind: "marketplace",
    description: "Conversão de links de afiliado.",
    fields: [{ key: "tracking_id", label: "ID do afiliado", placeholder: "Ex.: seu-id" }],
  },
];

/** Campo que identifica a conta do afiliado em cada marketplace. */
const TAG_KEY_BY_SLUG: Record<string, string> = {
  amazon: "partner_tag",
  shopee: "app_id",
  aliexpress: "app_key",
  "mercado-livre": "client_id",
  magalu: "store",
  kabum: "tracking_id",
  terabyte: "tracking_id",
};

/** Valida as credenciais da Shopee na Open API antes de salvar a integração. */
async function validateShopeeCredentials(appId?: string, appSecret?: string): Promise<void> {
  if (!appId?.trim() || !appSecret?.trim()) {
    throw new Error("Para conectar a Shopee, informe o App ID e o App Secret.");
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? "";
  const { validateShopeeCredsRpc } = await import("@/lib/shopee-affiliate.server");
  const result = await validateShopeeCredsRpc({ data: { token, appId, appSecret } });
  if (!result.ok) {
    throw new Error(result.error ?? "Falha ao validar as credenciais da Shopee.");
  }
}

export const integrationsService = {
  definitions: INTEGRATIONS,

  /**
   * Conecta um marketplace: cria ou atualiza a conta de afiliado,
   * salvando a configuração (incluindo a tag usada na conversão de links).
   */
  async connectMarketplace(
    slug: string,
    values: Record<string, string>,
  ): Promise<{ accountId: string }> {
    const definition = INTEGRATIONS.find((item) => item.slug === slug);
    if (!definition) throw new Error(`Integração "${slug}" não encontrada.`);

    const marketplaces = await listMarketplaces();
    const marketplace = marketplaces.find((item) => item.slug?.toLowerCase() === slug);
    if (!marketplace) {
      throw new Error(
        `Marketplace "${definition.name}" não cadastrado. Verifique o slug "${slug}" na tabela de marketplaces.`,
      );
    }

    const existing = await affiliateAccountsService.list({
      filters: { marketplace_id: marketplace.id },
    });
    const account =
      existing.find((item) => item.status === "connected" || item.status === "error") ??
      existing[0];

    const configuration: Record<string, string> = {};
    if (account?.configuration && typeof account.configuration === "object") {
      for (const [key, value] of Object.entries(account.configuration)) {
        if (typeof value === "string") configuration[key] = value;
      }
    }
    for (const field of definition.fields) {
      const value = values[field.key]?.trim();
      if (value) configuration[field.key] = value;
    }
    const tagKey = TAG_KEY_BY_SLUG[slug];
    if (tagKey && configuration[tagKey]) configuration["tag"] = configuration[tagKey];

    if (slug === "shopee") {
      await validateShopeeCredentials(configuration["app_id"], configuration["app_secret"]);
    }

    if (account) {
      await affiliateAccountsService.update(account.id, {
        configuration,
        status: "connected",
        name: definition.name,
      });
      return { accountId: account.id };
    }

    const created = await affiliateAccountsService.create({
      name: definition.name,
      marketplace_id: marketplace.id,
      configuration,
      status: "connected",
    });
    return { accountId: created.id };
  },

  /** Desconecta o marketplace mantendo a conta (e a configuração) para reconectar depois. */
  async disconnectMarketplace(slug: string): Promise<void> {
    const marketplaces = await listMarketplaces();
    const marketplace = marketplaces.find((item) => item.slug?.toLowerCase() === slug);
    if (!marketplace) return;
    const existing = await affiliateAccountsService.list({
      filters: { marketplace_id: marketplace.id },
    });
    for (const account of existing) {
      await affiliateAccountsService.update(account.id, { status: "disconnected" });
    }
  },
};
