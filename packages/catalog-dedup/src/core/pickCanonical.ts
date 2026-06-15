import type { BrandWithProductCount, ProductMergeStats } from "./types.js";

export function casingScore(name: string): number {
  let score = 0;
  for (const ch of name) {
    if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) score += 1;
  }
  return score;
}

export function classifyDuplicateGroup(members: BrandWithProductCount[]): "verbatim" | "case_only" | "whitespace" {
  const rawNames = new Set(members.map((m) => m.name));
  if (rawNames.size === 1) return "verbatim";
  const lowered = new Set(members.map((m) => m.name.toLowerCase()));
  if (lowered.size === 1) return "case_only";
  return "whitespace";
}

export function pickCanonicalBrand(members: BrandWithProductCount[]): BrandWithProductCount {
  return [...members].sort((a, b) => {
    if (b.productCount !== a.productCount) return b.productCount - a.productCount;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  })[0]!;
}

export function pickDisplayBrandName(members: BrandWithProductCount[], canonical: BrandWithProductCount): string {
  const spellingCounts = new Map<string, number>();
  for (const member of members) {
    spellingCounts.set(member.name, (spellingCounts.get(member.name) ?? 0) + 1);
  }

  let bestName = canonical.name;
  let bestCount = spellingCounts.get(bestName) ?? 0;
  let bestCasing = casingScore(bestName);

  for (const [name, count] of spellingCounts) {
    const nameCasing = casingScore(name);
    if (
      count > bestCount ||
      (count === bestCount && nameCasing > bestCasing) ||
      (count === bestCount && nameCasing === bestCasing && name.localeCompare(bestName) < 0)
    ) {
      bestName = name;
      bestCount = count;
      bestCasing = nameCasing;
    }
  }

  return bestName;
}

export function pickCanonicalProduct(members: ProductMergeStats[]): ProductMergeStats {
  return [...members].sort((a, b) => {
    if (b.sellerProductCount !== a.sellerProductCount) {
      return b.sellerProductCount - a.sellerProductCount;
    }
    const taxonomyA = a.specCount;
    const taxonomyB = b.specCount;
    if (taxonomyB !== taxonomyA) return taxonomyB - taxonomyA;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  })[0]!;
}

export function orderUndirectedPair(productA: bigint, productB: bigint): [bigint, bigint] {
  return productA < productB ? [productA, productB] : [productB, productA];
}
