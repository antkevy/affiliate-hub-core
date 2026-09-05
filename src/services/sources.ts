import { createCrud, notImplemented } from "./base";
import { fetchText } from "@/lib/capture";

export const sourcesService = {
  ...createCrud("sources"),

  async activate(id: string) {
    return this.update(id, { status: "active" });
  },

  async pause(id: string) {
    return this.update(id, { status: "paused" });
  },

  /** Testa a conexão real com a fonte (feed/API via HTTP). */
  async testConnection(sourceId: string): Promise<string> {
    const source = await this.getById(sourceId);
    if (!source) throw new Error("Fonte não encontrada.");
    if (source.type !== "feed" && source.type !== "api") {
      return notImplemented(`leitura via ${source.type}`);
    }
    if (!source.identifier) throw new Error("Fonte sem URL configurada.");
    const text = await fetchText(source.identifier);
    if (text === null) {
      throw new Error("Sem resposta — verifique a URL ou bloqueio de CORS no navegador.");
    }
    return `Conectada (${text.length} bytes recebidos).`;
  },
};
