import { createCrud, notImplemented } from "./base";

export const destinationsService = {
  ...createCrud("destinations"),

  async activate(id: string) {
    return this.update(id, { status: "active" });
  },

  async pause(id: string) {
    return this.update(id, { status: "paused" });
  },

  /** Envio de mensagem de teste ao destino. */
  sendTestMessage(): never {
    return notImplemented("envio para destinos");
  },
};
