import type { CatalogDedupIngestPrisma } from "../types/prisma.js";

/** Phase 3 — cross-seller product matching at ingest. */
export type FindOrCreateProductParams = {
  brandId: bigint;
  sellerId: bigint;
  name: string;
  retailerSku: string;
  categoryId: bigint;
};

export async function findOrCreateProduct(
  _prisma: CatalogDedupIngestPrisma,
  _params: FindOrCreateProductParams
): Promise<never> {
  throw new Error("findOrCreateProduct is not implemented until ALE-78 Phase 3");
}
