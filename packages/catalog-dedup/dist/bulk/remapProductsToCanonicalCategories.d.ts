import type { PrismaClient } from "@prisma/client";
export type RemapProductsToCanonicalCategoriesResult = {
    dryRun: boolean;
    productsRemapped: number;
};
/** Phase 6 — STAGING → CANONICAL backfill for existing products. */
export declare function remapProductsToCanonicalCategories(_prisma: PrismaClient, _options?: {
    dryRun?: boolean;
}): Promise<RemapProductsToCanonicalCategoriesResult>;
//# sourceMappingURL=remapProductsToCanonicalCategories.d.ts.map