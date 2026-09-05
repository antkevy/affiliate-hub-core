import { createCrud } from "./base";
import { sendTestToDestination } from "@/lib/capture";

export const destinationsService = {
  ...createCrud("destinations"),

  async activate(id: string) {
    return this.update(id, { status: "active" });
  },

  async pause(id: string) {
    return this.update(id, { status: "paused" });
  },

  /** Envio real de uma mensagem de teste ao destino. */
  async sendTestMessage(destinationId: string): Promise<{ ok: boolean; error?: string }> {
    const destination = await this.getById(destinationId);
    if (!destination) return { ok: false, error: "Destino não encontrado." };
    return sendTestToDestination(destination);
  },
};
