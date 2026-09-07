import { configurationOf } from "@/lib/monitor-config";
import { automationConfigOf } from "@/lib/automation-config";
import { destinationConfiguration } from "@/lib/destination-config";
import { normalizeText } from "@/lib/affiliate-converter";
import { captureTelegramChannel } from "@/lib/telegram.server";
import {
  downloadImageBase64,
  postTelegram,
  type TelegramProxyPayload,
} from "@/lib/telegram-proxy.server";
import { rewriteOfferWithAI } from "@/lib/ai.server";
import {
  ALIEXPRESS_DEFAULT_TRACKING_ID,
  generateAliExpressAffiliateLink,
} from "@/lib/aliexpress-affiliate.server";
import type { Destination, Monitor, Offer, Source } from "@/types";

// Cliente Supabase sem tipagem estática — mesmas colunas validadas no schema
// gerado em src/integrations/supabase/types.ts. Padrão de telegram.server.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export interface ScheduledRunReport {
  offersCaptured: number;
  offersIgnored: number;
  offersPublished: number;
  offersFailed: number;
  errors: string[];
}

const PROCESSABLE_OFFER_STATUS = ["captured", "processing", "processed", "approved", "error"];

interface AliExpressAccount {
  marketplace_id: string | null;
  app_key: string;
  app_secret: string;
  tracking_id: string | null;
}

/**
 * Reúne as contas de afiliado AliExpress conectadas (config com app_key/app_secret),
 * indexadas por usuário. Fallback de tracking_id = "default" (aceito pela API).
 */
function buildAliExpressAccounts(rows: unknown[]): Map<string, AliExpressAccount> {
  const accounts = new Map<string, AliExpressAccount>();
  for (const row of rows) {
    const record = row as {
      user_id?: string;
      marketplace_id?: string | null;
      status?: string;
      configuration?: unknown;
    } | null;
    if (!record?.user_id || record.status !== "connected") continue;
    const configuration = record.configuration;
    if (!configuration || typeof configuration !== "object") continue;
    const config = configuration as Record<string, unknown>;
    const app_key =
      typeof config["app_key"] === "string" && config["app_key"].trim()
        ? config["app_key"].trim()
        : null;
    const app_secret =
      typeof config["app_secret"] === "string" && config["app_secret"].trim()
        ? config["app_secret"].trim()
        : null;
    if (!app_key || !app_secret) continue;
    let tracking_id: string | null = null;
    for (const key of ["tracking_id", "trackingId", "affiliate_id", "affiliateId"]) {
      const value = config[key];
      if (typeof value === "string" && value.trim()) {
        tracking_id = value.trim();
        break;
      }
    }
    accounts.set(record.user_id, {
      marketplace_id: record.marketplace_id ?? null,
      app_key,
      app_secret,
      tracking_id,
    });
  }
  return accounts;
}

/**
 * Converte a URL de uma oferta AliExpress para link de afiliado do usuário e
 * persiste em offers.affiliate_url. Falhas não bloqueiam: mantém o link original.
 */
async function ensureAliExpressAffiliateUrl(
  db: Db,
  offer: Offer,
  aliExpressAccountsByUser: Map<string, AliExpressAccount>,
): Promise<void> {
  if (!offer.original_url || offer.affiliate_url) return;
  const account = aliExpressAccountsByUser.get(offer.user_id ?? "");
  if (!account || offer.marketplace_id !== account.marketplace_id) return;

  let link: string;
  try {
    link = await generateAliExpressAffiliateLink(offer.original_url, {
      app_key: account.app_key,
      app_secret: account.app_secret,
      tracking_id: account.tracking_id ?? ALIEXPRESS_DEFAULT_TRACKING_ID,
    });
  } catch {
    return;
  }
  offer.affiliate_url = link;
  await db.from("offers").update({ affiliate_url: link }).eq("id", offer.id);
}

