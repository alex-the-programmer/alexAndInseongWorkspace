import type { PrismaClient } from "@prisma/client";
import {
  getDedupSellers,
  OLIVE_YOUNG_GLOBAL_NAME,
  readProductDedupConfig,
} from "../core/config.js";
import { estimatePairwiseEdges } from "./estimatePairwiseEdges.js";
import { loadDedupBrandBuckets } from "./loadDedupBrandBuckets.js";

export type ProductDedupPairwiseCostReport = {
  generatedAt: string;
  minTokenOverlap: number;
  maxCounterpartsPerProduct: number;
  sellerCount: number;
  sellers: Array<{ id: string; name: string; activeListingCount: number }>;
  totals: {
    brandBuckets: number;
    estimatedEdges: number;
    multiProductComponents: number;
    productsInComponents: number;
    productsWouldTombstone: number;
    threePlusSellerComponents: number;
    oyAbsentThreePlusSellerComponents: number;
    oyAbsentThreePlusSellerComponentPct: number;
  };
  topSellerPairs: Array<{
    sellerA: string;
    sellerB: string;
    overlappingBrands: number;
    estimatedEdges: number;
  }>;
  oyAbsentClusterSamples: Array<{
    brandName: string;
    productCount: number;
    sellerCount: number;
    sellerNames: string[];
    sampleProductNames: string[];
  }>;
};

export async function auditProductDuplicates(
  prisma: PrismaClient
): Promise<ProductDedupPairwiseCostReport> {
  const { minTokenOverlap, maxCounterpartsPerProduct } = readProductDedupConfig();

  const sellers = await getDedupSellers(prisma);
  const sellerNamesById = new Map(sellers.map((s) => [s.id.toString(), s.name]));
  const oliveYoungSeller = sellers.find((s) => s.name === OLIVE_YOUNG_GLOBAL_NAME);

  const listingCounts = await prisma.sellerProduct.groupBy({
    by: ["sellerId"],
    where: { product: { mergedIntoProductId: null } },
    _count: true,
  });
  const listingCountBySeller = new Map(
    listingCounts.map((row) => [row.sellerId.toString(), row._count])
  );

  const brandBuckets = await loadDedupBrandBuckets(prisma);

  const estimate = estimatePairwiseEdges({
    brandBuckets,
    sellerNamesById,
    oliveYoungSellerId: oliveYoungSeller?.id ?? null,
    minOverlap: minTokenOverlap,
    maxCounterpartsPerProduct,
  });

  const topSellerPairs = [...estimate.sellerPairCounts.values()]
    .sort((a, b) => b.estimatedEdges - a.estimatedEdges || a.sellerNameA.localeCompare(b.sellerNameA))
    .slice(0, 25)
    .map((row) => ({
      sellerA: row.sellerNameA,
      sellerB: row.sellerNameB,
      overlappingBrands: row.overlappingBrands,
      estimatedEdges: row.estimatedEdges,
    }));

  return {
    generatedAt: new Date().toISOString(),
    minTokenOverlap,
    maxCounterpartsPerProduct,
    sellerCount: sellers.length,
    sellers: sellers.map((s) => ({
      id: s.id.toString(),
      name: s.name,
      activeListingCount: listingCountBySeller.get(s.id.toString()) ?? 0,
    })),
    totals: estimate.totals,
    topSellerPairs,
    oyAbsentClusterSamples: estimate.oyAbsentClusterSamples,
  };
}
