// ============================================================
// Offer Engine - Public barrel
// ============================================================

export * from "./types";

export { MessageParser, messageParser } from "./MessageParser";
export { OfferNormalizer, offerNormalizer } from "./OfferNormalizer";
export { MarketplaceDetector, marketplaceDetector } from "./MarketplaceDetector";
export {
  DEFAULT_ADAPTERS,
  MARKETPLACE_NAMES,
  marketplaceName,
  MercadoLivreAdapter,
  ShopeeAdapter,
  AmazonAdapter,
  MagaluAdapter,
  AliExpressAdapter,
  SheinAdapter,
  UnknownAdapter,
} from "./marketplaceAdapters/adapters";
export { DuplicateDetector, duplicateDetector } from "./DuplicateDetector";
export { FilterEngine, buildFilterEngine } from "./FilterEngine";
export { TemplateEngine, templateEngine, buildContext, TEMPLATE_VARIABLES } from "./TemplateEngine";
export { AffiliateLinkService, affiliateLinkService } from "./AffiliateLinkService";
export { PublicationBuilder, publicationBuilder } from "./PublicationBuilder";
export { UrlExtractor, urlExtractor } from "./UrlExtractor";
export type { CooldownConfig, DuplicateResult } from "./DuplicateDetector";
export * from "./formatters";
export { sha256, fnv1a64, buildFingerprint, canonicalString } from "./hash";
export { validateUrl, normalizeUrl, extractUrls, safeUrl } from "./validation/urlSafety";
export {
  getConnector,
  isConnected,
  connectorRegistry,
  TelegramConnector,
  WhatsAppConnector,
} from "./connectors";
export type { ConnectorStatus, PlatformConnector } from "./connectors";