/**
 * Pipeline completo de captura → filtro → IA → publicação, executado no
 * SERVIDOR (sem navegador aberto) com o cliente de service role.
 *
 * É disparado pelo job agendado (Cloud de Lovable / cron externo) via
 * /api/scheduled/run, autenticado com LOVABLE_CRON_SECRET ou PUBLISH_CRON_SECRET.
 *
 * Diferenças vs. execução pelo navegador:
 * - Banner (html para imagem) não é gerado aqui (exige DOM); no lugar, anexa
 *   a imagem do produto do marketplace quando o monitor/automação usa banner.
 * - Tudo roda com privileges admin: o atributo user_id vem das linhas (fonte
 *   / oferta), respeitando o dono dos registros.
 */
export async function runScheduledPublishing(): Promise<ScheduledRunReport> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db: Db = supabaseAdmin;
  const report: ScheduledRunReport = {
    offersCaptured: 0,
    offersIgnored: 0,
    offersPublished: 0,
    offersFailed: 0,
    errors: [],
  };

  const [
    sourcesRes,
    monitorsRes,
    automationsRes,
    destinationsRes,
    templatesRes,
    marketplacesRes,
    accountsRes,
  ] = await Promise.all([
    db.from("sources").select("*"),
    db.from("monitors").select("*"),
    db.from("automations").select("*"),
    db.from("destinations").select("*"),
    db.from("templates").select("*"),
    db.from("marketplaces").select("id, name"),
    db.from("affiliate_accounts").select("user_id, marketplace_id, status, configuration"),
  ]);

  for (const result of [
    sourcesRes,
    monitorsRes,
    automationsRes,
    destinationsRes,
    templatesRes,
    marketplacesRes,
    accountsRes,
  ]) {
    if (result.error) report.errors.push(`Banco de dados: ${result.error.message}`);
  }
  if (report.errors.length > 0) return report;

  const sources: Source[] = sourcesRes.data ?? [];
  const monitors: Monitor[] = monitorsRes.data ?? [];
  const automations = automationsRes.data ?? [];
  const destinations: Destination[] = destinationsRes.data ?? [];
  const templates = templatesRes.data ?? [];
  const marketplaceName = new Map<string, string>(
    (marketplacesRes.data ?? []).map((item: { id: string; name: string }) => [item.id, item.name]),
  );

  const activeSourcesById = new Map<string, Source>(
    sources.filter((source) => source.status === "active").map((source) => [source.id, source]),
  );
  const monitorList = monitors.filter((monitor) => monitor.status === "active");
  const automationList = automations.filter(
    (automation: { status: string; source_id: string | null }) =>
      automation.status === "active" && Boolean(automation.source_id),
  );
  const destinationsById = new Map<string, Destination>(destinations.map((d) => [d.id, d]));
  const templatesById = new Map<string, { id: string; content: string }>(
    (templatesRes.data ?? []).map((item: { id: string; content: string }) => [item.id, item]),
  );

  if (monitorList.length === 0 && automationList.length === 0) {
    report.errors.push("Nenhum monitor ou automação ativa para publicar ofertas.");
  }

  const sourceIdsToCapture = new Set<string>();
  for (const monitor of monitorList) {
    for (const sourceId of configurationOf(monitor).source_ids ?? []) {
      sourceIdsToCapture.add(sourceId);
    }
  }
  for (const automation of automationList) sourceIdsToCapture.add(automation.source_id);

  const knownKeys = new Set<string>();
  const existingRes = await db.from("offers").select("id, source_id, title, original_url");
  if (existingRes.error) {
    report.errors.push(`Banco de dados: ${existingRes.error.message}`);
    return report;
  }
  for (const row of existingRes.data ?? []) {
    if (row.original_url) knownKeys.add(`${row.source_id ?? ""}::${row.original_url}`);
    knownKeys.add(`${row.source_id ?? ""}::${String(row.title ?? "").toLowerCase()}`);
  }

  for (const sourceId of sourceIdsToCapture) {
    const source = activeSourcesById.get(sourceId);
    if (!source) {
      report.errors.push("Uma fonte vinculada está pausada ou foi removida.");
      continue;
    }
    if (!source.identifier) {
      report.errors.push(`Fonte "${source.name}": sem identificador (URL) para capturar.`);
      continue;
    }
    if (!isScrapable(source.type)) {
      report.errors.push(`Fonte "${source.name}": captura via ${source.type} requer integração.`);
      continue;
    }

    if (source.type === "telegram") {
      const captured = await captureTelegramChannel(db, {
        identifier: source.identifier,
        sourceId: source.id,
        userId: source.user_id,
      });
      report.offersCaptured += captured.offersCaptured;
      report.offersIgnored += captured.offersIgnored;
      report.offersFailed += captured.offersFailed;
      report.errors.push(...captured.errors);
      continue;
    }

    const candidates = await captureFeedOrApi(source);
    for (const candidate of candidates) {
      const key = candidate.original_url
        ? `${candidate.source_id ?? ""}::${candidate.original_url}`
        : `${candidate.source_id ?? ""}::${candidate.title.toLowerCase()}`;
      if (knownKeys.has(key)) {
        report.offersIgnored++;
        continue;
      }
      knownKeys.add(key);
      const { error } = await db.from("offers").insert({
        user_id: source.user_id,
        source_id: source.id,
        title: candidate.title,
        original_url: candidate.original_url,
        sale_price: candidate.sale_price,
        original_price: candidate.original_price,
        discount_percentage: candidate.discount_percentage,
        coupon: candidate.coupon,
        currency: candidate.currency ?? "BRL",
        marketplace_id: candidate.marketplace_id,
        status: "captured",
        captured_at: new Date().toISOString(),
      });
      if (error) {
        report.errors.push(`Falha ao salvar "${candidate.title}": ${error.message}`);
      } else {
        report.offersCaptured++;
      }
    }
  }

  const freshRes = await db.from("offers").select("*");
  if (freshRes.error) {
    report.errors.push(`Banco de dados: ${freshRes.error.message}`);
    return report;
  }
  const offersBySource = new Map<string, Offer[]>();
  for (const offer of (freshRes.data ?? []) as Offer[]) {
    const bucket = offersBySource.get(offer.source_id ?? "") ?? [];
    bucket.push(offer);
    offersBySource.set(offer.source_id ?? "", bucket);
  }

  const publishedRes = await db
    .from("publications")
    .select("offer_id, destination_id")
    .eq("status", "published");
  const publishedKeys = new Set<string>();
  for (const row of publishedRes.data ?? []) {
    if (row.offer_id && row.destination_id) {
      publishedKeys.add(`${row.offer_id}::${row.destination_id}`);
    }
  }

  const aliExpressAccountsByUser = buildAliExpressAccounts(accountsRes.data ?? []);
  for (const offerList of offersBySource.values()) {
    for (const offer of offerList) {
      if (PROCESSABLE_OFFER_STATUS.includes(offer.status)) {
        await ensureAliExpressAffiliateUrl(db, offer, aliExpressAccountsByUser);
      }
    }
  }

  for (const monitor of monitorList) {
    const config = configurationOf(monitor);
    const touched = await publishForMonitor(
      db,
      monitor,
      config,
      offersBySource,
      destinationsById,
      templatesById,
      marketplaceName,
      publishedKeys,
      report,
    );
    if (touched) {
      await db
        .from("monitors")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", monitor.id);
    }
  }

  for (const automation of automationList) {
    const config = automationConfigOf(automation);
    const destination = automation.destination_id
      ? destinationsById.get(automation.destination_id)
      : null;
    if (!destination) {
      report.errors.push(`Automação "${automation.name}": sem destino configurado.`);
      continue;
    }
    if (!automation.source_id) continue;
    const source = activeSourcesById.get(automation.source_id);
    if (!source) {
      report.errors.push(`Automação "${automation.name}": fonte pausada ou ausente.`);
      continue;
    }
    const template = automation.template_id ? templatesById.get(automation.template_id) : null;

    let published = 0;
    let failed = 0;
    for (const offer of offersBySource.get(automation.source_id) ?? []) {
      if (!PROCESSABLE_OFFER_STATUS.includes(offer.status)) continue;
      if (publishedKeys.has(`${offer.id}::${destination.id}`)) continue;

      const content = resolveContent(offer, template?.content, marketplaceName);
      const finalContent =
        config.ai_enabled && content
          ? await applyAiOrDefault(offer, content, config.ai_instruction, marketplaceName)
          : content;
      const attempt = await publishToDestinationServer(
        db,
        destination,
        offer,
        config,
        finalContent,
      );
      await recordPublication(db, offer, destination, finalContent, attempt, report, publishedKeys);
      if (attempt.ok) published++;
      else failed++;
    }
    if (published + failed > 0) {
      await db
        .from("automations")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", automation.id);
    }
  }

  return report;
}

