import { describe, expect, it } from "vitest";
import { buildTelegramPost } from "@/lib/telegram-webhook.server";

describe("buildTelegramPost", () => {
  it("extrai post de texto (message)", () => {
    const post = buildTelegramPost({
      message: {
        message_id: 12,
        date: 1700000000,
        chat: { id: -100 },
        text: "Produto novo por R$ 50",
      },
    });
    expect(post?.externalId).toBe("12");
    expect(post?.text).toContain("R$ 50");
    expect(post?.time).toBe(new Date(1700000000 * 1000).toISOString());
    expect(post?.photoFileId).toBeNull();
  });

  it("usa caption e o maior file_id quando há foto (channel_post)", () => {
    const post = buildTelegramPost({
      channel_post: {
        message_id: 3,
        date: 1700000001,
        chat: { id: -100 },
        caption: "Oferta da semana",
        photo: [
          { file_id: "PEGA", width: 100 },
          { file_id: "PEGB", width: 500 },
        ],
      },
    });
    expect(post?.text).toBe("Oferta da semana");
    expect(post?.photoFileId).toBe("PEGB");
  });

  it("retorna null para updates sem mensagem", () => {
    expect(buildTelegramPost({ update_id: 1 })).toBeNull();
  });

  it("retorna null quando a mensagem não tem chat", () => {
    expect(buildTelegramPost({ message: { message_id: 1, text: "x" } })).toBeNull();
  });
});
