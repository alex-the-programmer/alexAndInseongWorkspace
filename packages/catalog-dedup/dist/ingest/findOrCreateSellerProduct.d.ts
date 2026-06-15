import type { CatalogDedupIngestPrisma, CatalogDedupSellerProduct } from "../types/prisma.js";
export type FindOrCreateSellerProductParams = {
    sellerId: bigint;
    productId: bigint;
    retailerSku: string;
};
export declare function findOrCreateSellerProduct(prisma: CatalogDedupIngestPrisma, params: FindOrCreateSellerProductParams): Promise<CatalogDedupSellerProduct>;
//# sourceMappingURL=findOrCreateSellerProduct.d.ts.map