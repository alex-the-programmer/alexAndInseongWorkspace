import type { PrismaClient } from "@prisma/client";
import type { ProductDedupRuntimeConfig } from "../core/config.js";
import executeProductMerge, {
  loadProductMergeStats,
  pickCanonicalProduct,
  resolveActiveProductId,
} from "./mergeProduct.js";
import { loadDedupBrandBuckets } from "./loadDedupBrandBuckets.js";
import { estimatePairwiseEdgesForBrand } from "./estimatePairwiseEdges.js";
import { buildComponentsFromEdges } from "../core/groupDuplicates.js";

export type MergeProductDedupClustersResult = {
  brandBuckets: number;
  componentsSeen: number;
  componentsMerged: number;
  productsMerged: number;
  dryRun: boolean;
};

export async function mergeProductDedupClusters(
  prisma: PrismaClient,
  options: {
    dryRun?: boolean;
    limitComponents?: number;
    limitMerges?: number;
    config: ProductDedupRuntimeConfig;
    onProgress?: (message: string) => void;
  }
): Promise<MergeProductDedupClustersResult> {
  const { dryRun = false, limitComponents, limitMerges, config, onProgress } = options;
  const log = onProgress ?? (() => {});

  const brandBuckets = await loadDedupBrandBuckets(prisma);
  const activeIdCache = new Map<string, bigint>();
  const resolveActive = async (productId: bigint) => {
    const key = productId.toString();
    const cached = activeIdCache.get(key);
    if (cached !== undefined) return cached;
    const active = await resolveActiveProductId(prisma, productId);
    activeIdCache.set(key, active);
    return active;
  };

  let componentsSeen = 0;
  let componentsMerged = 0;
  let productsMerged = 0;

  for (const bucket of brandBuckets) {
    const { edges } = estimatePairwiseEdgesForBrand({
      products: bucket.products,
      sellerNamesById: new Map(),
      minOverlap: config.minTokenOverlap,
      maxCounterpartsPerProduct: config.maxCounterpartsPerProduct,
    });
    const components = buildComponentsFromEdges(edges);

    for (const component of components) {
      componentsSeen++;
      if (limitComponents !== undefined && componentsMerged >= limitComponents) {
        return {
          brandBuckets: brandBuckets.length,
          componentsSeen,
          componentsMerged,
          productsMerged,
          dryRun,
        };
      }

      const activeIds = new Set<bigint>();
      for (const productId of component) {
        activeIds.add(await resolveActive(productId));
      }
      if (activeIds.size < 2) continue;

      const members = await loadProductMergeStats(prisma, [...activeIds]);
      if (members.length < 2) continue;

      const root = pickCanonicalProduct(members);
      let mergedInComponent = 0;

      for (const member of members) {
        if (member.id === root.id) continue;
        if (limitMerges !== undefined && productsMerged >= limitMerges) {
          return {
            brandBuckets: brandBuckets.length,
            componentsSeen,
            componentsMerged,
            productsMerged,
            dryRun,
          };
        }

        if (dryRun) {
          log(
            `[dry-run] brand=${bucket.brandName} merge ${member.id} -> ${root.id} (sellers=${member.sellerProductCount}->${root.sellerProductCount})`
          );
        } else {
          await executeProductMerge(prisma, {
            primaryProductId: root.id,
            secondaryProductId: member.id,
          });
          if (productsMerged > 0 && productsMerged % 100 === 0) {
            log(`merged ${productsMerged} products so far...`);
          }
        }

        productsMerged++;
        mergedInComponent++;
      }

      if (mergedInComponent > 0) {
        componentsMerged++;
      }
    }
  }

  return {
    brandBuckets: brandBuckets.length,
    componentsSeen,
    componentsMerged,
    productsMerged,
    dryRun,
  };
}
