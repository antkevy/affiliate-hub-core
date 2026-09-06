// ============================================================
// Offer Engine - Core Domain Types
// ============================================================

export type JobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

// ------------------------------------------------------------------
// Incoming message (entry point, platform-agnostic)
// ------------------------------------------------------------------
export type MessageSource = "telegram" | "whatsapp" | "api" | "feed" | "manual";

export interface IncomingMedia {
  type: "image" | "video" | "file" | "audio";
  url?: string;
  name?: string;
  mime?: string;
  size?: number;
}

export interface IncomingMessage {
  id?: string;
  externalId?: string;
  source: MessageSource;
  platform?: string;
  text: string;
  media?: IncomingMedia[];
  urls?: string[];
  author?: string;
  date?: string;
  metadata?: Record<string, unknown>;
  hash?: string;
}

// ------------------------------------------------------------------
// Parsed offer (result of MessageParser)
// ------------------------------------------------------------------
export interface ParsedOffer {
  title: string | null;
  description: string | null;
  price: number | null;
  oldPrice: number | null;
  discountPercentage: number | null;
  coupon: string | null;
  url: string | null;
  productCode: string | null;
  rawText: string;
}

// ------------------------------------------------------------------
// Marketplace detection
// ------------------------------------------------------------------
export type MarketplaceKey =
  "mercado-livre" | "shopee" | "amazon" | "magalu" | "aliexpress" | "shein" | "unknown";

export interface MarketplaceDetection {
  key: MarketplaceKey;
  name: string;
  domain: string | null;
  confidence: number;
}

// ------------------------------------------------------------------
// Normalized offer (internal canonical representation)
// ------------------------------------------------------------------
export interface NormalizedOffer {
  id?: string;
  marketplace: MarketplaceKey;
  marketplaceName: string;
  externalProductId: string | null;
  title: string;
  description: string | null;
  price: number;
  oldPrice: number | null;
  discountPercentage: number | null;
  coupon: string | null;
  originalUrl: string;
  canonicalUrl: string;
  affiliateUrl: string | null;
  image: string | null;
  media: IncomingMedia[];
  source: string;
  capturedAt: string;
  fingerprint: string;
  metadata: Record<string, unknown>;
  internalId?: string;
}

// ------------------------------------------------------------------
// Marketplace adapter interface
// ------------------------------------------------------------------
export interface MarketplaceAdapter {
  key: MarketplaceKey;
  domainPatterns: RegExp[];
  detectUrl(url: string): boolean;
  normalizeUrl(url: string): string | null;
  extractProductId(url: string): string | null;
  getProductMeta?(url: string): Promise<{ title?: string; image?: string } | null>;
  generateAffiliateLink(
    url: string,
    opts?: { accountId?: string; subIds?: Record<string, string> },
  ): Promise<string | null>;
  status(): "NOT_CONNECTED" | "CONNECTED";
}

// ------------------------------------------------------------------
// Filter / rule types
// ------------------------------------------------------------------
export type RuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "in"
  | "not_in";

export type RuleType =
  | "min_discount"
  | "max_discount"
  | "min_price"
  | "max_price"
  | "marketplace"
  | "category"
  | "min_rating"
  | "forbidden_words"
  | "forbidden_domains"
  | "required_words"
  | "contains_words"
  | "coupon_only"
  | "no_coupon_only";

export interface AutomationRuleSpec {
  rule_type: RuleType;
  rule_value: string;
  operator?: RuleOperator;
}

// ------------------------------------------------------------------
// Filter evaluation result
// ------------------------------------------------------------------
export interface FilterResult {
  passed: boolean;
  blockedBy: string | null;
  evaluated: {
    rule: AutomationRuleSpec;
    result: boolean;
  }[];
}

// ------------------------------------------------------------------
// Template render result
// ------------------------------------------------------------------
export interface RenderedTemplate {
  content: string;
  usedVariables: string[];
  missingVariables: string[];
}

// ------------------------------------------------------------------
// Publication payload
// ------------------------------------------------------------------
export interface PublicationPayload {
  text: string;
  media?: { type: "image" | "video"; url: string }[];
  link: string | null;
  templateName: string | null;
  bannerUrl?: string | null;
  destinationId?: string;
}

// ------------------------------------------------------------------
// Publication result
// ------------------------------------------------------------------
export interface PublicationResult {
  ok: boolean;
  externalMessageId?: string | null;
  errorMessage?: string | null;
  publishedAt?: string;
}

// ------------------------------------------------------------------
// Job types
// ------------------------------------------------------------------
export interface EngineJob {
  id: string;
  user_id: string;
  type: string;
  status: JobStatus;
  priority: number;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  idempotency_key: string | null;
  available_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  created_at: string;
}

// ------------------------------------------------------------------
// Pipeline processing result (full report)
// ------------------------------------------------------------------
export interface ProcessReport {
  ok: boolean;
  steps: {
    step: string;
    status: "ok" | "skip" | "fail" | "error";
    message?: string;
    metadata?: Record<string, unknown>;
    at: string;
  }[];
  offer?: NormalizedOffer;
  templateContent?: string;
  publication?: PublicationPayload;
  blockedBy?: string | null;
  duplicate?: boolean;
  internalId?: string;
  automationRunId?: string;
}
