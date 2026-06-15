import type { PrismaClient } from "@prisma/client";
import type { ProductMergeStats } from "../core/types.js";
import { pickCanonicalProduct } from "../core/pickCanonical.js";
import repointProductForeignKeys from "./repointProductForeignKeys.js";

export async function resolveActiveProductId(prisma: PrismaClient, productId: bigint): Promise<bigint> {
  let id = productId;
  const visited = new Set<string>();

  for (let depth = 0; depth < 20; depth++) {
    const key = id.toString();
    if (visited.has(key)) {
      throw new Error(`resolveActiveProductId: merge cycle detected at product ${productId}`);
    }
    visited.add(key);

    const row = await prisma.product.findUnique({
      where: { id },
      select: { mergedIntoProductId: true },
    });
    if (!row?.mergedIntoProductId) return id;
    id = row.mergedIntoProductId;
  }

  throw new Error(`resolveActiveProductId: merge chain too deep for product ${productId}`);
}

export async function loadProductMergeStats(
  prisma: PrismaClient,
  productIds: bigint[]
): Promise<ProductMergeStats[]> {
  if (productIds.length === 0) return [];

  const rows = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      categoryId: true,
      _count: { select: { sellerProducts: true, productSellerSpecs: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    sellerProductCount: row._count.sellerProducts,
    categoryId: row.categoryId,
    specCount: row._count.productSellerSpecs,
  }));
}

/**
 * Merge duplicate `secondary` Product into canonical `primary`.
 * Keeps the secondary row as a tombstone (`mergedIntoProductId`) so scrapers can resolve by SKU.
 * Phase 5 replaces this with hard-delete once `seller_products.retailerSku` ingest ships.
 */
export default async function executeProductMerge(
  prisma: PrismaClient,
  params: { primaryProductId: bigint; secondaryProductId: bigint }
): Promise<void> {
  const { secondaryProductId } = params;
  const primaryProductId = await resolveActiveProductId(prisma, params.primaryProductId);

  if (primaryProductId === secondaryProductId) {
    throw new Error("executeProductMerge: primary and secondary must differ");
  }

  const [primary, secondary] = await Promise.all([
    prisma.product.findUnique({ where: { id: primaryProductId } }),
    prisma.product.findUnique({ where: { id: secondaryProductId } }),
  ]);
  if (!primary) throw new Error(`Primary product not found: ${primaryProductId}`);
  if (!secondary) throw new Error(`Secondary product not found: ${secondaryProductId}`);
  if (secondary.mergedIntoProductId) {
    throw new Error(`Secondary product ${secondaryProductId} is already a tombstone`);
  }

  await prisma.$transaction(async (tx) => {
    const tombstonesPointingAtSecondary = await tx.product.findMany({
      where: { mergedIntoProductId: secondaryProductId },
      select: { id: true },
    });

    await repointProductForeignKeys(tx, secondaryProductId, primaryProductId);

    for (const tombstone of tombstonesPointingAtSecondary) {
      await repointProductForeignKeys(tx, tombstone.id, primaryProductId);
    }

    await tx.product.update({
      where: { id: secondaryProductId },
      data: { mergedIntoProductId: primaryProductId },
    });

    await tx.product.updateMany({
      where: { mergedIntoProductId: secondaryProductId },
      data: { mergedIntoProductId: primaryProductId },
    });
  });
}

export { pickCanonicalProduct };
