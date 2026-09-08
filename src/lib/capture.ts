import { createCrud, requireUserId, toUserMessage } from "@/services/base";
import { listMarketplaces } from "@/services/affiliate";
import { renderTemplate } from "@/services/templates";
import { configurationOf } from "@/lib/monitor-config";
import { destinationConfiguration } from "@/lib/destination-config";
import { normalizeText } from "@/lib/affiliate-converter";
import { captureTelegramSource } from "@/lib/telegram.server";
import { captureAmazonSourceRpc } from "@/lib/amazon-creators.server";
import { formatOfferWithAI } from "@/lib/ai.server";
import {
  buildOfferBannerConfig,
  loadImageAsDataUrl,
  renderBannerToBlob,
} from "@/lib/banner-render";
import { callTelegramApi } from "@/lib/telegram-proxy.server";
import { bannerConfigOf } from "@/lib/banner-config";
import { supabase } from "@/integrations/supabase/client";
import type { BannerConfig } from "@/types/banner";
import {
  cleanProductUrl,
  isPublicationDuplicate,
  normalizeProductTitle,
} from "@/lib/duplicate-prevention";
import {
  type Destination,
  type Monitor,
  type MonitorConfiguration,
  type Offer,
  type Publication,
  type Source,
  type Template,
} from "@/types";

const sourcesRepo = createCrud("sources");
const monitorsRepo = createCrud("monitors");
const offersRepo = createCrud("offers");
const destinationsRepo = createCrud("destinations");
const templatesRepo = createCrud("templates");
const publicationsRepo = createCrud("publications");
const bannersRepo = createCrud("banners");

export interface CaptureReport {
  sourcesChecked: number;
  offersCaptured: number;
  offersIgnored: number;
  offersPublished: number;
  offersFailed: number;
  errors: string[];
}

interface Candidate {
  title: string;
  original_url: string | null;
  sale_price: number | null;
  original_price: number | null;
  discount_percentage: number | null;
  currency: string;
  coupon: string | null;
  marketplace_id: string | null;
  source_id: string;
}

const PROCESSABLE_OFFER_STATUS: Offer["status"][] = [
  "captured",
  "processing",
  "processed",
  "approved",
  "error",
];

/**
 * Executa um ciclo completo de captura e publicação:
 * 1. Lê fontes ativas (feed/API) e extrai candidatos a ofertas.
 * 2. Salva apenas o que ainda não existe (deduplicação).
 * 3. Para cada monitor ativo, aplica filtros e publica no destino configurado.
 */
