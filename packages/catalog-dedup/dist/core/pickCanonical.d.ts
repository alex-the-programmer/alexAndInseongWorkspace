import type { BrandWithProductCount, ProductMergeStats } from "./types.js";
export declare function casingScore(name: string): number;
export declare function classifyDuplicateGroup(members: BrandWithProductCount[]): "verbatim" | "case_only" | "whitespace";
export declare function pickCanonicalBrand(members: BrandWithProductCount[]): BrandWithProductCount;
export declare function pickDisplayBrandName(members: BrandWithProductCount[], canonical: BrandWithProductCount): string;
export declare function pickCanonicalProduct(members: ProductMergeStats[]): ProductMergeStats;
export declare function orderUndirectedPair(productA: bigint, productB: bigint): [bigint, bigint];
//# sourceMappingURL=pickCanonical.d.ts.map