async function publishForMonitor(
  db: Db,
  monitor: Monitor,
  config: ReturnType<typeof configurationOf>,
  offersBySource: Map<string, Offer[]>,
  destinationsById: Map<string, Destination>,
  templatesById: Map<string, { id: string; content: string }>,
  marketplaceName: Map<string, string>,
  publishedKeys: Set<string>,
  report: ScheduledRunReport,
): Promise<boolean> {
  const sourceIds = config.source_ids ?? [];
  if (sourceIds.length === 0) {
    report.errors.push(`${monitor.name}: sem fontes vinculadas.`);
    return true;
  }

  const destination = config.destination_id ? destinationsById.get(config.destination_id) : null;
  if (!destination) {
    report.errors.push(`${monitor.name}: sem destino configurado para publicar.`);
    return true;
  }
  const template = config.template_id ? templatesById.get(config.template_id) : null;

  const candidates: Offer[] = [];
  for (const sourceId of sourceIds) {
    for (const offer of offersBySource.get(sourceId) ?? []) {
      if (PROCESSABLE_OFFER_STATUS.includes(offer.status) && passesFilters(offer, config)) {
        candidates.push(offer);
      }
    }
  }
  if (candidates.length === 0) return true;

  let published = 0;
  let failed = 0;
  for (const offer of candidates) {
    if (publishedKeys.has(`${offer.id}::${destination.id}`)) continue;

    const content = resolveContent(offer, template?.content, marketplaceName);
    const finalContent =
      config.ai_enabled && content
        ? await applyAiOrDefault(offer, content, config.ai_instruction, marketplaceName)
        : content;
    const attempt = await publishToDestinationServer(db, destination, offer, config, finalContent);
    await recordPublication(db, offer, destination, finalContent, attempt, report, publishedKeys);
    if (attempt.ok) {
      published++;
      if ((config.spacing_minutes ?? 0) > 0) break;
    } else {
      failed++;
    }
  }
  return published + failed > 0;
}