export async function runCapture(): Promise<CaptureReport> {
  const userId = await requireUserId();
  const report: CaptureReport = {
    sourcesChecked: 0,
    offersCaptured: 0,
    offersIgnored: 0,
    offersPublished: 0,
    offersFailed: 0,
    errors: [],
  };

  const marketplaces = await listMarketplaces();
  const marketplaceName = new Map(marketplaces.map((item) => [item.id, item.name]));

  const existingOffers = await offersRepo.list();
  const knownKeys = new Set<string>();
  for (const offer of existingOffers) {
    const cleaned = cleanProductUrl(offer.original_url);
    const normTitle = normalizeProductTitle(offer.title);
    if (cleaned) knownKeys.add(`${offer.source_id ?? ""}::${cleaned}`);
    if (normTitle) knownKeys.add(`${offer.source_id ?? ""}::${normTitle}`);
  }

  const activeSources = await sourcesRepo.list({ filters: { status: "active" } });
  const candidates: Candidate[] = [];
  for (const source of activeSources) {
    if (!isScrapable(source)) {
      report.errors.push(
        `${source.name}: captura via ${source.type} ainda requer integração externa.`,
      );
      continue;
    }
    if (!source.identifier) {
      report.errors.push(`${source.name}: sem identificador (URL) para capturar.`);
      continue;
    }
    report.sourcesChecked++;
    if (source.type === "telegram") {
      const result = await captureTelegramSource({
        data: {
          token: await accessToken(),
          identifier: source.identifier,
          sourceId: source.id,
          userId,
        },
      });
      report.offersCaptured += result.offersCaptured;
      report.offersIgnored += result.offersIgnored;
      report.offersFailed += result.offersFailed;
      report.errors.push(...result.errors);
      continue;
    }
    if (source.type === "amazon") {
      const result = await captureAmazonSourceRpc({
        data: {
          identifier: source.identifier,
          sourceId: source.id,
          userId,
        },
      });
      report.offersCaptured += result.offersCaptured;
      report.offersIgnored += result.offersIgnored;
      report.offersFailed += result.offersFailed;
      report.errors.push(...result.errors);
      continue;
    }
    const found = await captureFromSource(source);
    for (const candidate of found) {
      const cleaned = cleanProductUrl(candidate.original_url);
      const normTitle = normalizeProductTitle(candidate.title);
      const urlKey = cleaned ? `${candidate.source_id ?? ""}::${cleaned}` : null;
      const titleKey = normTitle ? `${candidate.source_id ?? ""}::${normTitle}` : null;

      if ((urlKey && knownKeys.has(urlKey)) || (titleKey && knownKeys.has(titleKey))) {
        report.offersIgnored++;
        continue;
      }
      if (urlKey) knownKeys.add(urlKey);
      if (titleKey) knownKeys.add(titleKey);
      candidates.push(candidate);
    }
  }

  for (const candidate of candidates) {
    try {
      await offersRepo.create(candidate);
      report.offersCaptured++;
    } catch (error) {
      report.errors.push(`Falha ao salvar "${candidate.title}": ${toUserMessage(error)}`);
    }
  }

  const freshOffers = await offersRepo.list();
  const offersBySource = new Map<string, Offer[]>();
  for (const offer of freshOffers) {
    const bucket = offersBySource.get(offer.source_id ?? "") ?? [];
    bucket.push(offer);
    offersBySource.set(offer.source_id ?? "", bucket);
  }

  const activeMonitors = (await monitorsRepo.list()).filter(
    (monitor) => monitor.status === "active",
  );
  if (activeMonitors.length === 0) {
    report.errors.push("Nenhum monitor ativo para publicar ofertas.");
  }
  const destinations = await destinationsRepo.list();
  const templates = await templatesRepo.list();
  const publications = await publicationsRepo.list();

  for (const monitor of activeMonitors) {
    const result = await processMonitor(
      monitor,
      offersBySource,
      destinations,
      templates,
      publications,
      marketplaceName,
    );
    report.offersPublished += result.published;
    report.offersFailed += result.failed;
    report.errors.push(...result.errors);
  }

  return report;
}

function isScrapable(source: Source): boolean {
  return (
    source.type === "feed" ||
    source.type === "api" ||
    source.type === "telegram" ||
    source.type === "amazon"
  );
}

async function captureFromSource(source: Source): Promise<Candidate[]> {
  const text = await fetchText(source.identifier ?? "");
  if (!text) return [];
  if (source.type === "feed") return parseFeedXml(text, source.id);
  try {
    return parseJsonEntries(JSON.parse(text), source.id);
  } catch {
    return [];
  }
}

/** Busca o conteúdo de uma URL. Retorna null com falhas de rede/CORS. */
export async function fetchText(url: string, timeoutMs = 15000): Promise<string | null> {
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

/** Access token da sessão atual, repassado às funções de servidor. */
async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function parseFeedXml(xml: string, sourceId: string): Candidate[] {
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const items = Array.from(doc.querySelectorAll("item, entry"));
    return items
      .map((node): Candidate | null => {
        const textOf = (selector: string) =>
          node.querySelector(selector)?.textContent?.trim() ?? "";
        const linkElement = node.querySelector("link");
        const url =
          linkElement?.getAttribute?.("href")?.trim() || linkElement?.textContent?.trim() || "";
        const title = firstNonEmpty(textOf("title"), url);
        if (!title) return null;
        return {
          title,
          original_url: url || null,
          sale_price: toNumber(
            textOf("salePrice") || textOf("sale_price") || textOf("sale price") || textOf("price"),
          ),
          original_price: toNumber(textOf("originalPrice") || textOf("original_price")),
          discount_percentage: computeDiscount(
            toNumber(textOf("salePrice") || textOf("sale_price") || textOf("sale price")),
            toNumber(textOf("originalPrice") || textOf("original_price")),
          ),
          currency: "BRL",
          coupon: firstNonEmpty(textOf("coupon")) || null,
          marketplace_id: null,
          source_id: sourceId,
        };
      })
      .filter((candidate): candidate is Candidate => candidate !== null);
  } catch {
    return [];
  }
}

