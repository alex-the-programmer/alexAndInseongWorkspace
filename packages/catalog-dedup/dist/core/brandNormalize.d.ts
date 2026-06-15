export declare const UNKNOWN_BRAND_NAME = "Unknown brand";
/** v1: trim, collapse whitespace, lowercase — used as duplicate-group key. */
export declare function normalizeBrandName(name: string): string;
/** v2: lowercase letters, digits, and Hangul only — catches spacing/punctuation variants. */
export declare function normalizeBrandNameAggressive(name: string): string;
export declare function isUnknownBrandName(name: string): boolean;
//# sourceMappingURL=brandNormalize.d.ts.map