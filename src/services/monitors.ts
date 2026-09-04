import { createCrud, notImplemented } from "./base";

export const monitorsService = {
  ...createCrud("monitors"),

  /** Monitoramento real de fontes (Telegram, WhatsApp, feeds, APIs). */
  start(): never {
    return notImplemented("monitoramento de fontes");
  },
  stop(): never {
    return notImplemented("monitoramento de fontes");
  },
};
