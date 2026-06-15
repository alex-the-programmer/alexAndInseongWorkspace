import type { CatalogDedupIngestPrisma } from "../types/prisma.js";

/** Phase 3 — stable listing identity via (sellerId, retailerSku). */
export type FindOrCreateSellerProductParams = {
  sellerId: bigint;
  productId: bigint;
  retailerSku: string;
};

export async function findOrCreateSellerProduct(
  _prisma: CatalogDedupIngestPrisma,
  _params: FindOrCreateSellerProductParams
): Promise<never> {
  throw new Error("findOrCreateSellerProduct is not implemented until ALE-78 Phase 3");
}
