import type { PrismaClient } from "@prisma/client";
import type { ProductMergeStats } from "../core/types.js";
import { pickCanonicalProduct } from "../core/pickCanonical.js";
export declare function resolveActiveProductId(prisma: PrismaClient, productId: bigint): Promise<bigint>;
export declare function loadProductMergeStats(prisma: PrismaClient, productIds: bigint[]): Promise<ProductMergeStats[]>;
/**
 * Merge duplicate `secondary` Product into canonical `primary`.
 * Keeps the secondary row as a tombstone (`mergedIntoProductId`) so scrapers can resolve by SKU.
 * Phase 5 replaces this with hard-delete once `seller_products.retailerSku` ingest ships.
 */
export default function executeProductMerge(prisma: PrismaClient, params: {
    primaryProductId: bigint;
    secondaryProductId: bigint;
}): Promise<void>;
export { pickCanonicalProduct };
//# sourceMappingURL=mergeProduct.d.ts.map