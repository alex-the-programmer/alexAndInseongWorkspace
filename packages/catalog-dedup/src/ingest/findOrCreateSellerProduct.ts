import { PackUnit, type PackUnit as PackUnitType } from "../core/productPackSize.js";
import type { CatalogDedupIngestPrisma, CatalogDedupSellerProduct } from "../types/prisma.js";
import { isUniqueConstraintError } from "./isUniqueConstraintError.js";

export type FindOrCreateSellerProductParams = {
  sellerId: bigint;
  productId: bigint;
  retailerSku: string;
  packAmount?: number;
  packUnit?: PackUnitType;
  packCount?: number;
  listingTitle?: string | null;
};

function resolvePackFields(params: FindOrCreateSellerProductParams) {
  return {
    packAmount: params.packAmount ?? 0,
    packUnit: params.packUnit ?? PackUnit.UNKNOWN,
    packCount: params.packCount ?? 1,
    listingTitle: params.listingTitle ?? null,
  };
}

export async function findOrCreateSellerProduct(
  prisma: CatalogDedupIngestPrisma,
  params: FindOrCreateSellerProductParams
): Promise<CatalogDedupSellerProduct> {
  const { sellerId, productId, retailerSku } = params;
  const sku = retailerSku.trim();
  if (!sku) {
    throw new Error("findOrCreateSellerProduct requires a non-empty retailerSku");
  }

  const pack = resolvePackFields(params);

  const bySku = await prisma.sellerProduct.findFirst({
    where: { sellerId, retailerSku: sku },
  });
  if (bySku) return bySku;

  const byVariant = await prisma.sellerProduct.findFirst({
    where: {
      sellerId,
      productId,
      packAmount: pack.packAmount,
      packUnit: pack.packUnit,
      packCount: pack.packCount,
    },
  });
  if (byVariant) return byVariant;

  try {
    return await prisma.sellerProduct.create({
      data: {
        sellerId,
        productId,
        retailerSku: sku,
        ...pack,
      },
    });
  } catch (e) {
    if (!isUniqueConstraintError(e)) throw e;

    const retryBySku = await prisma.sellerProduct.findFirst({
      where: { sellerId, retailerSku: sku },
    });
    if (retryBySku) return retryBySku;

    const retryByVariant = await prisma.sellerProduct.findFirst({
      where: {
        sellerId,
        productId,
        packAmount: pack.packAmount,
        packUnit: pack.packUnit,
        packCount: pack.packCount,
      },
    });
    if (retryByVariant) return retryByVariant;

    throw e;
  }
}
