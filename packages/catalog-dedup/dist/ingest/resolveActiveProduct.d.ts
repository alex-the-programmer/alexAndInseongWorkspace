import type { CatalogDedupIngestPrisma, CatalogDedupProduct } from "../types/prisma.js";
/** Follow mergedIntoProductId chain to the active canonical product row. */
export declare function resolveActiveProduct(prisma: CatalogDedupIngestPrisma, product: CatalogDedupProduct): Promise<CatalogDedupProduct>;
//# sourceMappingURL=resolveActiveProduct.d.ts.map