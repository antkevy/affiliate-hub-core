import { listMarketplaces, affiliateAccountsService } from "./affiliate";
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
      { key: "client_id", label: "Client ID" },
      { key: "client_secret", label: "Client Secret", secret: true },
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
    description: "Associados Amazon: tag e API de produtos.",
    fields: [
      { key: "partner_tag", label: "Tag de associado" },
      { key: "access_key", label: "Access Key", secret: true },
      { key: "secret_key", label: "Secret Key", secret: true },
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
];

/** Campo que identifica a conta do afiliado em cada marketplace. */
const TAG_KEY_BY_SLUG: Record<string, string> = {
  amazon: "partner_tag",
  shopee: "app_id",
  aliexpress: "app_key",
  "mercado-livre": "client_id",
};

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
