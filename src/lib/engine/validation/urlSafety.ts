// ============================================================
// Offer Engine - URL validation & SSRF protection
//
// All external URLs processed by the engine MUST pass through
// this module. It blocks private/internal networks, metadata
// services, non-http(s) protocols, and malformed input.
// ============================================================

// Reserved / private IPv4 ranges we refuse to contact.
const BLOCKED_IP_PATTERNS: RegExp[] = [
  /^10\./, // 10.0.0.0/8
  /^127\./, // 127.0.0.0/8 (localhost)
  /^0\./,
  /^169\.254\./, // link-local
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
  /^192\.168\./, // 192.168.0.0/16
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // CGNAT 100.64/10
  /^[2-9][0-9]\./, // not strictly private, but treat suspicious high-ranges leniently (no block)
];

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "instance-data",
  "169.254.169.254",
]);

const BLOCKED_HOST_SUFFIXES = [
  ".internal",
  ".local",
  ".lan",
  "metadata.google.internal",
  "169.254.169.254",
];

// Metadata service endpoints to explicitly block regardless of host form.
const BLOCKED_METADATA_PATTERNS = [
  /169\.254\.169\.254/i,
  /metadata\.google\.internal/i,
  /instance-data/i,
];

export interface UrlValidationResult {
  ok: boolean;
  url: string;
  reason?: string;
}

const VALID_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Validate a URL for safe processing. Returns ok=false with a reason if the
 * URL is not safe to fetch/normalize.
 */
export function validateUrl(raw: string): UrlValidationResult {
  const url = String(raw ?? "").trim();
  if (!url) {
    return { ok: false, url, reason: "empty_url" };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, url, reason: "malformed_url" };
  }

  if (!VALID_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, url, reason: `unsupported_protocol:${parsed.protocol}` };
  }

  if (!parsed.hostname) {
    return { ok: false, url, reason: "missing_host" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block metadata service hostnames
  if (BLOCKED_METADATA_PATTERNS.some((p) => p.test(hostname))) {
    return { ok: false, url, reason: "blocked_metadata_host" };
  }

  if (BLOCKED_HOSTS.has(hostname)) {
    return { ok: false, url, reason: `blocked_host:${hostname}` };
  }

  if (BLOCKED_HOST_SUFFIXES.some((s) => hostname.endsWith(s))) {
    return { ok: false, url, reason: `blocked_host_suffix:${hostname}` };
  }

  // IP addresses: block private ranges
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const octets = ipMatch.slice(1).map(Number);
    if (octets.some((o) => o < 0 || o > 255)) {
      return { ok: false, url, reason: "invalid_ip" };
    }
    // 127.0.0.0/8
    if (octets[0] === 127) {
      return { ok: false, url, reason: "blocked_localhost" };
    }
    // 10.0.0.0/8
    if (octets[0] === 10) {
      return { ok: false, url, reason: "blocked_private_network" };
    }
    // 169.254.0.0/16 (metadata convention)
    if (octets[0] === 169 && octets[1] === 254) {
      return { ok: false, url, reason: "blocked_metadata_ip" };
    }
    // 172.16.0.0/12
    if (octets[0] === 172 && (octets[1] ?? 0) >= 16 && (octets[1] ?? 0) <= 31) {
      return { ok: false, url, reason: "blocked_private_network" };
    }
    // 192.168.0.0/16
    if (octets[0] === 192 && octets[1] === 168) {
      return { ok: false, url, reason: "blocked_private_network" };
    }
    // 100.64.0.0/10 (CGNAT)
    if (octets[0] === 100 && (octets[1] ?? 0) >= 64 && (octets[1] ?? 0) <= 127) {
      return { ok: false, url, reason: "blocked_cgnat" };
    }
  } else if (hostname.startsWith("::1") || hostname === "::") {
    // IPv6 loopback / unspecified (new URL may resolve these)
    return { ok: false, url, reason: "blocked_ipv6_loopback" };
  }

  return { ok: true, url };
}

/**
 * Normalize a URL: lowercase host, strip default ports and url fragment,
 * collapse tracking params that are known to be safe to drop.
 */
export function normalizeUrl(raw: string): string | null {
  const check = validateUrl(raw);
  if (!check.ok) return null;

  let parsed: URL;
  try {
    parsed = new URL(check.url);
  } catch {
    return null;
  }

  // Lowercase hostname
  let host = parsed.hostname.toLowerCase();
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    host = `${host}:${parsed.port}`;
  }

  // Remove fragment
  parsed.hash = "";

  const qsAllowed = stripTrackingParams(parsed.searchParams);
  return `${parsed.protocol}//${host}${parsed.pathname}${qsAllowed}`;
}

/**
 * Remove a known set of tracking params. Keeps params that may be meaningful
 * (e.g. product ids, item ids).
 */
function stripTrackingParams(params: URLSearchParams): string {
  const DROP = new Set([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "igshid",
    "mc_cid",
    "mc_eid",
    "ref",
    "source",
    "campaign",
  ]);
  const kept: string[] = [];
  params.forEach((value, key) => {
    if (!DROP.has(key.toLowerCase())) {
      kept.push(`${key}=${value}`);
    }
  });
  return kept.length ? `?${kept.join("&")}` : "";
}

/**
 * Extract all http/https URLs from a text body.
 */
export function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s"'<>]+/gi;
  const matches = (String(text ?? "").match(re) || []).map((u) => u.replace(/[),.;!?]+$/, ""));
  const unique = new Set<string>();
  const result: string[] = [];
  for (const m of matches) {
    const norm = normalizeUrl(m);
    if (norm && !unique.has(norm)) {
      unique.add(norm);
      result.push(norm);
    }
  }
  return result;
}

/**
 * Validate a URL and return it canonicalized if safe, else null.
 */
export function safeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const check = validateUrl(raw);
  if (!check.ok) return null;
  return normalizeUrl(check.url);
}
