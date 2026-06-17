import { type PackUnit as PackUnitType } from "../core/productPackSize.js";
import type { CatalogDedupIngestPrisma, CatalogDedupSellerProduct } from "../types/prisma.js";
export type FindOrCreateSellerProductParams = {
    sellerId: bigint;
    productId: bigint;
    retailerSku: string;
    packAmount?: number;
    packUnit?: PackUnitType;
    packCount?: number;
    listingTitle?: string | null;
};
export declare function findOrCreateSellerProduct(prisma: CatalogDedupIngestPrisma, params: FindOrCreateSellerProductParams): Promise<CatalogDedupSellerProduct>;
//# sourceMappingURL=findOrCreateSellerProduct.d.ts.map