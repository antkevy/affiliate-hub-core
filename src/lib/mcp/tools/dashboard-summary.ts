import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_dashboard_summary",
  title: "Resumo do painel",
  description: "Resume ofertas, automações, links e publicações do usuário conectado.",
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Entre no Affiliate Hub para continuar.");
    const supabase = supabaseForUser(ctx);
    const [offers, automations, links, publications] = await Promise.all([
      supabase.from("offers").select("id", { count: "exact", head: true }),
      supabase.from("automations").select("id", { count: "exact", head: true }),
      supabase.from("affiliate_links").select("id", { count: "exact", head: true }),
      supabase.from("publications").select("id", { count: "exact", head: true }),
    ]);
    const error = offers.error ?? automations.error ?? links.error ?? publications.error;
    if (error) throw new ToolError("Não foi possível carregar o resumo da conta.");

    const summary = {
      offers: offers.count ?? 0,
      automations: automations.count ?? 0,
      affiliateLinks: links.count ?? 0,
      publications: publications.count ?? 0,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});