async function recordPublication(
  db: Db,
  offer: Offer,
  destination: Destination,
  content: string,
  attempt: { ok: boolean; error?: string },
  report: ScheduledRunReport,
  publishedKeys: Set<string>,
): Promise<void> {
  const now = new Date().toISOString();
  if (attempt.ok) publishedKeys.add(`${offer.id}::${destination.id}`);
  const { error } = await db.from("publications").insert({
    user_id: offer.user_id,
    offer_id: offer.id,
    destination_id: destination.id,
    content,
    status: attempt.ok ? "published" : "failed",
    published_at: attempt.ok ? now : null,
    error_message: attempt.ok ? null : (attempt.error ?? "Falha ao publicar"),
  });
  await db
    .from("offers")
    .update({
      status: attempt.ok ? "published" : "error",
      processed_at: now,
    })
    .eq("id", offer.id);

  if (attempt.ok) {
    report.offersPublished++;
  } else {
    report.offersFailed++;
    report.errors.push(
      `${offer.title}: ${attempt.error ?? "Falha ao publicar"}${error ? ` (banco: ${error.message})` : ""}`,
    );
  }
}

async function publishToDestinationServer(
  db: Db,
  destination: Destination,
  offer: Offer,
  config: { include_banner?: boolean },
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  const dc = destinationConfiguration(destination);
  if (destination.type === "telegram") {
    if (!dc.token || !dc.chat_id) {
      return { ok: false, error: "Destino sem token ou canal configurado." };
    }
    const imageUrl = await firstOfferImage(db, offer.id);
    const imageBase64 = imageUrl ? await downloadImageBase64(imageUrl) : null;
    if (imageBase64) {
      return postTelegram({
        token: dc.token,
        method: "sendPhoto",
        chat_id: dc.chat_id,
        text: content,
        files: [{ name: "product.png", base64: imageBase64 }],
      });
    }
    return postTelegram({
      token: dc.token,
      method: "sendMessage",
      chat_id: dc.chat_id,
      text: content,
    });
  }
  if (destination.type === "other") {
    if (!dc.url) return { ok: false, error: "Destino sem URL de webhook." };
    return sendWebhookServer(dc.url, offer);
  }
  return { ok: false, error: `Publicação via ${destination.type} ainda requer integração.` };
}

