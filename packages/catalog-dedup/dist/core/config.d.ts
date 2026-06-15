import type { PrismaClient } from "@prisma/client";
import { UNKNOWN_BRAND_NAME } from "./brandNormalize.js";
export { UNKNOWN_BRAND_NAME };
export declare const OLIVE_YOUNG_GLOBAL_NAME = "Olive Young Global";
export type DedupSeller = {
    id: bigint;
    name: string;
};
export type ProductDedupRuntimeConfig = {
    minTokenOverlap: number;
    maxCounterpartsPerProduct: number;
};
export declare function readProductDedupConfig(): ProductDedupRuntimeConfig;
/** All sellers with at least one listing on an active (non-tombstone) product. */
export declare function getDedupSellers(prisma: PrismaClient): Promise<DedupSeller[]>;
//# sourceMappingURL=config.d.ts.map