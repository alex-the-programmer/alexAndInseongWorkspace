export type BlockedPairOptions = {
    brandA?: string;
    brandB?: string;
};
/** Alphanumeric tokens of length >= 3 for loose name blocking (same brand). */
export declare function significantTokens(name: string): Set<string>;
export declare function tokenOverlapCount(a: string, b: string): number;
export declare function isBlockedPair(nameA: string, nameB: string, minOverlap: number, options?: BlockedPairOptions): boolean;
//# sourceMappingURL=productNameBlocking.d.ts.map