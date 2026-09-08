import fs from "fs";
import { pathToFileURL } from "url";
import { followMercadoLivreRedirects, cleanMercadoLivreUrl, extractMercadoLivreId } from "../src/lib/mercado-livre-resolver.server";
import { createClient } from "c:/Users/Usuario/Downloads/afiliado2/affiliate-hub-core/node_modules/@supabase/supabase-js";

const envLocalPath = "c:/Users/Usuario/Downloads/afiliado2/affiliate-hub-core/.env.local";
const envLocal = fs.readFileSync(envLocalPath, "utf-8");

let serviceRoleKey = "";
for (const line of envLocal.split("\n")) {
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
    serviceRoleKey = line.split("=")[1].trim().replace(/^["']|["']$/g, "");
  }
}

const db = createClient("https://ojyhxpyiborimrpytntt.supabase.co", serviceRoleKey);

function findProductsImproved(html: string): Array<{ mbid: string; url: string }> {
  const found = new Map<string, string>();
  const seen = new Set<string>();

  // Matches com domínios completos ou relativos ou com slugs
  const pattern = /(?:https?:)?(?:\/\/(?:www\.|produto\.|articulo\.|item\.|m\.)?mercadolivre(?:\.com\.br|\.com|\.com\.mx))?(\/(?:p\/|[\w-]+\/)?MLB[-]?\d{6,12}[-a-z0-9]*)/gi;
  for (const match of html.matchAll(pattern)) {
    const candidate = match[0];
    const raw = candidate.startsWith("/") ? `https://www.mercadolivre.com.br${candidate}` : candidate;
    const clean = cleanMercadoLivreUrl(raw);
    if (!clean) continue;
    const mbid = extractMercadoLivreId(clean);
    if (!mbid) continue;
    if (!seen.has(clean)) seen.add(clean);
    if (!found.has(mbid)) found.set(mbid, clean);
  }

  // Fallback: procurar qualquer ID MLB no HTML se nada for achado com slug
  if (found.size === 0) {
    const mlbMatches = html.matchAll(/\b(MLB[-]?\d{6,12})\b/gi);
    for (const match of mlbMatches) {
      const rawId = match[1];
      const mbid = extractMercadoLivreId(rawId);
      if (mbid && !found.has(mbid)) {
        const clean = `https://produto.mercadolivre.com.br/${mbid}`;
        found.set(mbid, clean);
      }
    }
  }

  return [...found.entries()].map(([mbid, url]) => ({ mbid, url }));
}

async function main() {
  const { data: session } = await db.from("meli_sessions").select("*").single();
  const targetPath = pathToFileURL("c:/Users/Usuario/Downloads/afiliado2/affiliate-hub-core/src/lib/mercado-livre-affiliate.server.ts").href;
  const { generateMercadoLivreAffiliateUrlSmart } = await import(targetPath);

  const url = "http://meli.la/1ibPtw9";
  const title = "➡️ Forno Elétrico 52l Family Grill Inox Mondial 1800w Frn-52-bi 127v";

  const redirect = await followMercadoLivreRedirects(url);
  console.log("Redirect Final URL:", redirect.finalUrl);

  const htmlRes = await fetch(redirect.finalUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
  });

  const html = await htmlRes.text();
  const products = findProductsImproved(html);
  console.log(`Found ${products.length} products on page.`);
  for (const p of products) {
    console.log(` - ${p.mbid}: ${p.url}`);
  }
}

main().catch(console.error);
