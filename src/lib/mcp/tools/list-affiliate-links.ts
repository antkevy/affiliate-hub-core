import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_affiliate_links",
  title: "Listar links de afiliado",
  description: "Lista os links de afiliado mais recentes do usuário conectado.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Quantidade máxima de links."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit = 20 }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Entre no Affiliate Hub para continuar.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("affiliate_links")
      .select("id,original_url,affiliate_url,status,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new ToolError("Não foi possível carregar os links de afiliado.");
    const items = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(items) }],
      structuredContent: { items },
    };
  },
});