/** Primeira imagem do produto cadastrada (offer_media) para posts agendados. */
async function firstOfferImage(db: Db, offerId: string): Promise<string | null> {
  const { data, error } = await db
    .from("offer_media")
    .select("url")
    .eq("offer_id", offerId)
    .order("position", { ascending: true })
    .limit(1);
  if (error) return null;
  return data?.[0]?.url ?? null;
}

async function sendWebhookServer(
  url: string,
  offer: Offer,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: offer.title,
        sale_price: offer.sale_price,
        original_price: offer.original_price,
        discount_percentage: offer.discount_percentage,
        coupon: offer.coupon,
        link: offer.affiliate_url ?? offer.original_url,
        captured_at: offer.captured_at,
      }),
    });
    if (!response.ok) return { ok: false, error: `Webhook HTTP ${response.status}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha no webhook." };
  }
}

function resolveContent(
  offer: Offer,
  templateContent: string | undefined | null,
  marketplaceName: Map<string, string>,
): string {
  if (templateContent) return renderTemplateServer(templateContent, offer, marketplaceName);
  return defaultContentServer(offer, marketplaceName);
}

async function applyAiOrDefault(
  offer: Offer,
  content: string,
  instruction: string | null | undefined,
  marketplaceName: Map<string, string>,
): Promise<string> {
  const aiOffer = {
    title: offer.title,
    sale_price: offer.sale_price,
    original_price: offer.original_price,
    discount_percentage: offer.discount_percentage,
    coupon: offer.coupon,
    url: offer.affiliate_url ?? offer.original_url,
  };
  const marketplace = offer.marketplace_id ? (marketplaceName.get(offer.marketplace_id) ?? "") : "";
  const result = await rewriteOfferWithAI({
    offer: marketplace ? { ...aiOffer, marketplace } : aiOffer,
    content,
    instruction: instruction ?? null,
  });
  return result.ok && result.text ? result.text : content;
}

function renderTemplateServer(
  content: string,
  offer: Offer,
  marketplaceName: Map<string, string>,
): string {
  const values: Record<string, string> = {
    titulo: offer.title,
    preco: money(offer.sale_price),
    preco_antigo: money(offer.original_price),
    desconto:
      offer.discount_percentage !== null && offer.discount_percentage !== undefined
        ? `${offer.discount_percentage}%`
        : "—",
    cupom: offer.coupon ?? "—",
    link: offer.affiliate_url ?? offer.original_url ?? "—",
    marketplace: offer.marketplace_id ? (marketplaceName.get(offer.marketplace_id) ?? "—") : "—",
    categoria: "—",
  };
  return content.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function defaultContentServer(offer: Offer, marketplaceName: Map<string, string>): string {
  const parts: string[] = [];

  if (offer.title) {
    parts.push(`➡️ ${offer.title}`);
  }

  const priceLines: string[] = [];
  if (offer.sale_price !== null) {
    priceLines.push(`🔥 ${money(offer.sale_price)}`);
  }
  if (offer.discount_percentage !== null && offer.discount_percentage !== undefined) {
    priceLines.push(`⚡ ${offer.discount_percentage}% OFF`);
  }
  if (offer.coupon) {
    priceLines.push(`🏷️ Cupom: ${offer.coupon}`);
  }

  if (priceLines.length > 0) {
    parts.push(priceLines.join("\n"));
  }

  const link = offer.affiliate_url ?? offer.original_url;
  if (link) {
    parts.push(`🛒 ${link}`);
  }

  return parts.join("\n\n");
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function passesFilters(offer: Offer, config: ReturnType<typeof configurationOf>): boolean {
  if (config.marketplace_ids && config.marketplace_ids.length > 0) {
    if (!offer.marketplace_id || !config.marketplace_ids.includes(offer.marketplace_id)) {
      return false;
    }
  }
  if (config.min_discount !== null && config.min_discount !== undefined) {
    if ((offer.discount_percentage ?? 0) < config.min_discount) return false;
  }
  if (config.max_price !== null && config.max_price !== undefined) {
    if ((offer.sale_price ?? Number.POSITIVE_INFINITY) > config.max_price) return false;
  }
  if (config.blocked_keywords && config.blocked_keywords.length > 0) {
    const normalized = normalizeText(offer.title);
    if (config.blocked_keywords.some((keyword) => normalized.includes(normalizeText(keyword)))) {
      return false;
    }
  }
  if (config.keywords && config.keywords.length > 0) {
    const normalized = normalizeText(offer.title);
    if (!config.keywords.some((keyword) => normalized.includes(normalizeText(keyword)))) {
      return false;
    }
  }
  return true;
}

function isScrapable(type: string): boolean {
  return type === "feed" || type === "api" || type === "telegram";
}

interface ServerCandidate {
  title: string;
  original_url: string | null;
  sale_price: number | null;
  original_price: number | null;
  discount_percentage: number | null;
  currency: string | null;
  coupon: string | null;
  marketplace_id: null;
  source_id: string;
}

async function captureFeedOrApi(source: Source): Promise<ServerCandidate[]> {
  if (!source.identifier) return [];
  const text = await fetchTextServer(source.identifier);
  if (!text) return [];
  if (source.type === "feed") return parseFeedXmlServer(text, source.id);
  try {
    return parseJsonEntriesServer(JSON.parse(text), source.id);
  } catch {
    return [];
  }
}

async function fetchTextServer(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/** Parser RSS/Atom seguro para servidor (sem DOMParser — não existe em Workers). */
export function parseFeedXmlServer(xml: string, sourceId: string): ServerCandidate[] {
  const candidates: ServerCandidate[] = [];
  const blocks = xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  for (const block of blocks) {
    const title = firstNonEmpty(tagText(block, "title"));
    if (!title) continue;
    const url = tagHref(block, "link") || tagText(block, "link");
    const saleRaw = textOfAny(block, "salePrice", "sale_price", "sale price", "price");
    const originalRaw = textOfAny(block, "originalPrice", "original_price");
    const salePrice = toNumber(saleRaw);
    const originalPrice = toNumber(originalRaw);
    candidates.push({
      title: title.slice(0, 200),
      original_url: url || null,
      sale_price: salePrice,
      original_price: originalPrice,
      discount_percentage: computeDiscount(salePrice, originalPrice),
      currency: "BRL",
      coupon: firstNonEmpty(textOfAny(block, "coupon")) || null,
      marketplace_id: null,
      source_id: sourceId,
    });
  }
  return candidates;
}

function textOfAny(block: string, ...tags: string[]): string {
  for (const tag of tags) {
    const value = tagText(block, tag);
    if (value) return value;
  }
  return "";
}

function tagText(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match?.[1]) return "";
  return match[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagHref(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*href=["']([^"']+)["']`, "i"));
  return match?.[1]?.trim() ?? "";
}

