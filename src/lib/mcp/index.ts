import { auth, defineMcp } from "@lovable.dev/mcp-js";
import dashboardSummaryTool from "./tools/dashboard-summary";
import listAffiliateLinksTool from "./tools/list-affiliate-links";
import listAutomationsTool from "./tools/list-automations";
import listOffersTool from "./tools/list-offers";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "affiliate-hub-core",
  title: "Affiliate Hub Core",
  version: "0.1.0",
  instructions:
    "Ferramentas somente de leitura do Affiliate Hub. Use-as para consultar o painel, ofertas, links e automações do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [dashboardSummaryTool, listOffersTool, listAffiliateLinksTool, listAutomationsTool],
});