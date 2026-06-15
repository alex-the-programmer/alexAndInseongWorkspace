import type { PrismaClient } from "@prisma/client";
import { UNKNOWN_BRAND_NAME } from "../core/config.js";
import type { DedupBrandBucket, DedupProduct } from "../core/types.js";

export async function loadDedupBrandBuckets(prisma: PrismaClient): Promise<DedupBrandBucket[]> {
  const products = await prisma.product.findMany({
    where: {
      mergedIntoProductId: null,
      brand: { name: { not: UNKNOWN_BRAND_NAME } },
    },
    select: {
      id: true,
      name: true,
      brandId: true,
      brand: { select: { name: true } },
      sellerProducts: { select: { sellerId: true } },
    },
    orderBy: { id: "asc" },
  });

  const brandMap = new Map<string, DedupBrandBucket>();

  for (const product of products) {
    const brandKey = product.brandId.toString();
    const bucket =
      brandMap.get(brandKey) ??
      ({
        brandId: product.brandId,
        brandName: product.brand.name,
        products: [],
      } satisfies DedupBrandBucket);
    bucket.products.push({
      id: product.id,
      name: product.name,
      sellerIds: product.sellerProducts.map((sp) => sp.sellerId),
    });
    brandMap.set(brandKey, bucket);
  }

  return [...brandMap.values()].filter((bucket) => {
    const sellerIds = new Set(bucket.products.flatMap((p) => p.sellerIds.map((id) => id.toString())));
    return sellerIds.size >= 2;
  });
}

export type { DedupProduct };
