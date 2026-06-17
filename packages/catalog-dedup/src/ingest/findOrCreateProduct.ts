import { isUnknownBrandName } from "../core/brandNormalize.js";
import { readProductDedupConfig } from "../core/config.js";
import { isBlockedPair } from "../core/productNameBlocking.js";
import { canonicalProductBaseName } from "../core/productNameNormalize.js";
import type { CatalogDedupIngestPrisma, CatalogDedupProduct } from "../types/prisma.js";
import { resolveActiveProduct } from "./resolveActiveProduct.js";

export type FindOrCreateProductParams = {
  brandId: bigint;
  brandName: string;
  sellerId: bigint;
  name: string;
  retailerSku: string;
  categoryId: bigint;
};

export async function findOrCreateProduct(
  prisma: CatalogDedupIngestPrisma,
  params: FindOrCreateProductParams
): Promise<CatalogDedupProduct> {
  const { brandId, brandName, sellerId, name, retailerSku, categoryId } = params;
  const baseName = canonicalProductBaseName(name, brandName);
  const sku = retailerSku.trim();
  if (!sku) {
    throw new Error("findOrCreateProduct requires a non-empty retailerSku");
  }

  const byListing = await prisma.sellerProduct.findFirst({
    where: { sellerId, retailerSku: sku },
    include: { product: true },
  });
  if (byListing?.product) {
    return resolveActiveProduct(prisma, byListing.product);
  }

  const legacy = await prisma.product.findFirst({
    where: { sku },
  });
  if (legacy) {
    const sameSellerListing = await prisma.sellerProduct.findFirst({
      where: { sellerId, productId: legacy.id },
    });
    if (sameSellerListing) {
      return resolveActiveProduct(prisma, legacy);
    }
  }

  if (!isUnknownBrandName(brandName) && baseName.trim()) {
    const { minTokenOverlap, maxCounterpartsPerProduct } = readProductDedupConfig();
    const normalizedBase = baseName.toLowerCase();

    const exactCandidates = await prisma.product.findMany({
      where: {
        brandId,
        mergedIntoProductId: null,
        sellerProducts: { some: {} },
      },
      select: {
        id: true,
        name: true,
        brandId: true,
        categoryId: true,
        sku: true,
        mergedIntoProductId: true,
      },
      take: maxCounterpartsPerProduct,
      orderBy: { id: "asc" },
    });

    for (const candidate of exactCandidates) {
      if (canonicalProductBaseName(candidate.name, brandName).toLowerCase() === normalizedBase) {
        return candidate;
      }
    }

    const candidates = await prisma.product.findMany({
      where: {
        brandId,
        mergedIntoProductId: null,
        sellerProducts: {
          some: {
            sellerId: { not: sellerId },
          },
        },
      },
      select: {
        id: true,
        name: true,
        brandId: true,
        categoryId: true,
        sku: true,
        mergedIntoProductId: true,
      },
      take: maxCounterpartsPerProduct,
      orderBy: { id: "asc" },
    });

    for (const candidate of candidates) {
      if (isBlockedPair(baseName, candidate.name, minTokenOverlap, { brandA: brandName, brandB: brandName })) {
        return candidate;
      }
    }
  }

  return prisma.product.create({
    data: {
      name: baseName,
      brandId,
      categoryId,
    },
  });
}
