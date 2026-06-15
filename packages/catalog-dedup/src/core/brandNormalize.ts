export const UNKNOWN_BRAND_NAME = "Unknown brand";

/** v1: trim, collapse whitespace, lowercase — used as duplicate-group key. */
export function normalizeBrandName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** v2: lowercase letters, digits, and Hangul only — catches spacing/punctuation variants. */
export function normalizeBrandNameAggressive(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

export function isUnknownBrandName(name: string): boolean {
  return normalizeBrandName(name) === normalizeBrandName(UNKNOWN_BRAND_NAME);
}
