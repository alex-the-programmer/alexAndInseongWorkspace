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

type ResolvedPackFields = {
  packAmount: number;
  packUnit: PackUnitType;
  packCount: number;
  listingTitle: string | null;
};

function resolvePackFields(params: FindOrCreateSellerProductParams): ResolvedPackFields {
  return {
    packAmount: params.packAmount ?? 0,
    packUnit: params.packUnit ?? PackUnit.UNKNOWN,
    packCount: params.packCount ?? 1,
    listingTitle: params.listingTitle ?? null,
  };
}

function hasKnownPack(pack: Pick<ResolvedPackFields, "packAmount" | "packUnit">): boolean {
  return pack.packUnit !== PackUnit.UNKNOWN && pack.packAmount > 0;
}

function existingPackIsUnknown(
  row: Pick<CatalogDedupSellerProduct, "packAmount" | "packUnit">,
): boolean {
  const amount = row.packAmount ?? 0;
  const unit = row.packUnit ?? PackUnit.UNKNOWN;
  return unit === PackUnit.UNKNOWN || amount <= 0;
}

async function refreshSellerProductListingFields(
  prisma: CatalogDedupIngestPrisma,
  existing: CatalogDedupSellerProduct,
  pack: ResolvedPackFields,
): Promise<CatalogDedupSellerProduct> {
  const needsPackUpdate = existingPackIsUnknown(existing) && hasKnownPack(pack);
  const needsTitleUpdate =
    pack.listingTitle != null &&
    pack.listingTitle.trim() !== "" &&
    pack.listingTitle !== existing.listingTitle;

  if (!needsPackUpdate && !needsTitleUpdate) return existing;

  return prisma.sellerProduct.update({
    where: { id: existing.id },
    data: {
      ...(needsPackUpdate
        ? {
            packAmount: pack.packAmount,
            packUnit: pack.packUnit,
            packCount: pack.packCount,
          }
        : {}),
      ...(needsTitleUpdate ? { listingTitle: pack.listingTitle } : {}),
    },
  });
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
  if (bySku) return refreshSellerProductListingFields(prisma, bySku, pack);

  const byVariant = await prisma.sellerProduct.findFirst({
    where: {
      sellerId,
      productId,
      packAmount: pack.packAmount,
      packUnit: pack.packUnit,
      packCount: pack.packCount,
    },
  });
  if (byVariant) return refreshSellerProductListingFields(prisma, byVariant, pack);

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
    if (retryBySku) return refreshSellerProductListingFields(prisma, retryBySku, pack);

    const retryByVariant = await prisma.sellerProduct.findFirst({
      where: {
        sellerId,
        productId,
        packAmount: pack.packAmount,
        packUnit: pack.packUnit,
        packCount: pack.packCount,
      },
    });
    if (retryByVariant) return refreshSellerProductListingFields(prisma, retryByVariant, pack);

    throw e;
  }
}
