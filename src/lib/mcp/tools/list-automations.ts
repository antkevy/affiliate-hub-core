import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_automations",
  title: "Listar automações",
  description: "Lista as automações do usuário conectado e seus últimos estados de execução.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Quantidade máxima de automações."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit = 20 }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Entre no Affiliate Hub para continuar.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("automations")
      .select("id,name,description,status,last_run_at,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new ToolError("Não foi possível carregar as automações.");
    const items = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(items) }],
      structuredContent: { items },
    };
  },
});