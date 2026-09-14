import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_offers",
  title: "Listar ofertas",
  description: "Lista as ofertas mais recentes do usuário conectado, com preços e estado.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Quantidade máxima de ofertas."),
    status: z
      .enum(["captured", "processing", "processed", "approved", "rejected", "published", "error"])
      .optional()
      .describe("Filtra pelo estado da oferta."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit = 20, status }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Entre no Affiliate Hub para continuar.");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("offers")
      .select("id,title,sale_price,original_price,currency,discount_percentage,coupon,status,captured_at,affiliate_url")
      .order("captured_at", { ascending: false })
      .limit(limit);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw new ToolError("Não foi possível carregar as ofertas.");
    const items = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(items) }],
      structuredContent: { items },
    };
  },
});