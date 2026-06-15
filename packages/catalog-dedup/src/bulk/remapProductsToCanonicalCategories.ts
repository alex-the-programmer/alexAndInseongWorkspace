import type { PrismaClient } from "@prisma/client";

export type RemapProductsToCanonicalCategoriesResult = {
  dryRun: boolean;
  productsRemapped: number;
};

/** Phase 6 — STAGING → CANONICAL backfill for existing products. */
export async function remapProductsToCanonicalCategories(
  _prisma: PrismaClient,
  _options: { dryRun?: boolean } = {}
): Promise<RemapProductsToCanonicalCategoriesResult> {
  throw new Error(
    "remapProductsToCanonicalCategories is not implemented until ALE-78 Phase 6"
  );
}
