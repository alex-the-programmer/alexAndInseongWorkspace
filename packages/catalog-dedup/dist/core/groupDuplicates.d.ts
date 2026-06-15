import { pickCanonicalBrand, pickDisplayBrandName } from "./pickCanonical.js";
import type { BrandDedupMode, BrandWithProductCount, DuplicateBrandGroup } from "./types.js";
export declare class UnionFind {
    private parent;
    private rank;
    add(id: string): void;
    find(id: string): string;
    union(a: string, b: string): void;
    components(): Map<string, string[]>;
}
export declare function sellerPairKey(sellerIdA: bigint, sellerIdB: bigint): string;
export declare function buildComponentsFromEdges(edges: Array<[bigint, bigint]>): bigint[][];
export declare function classifyAggressiveDuplicateGroup(members: BrandWithProductCount[]): DuplicateBrandGroup["kind"];
export declare function groupDuplicateBrandsAggressive(brands: BrandWithProductCount[]): DuplicateBrandGroup[];
export declare function groupDuplicateBrands(brands: BrandWithProductCount[], mode?: BrandDedupMode): DuplicateBrandGroup[];
export { pickCanonicalBrand, pickDisplayBrandName };
//# sourceMappingURL=groupDuplicates.d.ts.map