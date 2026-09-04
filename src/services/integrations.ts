import { notImplemented } from "./base";
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

export const integrationsService = {
  definitions: INTEGRATIONS,
  connect(): never {
    return notImplemented("conexão de integrações");
  },
  disconnect(): never {
    return notImplemented("conexão de integrações");
  },
};
