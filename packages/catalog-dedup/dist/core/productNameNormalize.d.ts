/** Decode common HTML entities in scraped listing titles. */
export declare function decodeHtmlEntities(name: string): string;
export declare function collapseWhitespace(name: string): string;
/** True when a leading `[tag]` segment is retailer promo noise (not channel/collab labels). */
export declare function isPromoBracketTag(tag: string): boolean;
/** Remove leading promo bracket tags and asterisk markers allowed by `isPromoBracketTag`. */
export declare function stripPromotionalPrefixes(name: string): string;
/** Remove one leading seller-provided brand string from the title. */
export declare function stripSellerBrandPrefix(name: string, sellerBrandName: string): string;
/** Full title cleanup for storage and matching (promo prefixes, then seller brand). */
export declare function normalizeProductTitle(name: string, sellerBrandName?: string): string;
/** Base product-line title (promo/brand/pack stripped) for `products.name`. */
export declare function canonicalProductBaseName(name: string, sellerBrandName?: string): string;
/** Lowercase form used for dedup equality and blocking comparisons. */
export declare function normalizeProductNameForDedup(name: string, sellerBrandName?: string): string;
//# sourceMappingURL=productNameNormalize.d.ts.map