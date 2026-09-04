import { createCrud, notImplemented } from "./base";

export const destinationsService = {
  ...createCrud("destinations"),

  /** Envio de mensagem de teste ao destino. */
  sendTestMessage(): never {
    return notImplemented("envio para destinos");
  },
};
