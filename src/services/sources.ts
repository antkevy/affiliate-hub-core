import { createCrud, notImplemented } from "./base";

export const sourcesService = {
  ...createCrud("sources"),

  async activate(id: string) {
    return this.update(id, { status: "active" });
  },

  async pause(id: string) {
    return this.update(id, { status: "paused" });
  },

  /** Conexão real com Telegram / WhatsApp / feeds. */
  testConnection(): never {
    return notImplemented("teste de conexão da fonte");
  },
};

export const processedMessagesService = createCrud("processed_messages");