function parseJsonEntries(payload: unknown, sourceId: string): Candidate[] {
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

/** Procura a primeira matriz de objetos no JSON da resposta. */
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

/** Acessa caminhos aninhados com pontos, ex.: "product.price". */
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

async function ensureOfferAffiliateUrlClient(offer: Offer): Promise<void> {
  if (!offer.original_url) return;
  if (offer.affiliate_url && offer.affiliate_url.includes("meli.la")) return;

  const isMlUrl = /mercadolivr|mercadolibr|meli\.la/i.test(offer.original_url);
  if (!isMlUrl) return;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) {
      const { convertMercadoLivreMessage } = await import("@/lib/mercado-livre-converter.server");
      const outcome = await convertMercadoLivreMessage({
        data: { token, text: offer.original_url, single: true },
      });
      const convertedLink = outcome.links.find((l) => l.status === "success" && l.affiliate)?.affiliate;
      if (convertedLink) {
        offer.affiliate_url = convertedLink;
        await offersRepo.update(offer.id, { affiliate_url: convertedLink });
      }
    }
  } catch {
    // best-effort
  }
}

interface MonitorRun {
  published: number;
  failed: number;
  errors: string[];
}

async function processMonitor(
  monitor: Monitor,
  offersBySource: Map<string, Offer[]>,
  destinations: Destination[],
  templates: Template[],
  publications: Publication[],
  marketplaceName: Map<string, string>,
): Promise<MonitorRun> {
  const result: MonitorRun = { published: 0, failed: 0, errors: [] };
  const config = configurationOf(monitor);
  const sourceIds = config.source_ids ?? [];

  if (sourceIds.length === 0) {
    result.errors.push(`${monitor.name}: sem fontes vinculadas.`);
    await monitorsRepo.update(monitor.id, { last_activity_at: new Date().toISOString() });
    return result;
  }

  const candidates: Offer[] = [];
  for (const sourceId of sourceIds) {
    for (const offer of offersBySource.get(sourceId) ?? []) {
      if (PROCESSABLE_OFFER_STATUS.includes(offer.status) && passesFilters(offer, config)) {
        candidates.push(offer);
      }
    }
  }

  const destination = destinations.find((item) => item.id === config.destination_id);
  const template = templates.find((item) => item.id === config.template_id);
  const spacingMinutes = config.spacing_minutes ?? 0;

  if (!destination) {
    const reason = config.destination_id
      ? "destino não encontrado (confira o vínculo)."
      : "sem destino vinculado. Abra o monitor e configure o Destino.";
    result.errors.push(`${monitor.name}: ${reason}`);
    await monitorsRepo.update(monitor.id, { last_activity_at: new Date().toISOString() });
    return result;
  }

  if (candidates.length === 0) {
    result.errors.push(`${monitor.name}: nenhuma oferta nova para publicar.`);
    await monitorsRepo.update(monitor.id, { last_activity_at: new Date().toISOString() });
    return result;
  }

  for (const offer of candidates) {
    if (
      publications.some(
        (item) =>
          item.offer_id === offer.id &&
          item.destination_id === destination.id &&
          item.status === "published",
      )
    ) {
      continue;
    }

    // Checagem de duplicidade por URL canônica, ID de produto (ASIN/MLB) ou título
    const isDup = await isPublicationDuplicate(
      supabase,
      monitor.user_id,
      destination.id,
      offer,
      24,
    );
    if (isDup) {
      await offersRepo.update(offer.id, {
        status: "processed",
        processed_at: new Date().toISOString(),
      });
      continue;
    }

    await ensureOfferAffiliateUrlClient(offer);

    const content = template
      ? renderTemplate(template.content, {
          ...offer,
          marketplace: marketplaceName.get(offer.marketplace_id ?? "") ?? "—",
        })
      : defaultContent(offer, marketplaceName);

    const finalContent = config.ai_enabled
      ? await applyAI(offer, content, config.ai_instruction, Boolean(template))
      : content;
    const media =
      destination.type === "telegram" && config.include_banner
        ? await buildPublicationMedia(
            offer,
            { banner_id: config.banner_id ?? null },
            marketplaceName.get(offer.marketplace_id ?? "") ?? null,
          )
        : [];
    const attempt = await publishToDestination(destination, offer, finalContent, media);
    const now = new Date().toISOString();
    await publicationsRepo.create({
      user_id: monitor.user_id,
      offer_id: offer.id,
      destination_id: destination.id,
      content: finalContent,
      status: attempt.ok ? "published" : "failed",
      published_at: attempt.ok ? now : null,
      error_message: attempt.ok ? null : (attempt.error ?? "Falha ao publicar"),
    });
    await offersRepo.update(offer.id, {
      status: attempt.ok ? "published" : "error",
      processed_at: now,
    });
    if (attempt.ok) {
      result.published++;
      if (spacingMinutes > 0) break;
    } else {
      result.failed++;
      result.errors.push(`${offer.title}: ${attempt.error ?? "Falha ao publicar"}`);
    }
  }

  if (result.published + result.failed > 0) {
    await monitorsRepo.update(monitor.id, { last_activity_at: new Date().toISOString() });
  }
  return result;
}