export function parseJsonEntriesServer(payload: unknown, sourceId: string): ServerCandidate[] {
  const entries = extractEntries(payload);
  return entries
    .map((entry) => {
      const title = firstNonEmpty(pick(entry, "title", "name", "product.title"), "Oferta");
      const rawUrl = pick(entry, "url", "link", "permalink", "product.url");
      const url = typeof rawUrl === "string" && rawUrl.trim() ? rawUrl.trim() : null;
      const salePrice = toNumber(pick(entry, "sale_price", "price", "product.price"));
      const originalPrice = toNumber(
        pick(entry, "original_price", "old_price", "list_price", "product.original_price"),
      );
      return {
        title: String(title).slice(0, 200),
        original_url: url,
        sale_price: salePrice,
        original_price: originalPrice,
        discount_percentage: computeDiscount(salePrice, originalPrice),
        currency:
          typeof pick(entry, "currency") === "string" ? String(pick(entry, "currency")) : "BRL",
        coupon: firstNonEmpty(pick(entry, "coupon", "code")) || null,
        marketplace_id: null,
        source_id: sourceId,
      };
    })
    .filter((candidate) => candidate.title && candidate.title !== "Oferta");
}

function extractEntries(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload.filter((item) => item && typeof item === "object");
  if (payload && typeof payload === "object") {
    const object = payload as Record<string, unknown>;
    for (const key of ["results", "data", "items", "offers", "products", "entries"]) {
      if (Array.isArray(object[key])) return object[key] as unknown[];
    }
    for (const value of Object.values(object)) {
      const found = extractEntries(value);
      if (found.length > 0) return found;
    }
  }
  return [];
}

