import type { PrismaClient } from "@prisma/client";
import type { ProductDedupRuntimeConfig } from "../core/config.js";
export type MergeProductDedupClustersResult = {
    brandBuckets: number;
    componentsSeen: number;
    componentsMerged: number;
    productsMerged: number;
    dryRun: boolean;
};
export declare function mergeProductDedupClusters(prisma: PrismaClient, options: {
    dryRun?: boolean;
    limitComponents?: number;
    limitMerges?: number;
    config: ProductDedupRuntimeConfig;
    onProgress?: (message: string) => void;
}): Promise<MergeProductDedupClustersResult>;
//# sourceMappingURL=mergeProductDedupClusters.d.ts.map