function passesFilters(offer: Offer, config: MonitorConfiguration): boolean {
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

async function publishToDestination(
  destination: Destination,
  offer: Offer,
  content: string,
  media: TelegramUploadItem[] = [],
): Promise<{ ok: boolean; error?: string }> {
  const config = destinationConfiguration(destination);
  if (destination.type === "telegram") {
    if (!config.token || !config.chat_id) {
      return { ok: false, error: "Destino sem token ou canal configurado." };
    }
    if (media.length > 0) {
      return sendTelegramMedia(config.token, config.chat_id, media, content);
    }
    return sendTelegramMessage(config.token, config.chat_id, content);
  }
  if (destination.type === "other") {
    if (!config.url) return { ok: false, error: "Destino sem URL de webhook." };
    return sendWebhook(config.url, offer);
  }
  return { ok: false, error: `Publicação via ${destination.type} ainda requer integração.` };
}

export type CaptureSummaryShape = Pick<
  CaptureReport,
  "offersCaptured" | "offersPublished" | "offersIgnored" | "offersFailed" | "errors"
>;

export type AutomationReport = CaptureSummaryShape;

/**
 * Executa o fluxo de uma automação: captura da fonte vinculada,
 * aplica o template e publica no destino. Reutiliza as mesmas
 * regras do motor (deduplicação e publicação real).
 */
export async function runAutomation(automation: {
  source_id: string | null;
  destination_id: string | null;
  template_id: string | null;
  configuration?: {
    ai_enabled?: boolean;
    ai_instruction?: string | null;
    include_banner?: boolean;
    banner_id?: string | null;
  };
}): Promise<AutomationReport> {
  const userId = await requireUserId();
  const report: AutomationReport = {
    offersCaptured: 0,
    offersIgnored: 0,
    offersPublished: 0,
    offersFailed: 0,
    errors: [],
  };

  const marketplaces = await listMarketplaces();
  const marketplaceName = new Map(marketplaces.map((item) => [item.id, item.name]));

  if (!automation.source_id) {
    report.errors.push("Automação sem fonte vinculada.");
    return report;
  }
  const source = await sourcesRepo.getById(automation.source_id);
  if (!source) {
    report.errors.push("Fonte vinculada não encontrada.");
    return report;
  }
  if (source.status !== "active") {
    report.errors.push(`Fonte "${source.name}" está pausada. Ative-a para executar.`);
    return report;
  }
  if (!isScrapable(source)) {
    report.errors.push(
      `Fonte "${source.name}": captura via ${source.type} requer integração externa.`,
    );
    return report;
  }
  if (!source.identifier) {
    report.errors.push(`Fonte "${source.name}" sem URL para capturar.`);
    return report;
  }

  const existingOffers = await offersRepo.list();
  const knownKeys = new Set<string>();
  for (const offer of existingOffers) {
    if (offer.original_url) knownKeys.add(`${offer.source_id ?? ""}::${offer.original_url}`);
    knownKeys.add(`${offer.source_id ?? ""}::${offer.title.toLowerCase()}`);
  }

  if (source.type === "telegram") {
    const result = await captureTelegramSource({
      data: {
        token: await accessToken(),
        identifier: source.identifier,
        sourceId: source.id,
        userId,
      },
    });
    report.offersCaptured += result.offersCaptured;
    report.offersIgnored += result.offersIgnored;
    report.offersFailed += result.offersFailed;
    report.errors.push(...result.errors);
  } else if (source.type === "amazon") {
    const result = await captureAmazonSourceRpc({
      data: {
        identifier: source.identifier,
        sourceId: source.id,
        userId,
      },
    });
    report.offersCaptured += result.offersCaptured;
    report.offersIgnored += result.offersIgnored;
    report.offersFailed += result.offersFailed;
    report.errors.push(...result.errors);
  } else {
    const found = await captureFromSource(source);
    for (const candidate of found) {
      const key = candidate.original_url
        ? `${candidate.source_id ?? ""}::${candidate.original_url}`
        : `${candidate.source_id ?? ""}::${candidate.title.toLowerCase()}`;
      if (knownKeys.has(key)) {
        report.offersIgnored++;
        continue;
      }
      knownKeys.add(key);
      try {
        await offersRepo.create(candidate);
        report.offersCaptured++;
      } catch (error) {
        report.errors.push(`Falha ao salvar "${candidate.title}": ${toUserMessage(error)}`);
      }
    }
  }

  const destination = automation.destination_id
    ? await destinationsRepo.getById(automation.destination_id)
    : null;
  if (!destination) {
    report.errors.push("Automação sem destino configurado para publicar.");
  }
  const template = automation.template_id
    ? await templatesRepo.getById(automation.template_id)
    : null;

  if (destination) {
    const publicationList = await publicationsRepo.list();
    const freshOffers = (await offersRepo.list()).filter(
      (offer) => offer.source_id === source.id && PROCESSABLE_OFFER_STATUS.includes(offer.status),
    );
    for (const offer of freshOffers) {
      if (
        publicationList.some(
          (item) =>
            item.offer_id === offer.id &&
            item.destination_id === destination.id &&
            item.status === "published",
        )
      ) {
        continue;
      }

      // Checagem de duplicidade por URL canônica, ID de produto (ASIN/MLB) ou título
      const isDup = await isPublicationDuplicate(supabase, userId, destination.id, offer, 24);
      if (isDup) {
        await offersRepo.update(offer.id, {
          status: "processed",
          processed_at: new Date().toISOString(),
        });
        report.offersIgnored++;
        continue;
      }

      const content = template
        ? renderTemplate(template.content, {
            ...offer,
            marketplace: marketplaceName.get(offer.marketplace_id ?? "") ?? "—",
          })
        : defaultContent(offer, marketplaceName);
      const automationConfig = automation.configuration ?? {};
      const finalContent =
        automationConfig.ai_enabled !== false
          ? await applyAI(offer, content, automationConfig.ai_instruction, Boolean(template))
          : content;
      const media =
        destination.type === "telegram" && automationConfig.include_banner
          ? await buildPublicationMedia(
              offer,
              { banner_id: automationConfig.banner_id ?? null },
              marketplaceName.get(offer.marketplace_id ?? "") ?? null,
            )
          : [];
      const attempt = await publishToDestination(destination, offer, finalContent, media);
      const now = new Date().toISOString();
      await publicationsRepo.create({
        user_id: userId,
        offer_id: offer.id,
        destination_id: destination.id,
        content: finalContent,
        status: attempt.ok ? "published" : "failed",
        published_at: attempt.ok ? now : null,
        error_message: attempt.ok ? null : (attempt.error ?? "Falha ao publicar"),
      });
      await offersRepo.update(offer.id, {
        status: attempt.ok ? "published" : "error",
        processed_at: now,
      });
      if (attempt.ok) report.offersPublished++;
      else {
        report.offersFailed++;
        report.errors.push(`${offer.title}: ${attempt.error ?? "Falha ao publicar"}`);
      }
    }
  }

  return report;
}

/** Envia mensagem pelo Bot API do Telegram via proxy do servidor (sem CORS). */
export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    return await callTelegramApi({
      data: { token, method: "sendMessage", chat_id: chatId, text },
    });
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}

