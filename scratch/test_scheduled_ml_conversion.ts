import fs from "fs";
import path from "path";
import { createClient } from "file:///c:/Users/Usuario/Downloads/afiliado2/affiliate-hub-core/node_modules/@supabase/supabase-js/dist/main/index.js";

const envLocalPath = "c:/Users/Usuario/Downloads/afiliado2/affiliate-hub-core/.env.local";
const envLocal = fs.readFileSync(envLocalPath, "utf-8");

let serviceRoleKey = "";
for (const line of envLocal.split("\n")) {
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
    serviceRoleKey = line.split("=")[1].trim().replace(/^["']|["']$/g, "");
  }
}

const SUPABASE_URL = "https://ojyhxpyiborimrpytntt.supabase.co";
const db = createClient(SUPABASE_URL, serviceRoleKey);

async function run() {
  console.log("=== CHECKING MARKETPLACES & ACCOUNTS ===");
  const { data: marketplaces } = await db.from("marketplaces").select("id, name, slug");
  const mercadolivreMarketplaceId = marketplaces?.find(
    (m: any) => (m.slug ?? "").toLowerCase() === "mercado-livre"
  )?.id ?? null;
  console.log("mercadolivreMarketplaceId:", mercadolivreMarketplaceId);

  const { data: accounts } = await db
    .from("affiliate_accounts")
    .select("id, user_id, marketplace_id, status, configuration");

  console.log("Accounts found:", accounts);

  const { data: offers } = await db
    .from("offers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("\n=== LATEST 10 OFFERS IN DB ===");
  for (const o of offers ?? []) {
    console.log({
      id: o.id,
      title: o.title,
      original_url: o.original_url,
      affiliate_url: o.affiliate_url,
      marketplace_id: o.marketplace_id,
      user_id: o.user_id,
      status: o.status
    });
  }
}

run().catch(console.error);
