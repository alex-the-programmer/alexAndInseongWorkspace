import type { PrismaClient } from "@prisma/client";
export type ProductDedupPairwiseCostReport = {
    generatedAt: string;
    minTokenOverlap: number;
    maxCounterpartsPerProduct: number;
    sellerCount: number;
    sellers: Array<{
        id: string;
        name: string;
        activeListingCount: number;
    }>;
    totals: {
        brandBuckets: number;
        estimatedEdges: number;
        multiProductComponents: number;
        productsInComponents: number;
        productsWouldTombstone: number;
        threePlusSellerComponents: number;
        oyAbsentThreePlusSellerComponents: number;
        oyAbsentThreePlusSellerComponentPct: number;
    };
    topSellerPairs: Array<{
        sellerA: string;
        sellerB: string;
        overlappingBrands: number;
        estimatedEdges: number;
    }>;
    oyAbsentClusterSamples: Array<{
        brandName: string;
        productCount: number;
        sellerCount: number;
        sellerNames: string[];
        sampleProductNames: string[];
    }>;
};
export declare function auditProductDuplicates(prisma: PrismaClient): Promise<ProductDedupPairwiseCostReport>;
//# sourceMappingURL=auditProductDuplicates.d.ts.map