/** Item de mídia anexado à publicação: bytes do banner ou URL da imagem do produto. */
export interface TelegramUploadItem {
  name: string;
  base64?: string;
  url?: string;
}

/**
 * Envia fotos ao Telegram via proxy do servidor.
 * 1 item = sendPhoto; 2+ = sendMediaGroup (attach://fileN).
 */
export async function sendTelegramMedia(
  token: string,
  chatId: string,
  media: TelegramUploadItem[],
  caption: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    return await callTelegramApi({
      data: {
        token,
        method: media.length === 1 ? "sendPhoto" : "sendMediaGroup",
        chat_id: chatId,
        text: caption,
        files: media,
      },
    });
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}

/** Reescreve a mensagem com IA (Groq). Falhas caem no conteúdo original. */
async function applyAI(
  offer: Offer,
  content: string,
  instruction?: string | null,
  hasCustomTemplate = false,
): Promise<string> {
  try {
    const result = await formatOfferWithAI({
      data: {
        offer: {
          title: offer.title,
          sale_price: offer.sale_price,
          original_price: offer.original_price,
          discount_percentage: offer.discount_percentage,
          coupon: offer.coupon,
          url: offer.affiliate_url ?? offer.original_url,
        },
        content,
        hasCustomTemplate,
        instruction: instruction ?? null,
      },
    });
    if (result.ok && result.text) return result.text;
    return content;
  } catch {
    return content;
  }
}

