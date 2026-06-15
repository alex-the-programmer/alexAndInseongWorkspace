import type { CatalogDedupIngestPrisma, CatalogDedupProduct } from "../types/prisma.js";
export type FindOrCreateProductParams = {
    brandId: bigint;
    brandName: string;
    sellerId: bigint;
    name: string;
    retailerSku: string;
    categoryId: bigint;
};
export declare function findOrCreateProduct(prisma: CatalogDedupIngestPrisma, params: FindOrCreateProductParams): Promise<CatalogDedupProduct>;
//# sourceMappingURL=findOrCreateProduct.d.ts.map