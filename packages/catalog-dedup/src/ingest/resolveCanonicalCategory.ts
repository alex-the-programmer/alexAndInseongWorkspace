import type { CatalogDedupIngestPrisma } from "../types/prisma.js";

/** Phase 6 — seller_category_mappings → CANONICAL leaf. */
export async function resolveCanonicalCategory(
  _prisma: CatalogDedupIngestPrisma,
  _sellerCategoryId: bigint | null
): Promise<never> {
  throw new Error("resolveCanonicalCategory is not implemented until ALE-78 Phase 6");
}
