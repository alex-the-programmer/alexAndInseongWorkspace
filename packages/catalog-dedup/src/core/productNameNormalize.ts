import { isUnknownBrandName, normalizeBrandName } from "./brandNormalize.js";

const SELLER_BRAND_STRIP_DENYLIST = new Set(
  ["💗bogo", "bogo", "k-pop", "kpop", "daiso", "md"].map((s) => s.toLowerCase())
);

/** Decode common HTML entities in scraped listing titles. */
export function decodeHtmlEntities(name: string): string {
  return name
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function collapseWhitespace(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeTagText(tag: string): string {
  return tag.trim().replace(/\s+/g, " ").toLowerCase();
}

/** True when a leading `[tag]` segment is retailer promo noise (not channel/collab labels). */
export function isPromoBracketTag(tag: string): boolean {
  const t = normalizeTagText(tag);
  if (!t) return false;

  if (/\bbogo\b/i.test(tag)) return true;
  if (t === "new" || t === "sale" || t === "gift" || t === "hot" || t === "best") return true;
  if (t === "bundle" || t === "limited" || t === "set") return true;
  if (t.includes("time deal")) return true;
  if (t === "oy exclusive" || t === "tk only") return true;
  if (t === "stylekorean") return true;
  if (/^\d+\s*\+\s*\d+/.test(t)) return true;
  if (/^\d+\s*\+\s*\d+\s*set$/i.test(t)) return true;

  return false;
}

const LEADING_BRACKET_SEGMENT = /^\s*\[([^\]]+)\]\s*/;

function stripLeadingBarePromoWord(name: string): string {
  const match = name.match(/^(bogo|new|sale|gift|hot|best|limited)\s+/i);
  if (!match) return name;
  const rest = name.slice(match[0].length);
  if (!rest || !/[A-Za-z0-9\uac00-\ud7af]/.test(rest[0]!)) return name;
  return rest;
}

/** Remove leading promo bracket tags and asterisk markers allowed by `isPromoBracketTag`. */
export function stripPromotionalPrefixes(name: string): string {
  let result = name;

  for (;;) {
    const bracket = result.match(LEADING_BRACKET_SEGMENT);
    if (!bracket || !isPromoBracketTag(bracket[1]!)) break;
    result = result.slice(bracket[0].length);
  }

  for (;;) {
    const star = result.match(/^\s*\*([^*]+)\*\s*/);
    if (!star) break;
    const inner = normalizeTagText(star[1]!);
    if (!["new", "sale", "hot", "best", "gift", "limited"].includes(inner)) break;
    result = result.slice(star[0].length);
  }

  result = stripLeadingBarePromoWord(result);
  return result;
}

function isSellerBrandStripDenied(brandName: string): boolean {
  if (isUnknownBrandName(brandName)) return true;
  const key = normalizeBrandName(brandName);
  return SELLER_BRAND_STRIP_DENYLIST.has(key);
}

function hasBrandPrefixBoundary(rest: string): boolean {
  if (!rest) return true;
  return /^[\s\-|·,:]/.test(rest);
}

/** Remove one leading seller-provided brand string from the title. */
export function stripSellerBrandPrefix(name: string, sellerBrandName: string): string {
  const brand = sellerBrandName.trim();
  if (!brand || isSellerBrandStripDenied(brand)) return name;

  const nameLower = name.toLowerCase();
  const brandLower = brand.toLowerCase();
  if (!nameLower.startsWith(brandLower)) return name;

  const rest = name.slice(brand.length);
  if (!hasBrandPrefixBoundary(rest)) return name;

  const stripped = rest.replace(/^[\s\-|·,:]+/, "");
  return stripped.length > 0 ? stripped : name;
}

/** Full title cleanup for storage and matching (promo prefixes, then seller brand). */
export function normalizeProductTitle(name: string, sellerBrandName = ""): string {
  let result = collapseWhitespace(decodeHtmlEntities(name));
  result = stripPromotionalPrefixes(result);
  result = stripSellerBrandPrefix(result, sellerBrandName);
  return collapseWhitespace(result);
}

/** Lowercase form used for dedup equality and blocking comparisons. */
export function normalizeProductNameForDedup(name: string, sellerBrandName = ""): string {
  return normalizeProductTitle(name, sellerBrandName).toLowerCase();
}
