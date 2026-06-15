import type { DedupProduct } from "../core/types.js";
export type SellerPairEdgeCount = {
    sellerIdA: bigint;
    sellerIdB: bigint;
    sellerNameA: string;
    sellerNameB: string;
    overlappingBrands: number;
    estimatedEdges: number;
};
export type OyAbsentClusterSample = {
    brandName: string;
    productCount: number;
    sellerCount: number;
    sellerNames: string[];
    sampleProductNames: string[];
};
export type PairwiseEstimateTotals = {
    brandBuckets: number;
    estimatedEdges: number;
    multiProductComponents: number;
    productsInComponents: number;
    productsWouldTombstone: number;
    threePlusSellerComponents: number;
    oyAbsentThreePlusSellerComponents: number;
    oyAbsentThreePlusSellerComponentPct: number;
};
export type PairwiseEstimateResult = {
    sellerPairCounts: Map<string, SellerPairEdgeCount>;
    totals: PairwiseEstimateTotals;
    oyAbsentClusterSamples: OyAbsentClusterSample[];
};
export declare function estimatePairwiseEdgesForBrand(params: {
    products: DedupProduct[];
    sellerNamesById: Map<string, string>;
    minOverlap: number;
    maxCounterpartsPerProduct: number;
}): {
    edges: Array<[bigint, bigint]>;
    pairEdgeCounts: Map<string, number>;
};
export declare function estimatePairwiseEdges(params: {
    brandBuckets: Array<{
        brandId: bigint;
        brandName: string;
        products: DedupProduct[];
    }>;
    sellerNamesById: Map<string, string>;
    oliveYoungSellerId: bigint | null;
    minOverlap: number;
    maxCounterpartsPerProduct: number;
    maxOyAbsentSamples?: number;
}): PairwiseEstimateResult;
//# sourceMappingURL=estimatePairwiseEdges.d.ts.map