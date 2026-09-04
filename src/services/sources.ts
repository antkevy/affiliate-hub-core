import { createCrud, notImplemented } from "./base";

export const sourcesService = {
  ...createCrud("sources"),

  /** Conexão real com Telegram / WhatsApp / feeds. */
  testConnection(): never {
    return notImplemented("teste de conexão da fonte");
  },
};

export const processedMessagesService = createCrud("processed_messages");
