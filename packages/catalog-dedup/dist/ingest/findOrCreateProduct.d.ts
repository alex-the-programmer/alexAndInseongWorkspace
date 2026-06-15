import type { CatalogDedupIngestPrisma } from "../types/prisma.js";
/** Phase 3 — cross-seller product matching at ingest. */
export type FindOrCreateProductParams = {
    brandId: bigint;
    sellerId: bigint;
    name: string;
    retailerSku: string;
    categoryId: bigint;
};
export declare function findOrCreateProduct(_prisma: CatalogDedupIngestPrisma, _params: FindOrCreateProductParams): Promise<never>;
//# sourceMappingURL=findOrCreateProduct.d.ts.map