function pick(entry: unknown, ...paths: string[]): unknown {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (current && typeof current === "object") {
        const object = current as Record<string, unknown>;
        if (key in object) return object[key];
        const alternate = Object.entries(object).find(
          ([k, v]) => k.toLowerCase() === key.toLowerCase() && v !== null && v !== undefined,
        );
        return alternate ? alternate[1] : undefined;
      }
      return undefined;
    }, entry);
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[R$\s.\u00a0]/g, "").replace(",", ".");
    if (cleaned === "" || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function computeDiscount(salePrice: number | null, originalPrice: number | null): number | null {
  if (salePrice === null || originalPrice === null || originalPrice <= 0) return null;
  const discount = Math.round((1 - salePrice / originalPrice) * 100);
  return discount > 0 && discount <= 100 ? discount : null;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export interface InlinePublishResult {
  published: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Publica UMA oferta recém-capturada pelos monitores/automações ativas que
 * apontam para a fonte. Usado pelo webhook do Telegram: a publicação acontece
 * imediatamente quando uma oferta nova chega, sem depender do sweep agendado.
 */
export async function publishOfferForSource(
  db: Db,
  sourceId: string,
  offer: Offer,
): Promise<InlinePublishResult> {
  const result: InlinePublishResult = { published: 0, failed: 0, skipped: 0, errors: [] };
  const inlineReport: ScheduledRunReport = {
    offersCaptured: 0,
    offersIgnored: 0,
    offersPublished: 0,
    offersFailed: 0,
    errors: [],
  };

  const [monitorsRes, automationsRes, destinationsRes, templatesRes, marketplacesRes, accountsRes] =
    await Promise.all([
      db.from("monitors").select("*"),
      db.from("automations").select("*"),
      db.from("destinations").select("*"),
      db.from("templates").select("*"),
      db.from("marketplaces").select("id, name"),
      db.from("affiliate_accounts").select("user_id, marketplace_id, status, configuration"),
    ]);

  for (const res of [
    monitorsRes,
    automationsRes,
    destinationsRes,
    templatesRes,
    marketplacesRes,
    accountsRes,
  ]) {
    if (res.error) result.errors.push(`Banco de dados: ${res.error.message}`);
  }
  if (result.errors.length > 0) return result;

  const monitors = (monitorsRes.data ?? []) as Monitor[];
  const automations = automationsRes.data ?? [];
  const destinations = (destinationsRes.data ?? []) as Destination[];
  const templates = templatesRes.data ?? [];
  const marketplaceName = new Map<string, string>(
    (marketplacesRes.data ?? []).map((item: { id: string; name: string }) => [item.id, item.name]),
  );
  const destinationsById = new Map<string, Destination>(destinations.map((d) => [d.id, d]));
  const templatesById = new Map<string, { id: string; content: string }>(
    (templates as Array<{ id: string; content: string }>).map((item) => [item.id, item]),
  );

  const publishedRes = await db
    .from("publications")
    .select("offer_id, destination_id")
    .eq("offer_id", offer.id)
    .eq("status", "published");
  const publishedKeys = new Set<string>();
  for (const row of publishedRes.data ?? []) {
    if (row.offer_id && row.destination_id) {
      publishedKeys.add(`${row.offer_id}::${row.destination_id}`);
    }
  }

  await ensureAliExpressAffiliateUrl(db, offer, buildAliExpressAccounts(accountsRes.data ?? []));

  const touchedMonitorIds = new Set<string>();
  for (const monitor of monitors) {
    if (monitor.status !== "active") continue;
    const config = configurationOf(monitor);
    if (!(config.source_ids ?? []).includes(sourceId)) continue;
    touchedMonitorIds.add(monitor.id);

    const destination = config.destination_id ? destinationsById.get(config.destination_id) : null;
    if (!destination) {
      result.errors.push(`${monitor.name}: sem destino configurado para publicar.`);
      continue;
    }
    if (publishedKeys.has(`${offer.id}::${destination.id}`)) {
      result.skipped++;
      continue;
    }
    if (
      (config.spacing_minutes ?? 0) > 0 &&
      (await isWithinSpacingWindow(db, destination.id, config.spacing_minutes))
    ) {
      result.skipped++;
      continue;
    }
    if (!passesFilters(offer, config)) {
      result.skipped++;
      continue;
    }

    const template = config.template_id ? templatesById.get(config.template_id) : null;
    const content = resolveContent(offer, template?.content, marketplaceName);
    const finalContent =
      config.ai_enabled && content
        ? await applyAiOrDefault(offer, content, config.ai_instruction, marketplaceName)
        : content;
    const attempt = await publishToDestinationServer(db, destination, offer, config, finalContent);
    await recordPublication(
      db,
      offer,
      destination,
      finalContent,
      attempt,
      inlineReport,
      publishedKeys,
    );
    if (attempt.ok) result.published++;
    else result.failed++;
  }

  const touchedAutomationIds = new Set<string>();
  for (const automation of automations) {
    if (automation.status !== "active" || automation.source_id !== sourceId) continue;
    touchedAutomationIds.add(automation.id);

    const destination = automation.destination_id
      ? destinationsById.get(automation.destination_id)
      : null;
    if (!destination) {
      result.errors.push(`Automação "${automation.name}": sem destino configurado.`);
      continue;
    }
    if (publishedKeys.has(`${offer.id}::${destination.id}`)) {
      result.skipped++;
      continue;
    }

    const config = automationConfigOf(automation);
    const template = automation.template_id ? templatesById.get(automation.template_id) : null;
    const content = resolveContent(offer, template?.content, marketplaceName);
    const finalContent =
      config.ai_enabled && content
        ? await applyAiOrDefault(offer, content, config.ai_instruction, marketplaceName)
        : content;
    const attempt = await publishToDestinationServer(db, destination, offer, config, finalContent);
    await recordPublication(
      db,
      offer,
      destination,
      finalContent,
      attempt,
      inlineReport,
      publishedKeys,
    );
    if (attempt.ok) result.published++;
    else result.failed++;
  }

  result.errors.push(...inlineReport.errors);

  const now = new Date().toISOString();
  if (touchedMonitorIds.size > 0) {
    await db
      .from("monitors")
      .update({ last_activity_at: now })
      .in("id", [...touchedMonitorIds]);
  }
  if (touchedAutomationIds.size > 0) {
    await db
      .from("automations")
      .update({ last_activity_at: now })
      .in("id", [...touchedAutomationIds]);
  }

  return result;
}

async function isWithinSpacingWindow(
  db: Db,
  destinationId: string,
  spacingMinutes: number | null | undefined,
): Promise<boolean> {
  if (!spacingMinutes || spacingMinutes <= 0) return false;
  const { data } = await db
    .from("publications")
    .select("published_at")
    .eq("destination_id", destinationId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1);
  const last = data?.[0]?.published_at;
  if (!last) return false;
  const elapsedMs = Date.now() - new Date(last).getTime();
  return elapsedMs < spacingMinutes * 60 * 1000;
}