/** Gera o banner (baseado na oferta + configuração) e anexa a imagem do produto. */
async function buildPublicationMedia(
  offer: Offer,
  config: { banner_id?: string | null },
  marketplaceName: string | null,
): Promise<TelegramUploadItem[]> {
  const items: TelegramUploadItem[] = [];
  try {
    const imageUrl = await getOfferImageUrl(offer.id);
    const imageDataUrl = await loadImageAsDataUrl(imageUrl);

    let saved: BannerConfig | null = null;
    if (config.banner_id) {
      const banner = await bannersRepo.getById(config.banner_id);
      if (banner) saved = bannerConfigOf(banner);
    }
    if (!saved) {
      const allBanners = await bannersRepo.list();
      const defaultBanner =
        allBanners.find((b) => {
          const c = bannerConfigOf(b);
          return c.isDefault === true;
        }) ?? allBanners[0];
      if (defaultBanner) saved = bannerConfigOf(defaultBanner);
    }

    const bannerConfig = buildOfferBannerConfig(offer, marketplaceName, imageDataUrl, saved);
    const bannerBlob = await renderBannerToBlob(bannerConfig, 1);
    if (bannerBlob) items.push({ name: "banner.png", base64: await blobToBase64(bannerBlob) });

    if (imageUrl) items.push({ name: "product.png", url: imageUrl });
  } catch {
    return [];
  }
  return items;
}

/** Converte um Blob em base64 (sem prefixo de data URL). */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler a imagem."));
    reader.readAsDataURL(blob);
  });
}

/** Primeira imagem do produto cadastrada (offer_media). */
async function getOfferImageUrl(offerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("offer_media")
    .select("url")
    .eq("offer_id", offerId)
    .order("position", { ascending: true })
    .limit(1);
  if (error) return null;
  return data?.[0]?.url ?? null;
}

async function sendWebhook(url: string, offer: Offer): Promise<{ ok: boolean; error?: string }> {
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
    return { ok: false, error: toUserMessage(error) };
  }
}

function defaultContent(offer: Offer, marketplaceName: Map<string, string>): string {
  const parts: string[] = [];
  const isCoupon = Boolean(offer.coupon?.trim()) || /cupom|cupons|voucher/i.test(offer.title ?? "");

  if (offer.title) {
    if (offer.title.startsWith("➡️")) {
      parts.push(offer.title);
    } else if (isCoupon && !offer.title.includes("🔥")) {
      parts.push(`➡️ 🔥 ${offer.title}`);
    } else {
      parts.push(`➡️ ${offer.title}`);
    }
  }

  const priceLines: string[] = [];
  if (offer.sale_price !== null) {
    priceLines.push(`✅ ${money(offer.sale_price)}`);
  }
  if (offer.discount_percentage !== null && offer.discount_percentage !== undefined) {
    priceLines.push(`⚡ ${offer.discount_percentage}% OFF`);
  }
  if (offer.coupon) {
    const code = offer.coupon.replace(/[`]/g, "").trim();
    priceLines.push(`🏷️ Cupom: \`${code}\``);
  }

  if (priceLines.length > 0) {
    parts.push(priceLines.join("\n"));
  }

  const url = offer.affiliate_url ?? offer.original_url;
  if (url) {
    parts.push(`🛒 ${url}`);
  }

  return parts.join("\n\n");
}

export function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Envia uma mensagem de teste real ao destino configurado. */
export async function sendTestToDestination(
  destination: Destination,
): Promise<{ ok: boolean; error?: string }> {
  const config = destinationConfiguration(destination);
  if (destination.type === "telegram") {
    if (!config.token || !config.chat_id) {
      return { ok: false, error: "Configure o token do bot e o canal para testar." };
    }
    const text = `✅ Teste do Affiliate Hub\n\n${destination.name} está pronto para publicar suas ofertas.`;
    return sendTelegramMessage(config.token, config.chat_id, text);
  }
  if (destination.type === "other") {
    if (!config.url) return { ok: false, error: "Configure a URL do webhook para testar." };
    try {
      const response = await fetch(config.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true, message: "Affiliate Hub — teste de destino" }),
      });
      if (!response.ok) return { ok: false, error: `Webhook HTTP ${response.status}` };
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toUserMessage(error) };
    }
  }
  return { ok: false, error: `Publicação via ${destination.type} ainda requer integração.` };
}
