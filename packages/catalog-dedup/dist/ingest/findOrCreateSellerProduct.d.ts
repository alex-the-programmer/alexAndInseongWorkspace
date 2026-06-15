import type { CatalogDedupIngestPrisma } from "../types/prisma.js";
/** Phase 3 — stable listing identity via (sellerId, retailerSku). */
export type FindOrCreateSellerProductParams = {
    sellerId: bigint;
    productId: bigint;
    retailerSku: string;
};
export declare function findOrCreateSellerProduct(_prisma: CatalogDedupIngestPrisma, _params: FindOrCreateSellerProductParams): Promise<never>;
//# sourceMappingURL=findOrCreateSellerProduct.d.ts.map