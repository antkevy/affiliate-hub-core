import { createCrud, notImplemented } from "./base";

export const bannersService = {
  ...createCrud("banners"),

  /** Renderização final da imagem do banner. */
  generateImage(): never {
    return notImplemented("geração automática de banners");
  },
};
