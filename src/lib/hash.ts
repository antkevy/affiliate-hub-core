// ============================================================
// Deterministic hashing & fingerprint helpers (shared)
// ============================================================

/**
 * Compute a SHA-256 hex digest of the input string using the Web Crypto API.
 * Falls back to a deterministic FNV-1a hash if SubtleCrypto is unavailable.
 */
export async function sha256(input: string): Promise<string> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const data = new TextEncoder().encode(input);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    // fall through to fnv fallback
  }
  return fnv1a64(input);
}

/**
 * Deterministic FNV-1a 64-bit hash (synchronous fallback when Web Crypto
 * is unavailable, e.g. in some test/SSR environments).
 */
export function fnv1a64(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const str = String(input);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    h1 ^= code;
    h2 = Math.imul(h2, 0x01000193);
    h1 = Math.imul(h1, 0x01000193);
    h1 ^= (h1 >>> 24) ^ (h2 >>> 13);
  }
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}
