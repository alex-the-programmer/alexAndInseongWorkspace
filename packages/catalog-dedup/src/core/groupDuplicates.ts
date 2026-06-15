import { normalizeBrandName, normalizeBrandNameAggressive } from "./brandNormalize.js";
import {
  classifyDuplicateGroup,
  pickCanonicalBrand,
  pickDisplayBrandName,
} from "./pickCanonical.js";
import type { BrandDedupMode, BrandWithProductCount, DuplicateBrandGroup } from "./types.js";

export class UnionFind {
  private parent = new Map<string, string>();
  private rank = new Map<string, number>();

  add(id: string): void {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
      this.rank.set(id, 0);
    }
  }

  find(id: string): string {
    const parent = this.parent.get(id);
    if (parent === undefined) {
      this.add(id);
      return id;
    }
    if (parent !== id) {
      const root = this.find(parent);
      this.parent.set(id, root);
      return root;
    }
    return id;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return;

    const rankA = this.rank.get(rootA) ?? 0;
    const rankB = this.rank.get(rootB) ?? 0;
    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
  }

  components(): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      const bucket = groups.get(root) ?? [];
      bucket.push(id);
      groups.set(root, bucket);
    }
    return groups;
  }
}

export function sellerPairKey(sellerIdA: bigint, sellerIdB: bigint): string {
  const a = sellerIdA < sellerIdB ? sellerIdA : sellerIdB;
  const b = sellerIdA < sellerIdB ? sellerIdB : sellerIdA;
  return `${a}:${b}`;
}

export function buildComponentsFromEdges(edges: Array<[bigint, bigint]>): bigint[][] {
  const unionFind = new UnionFind();
  for (const [productA, productB] of edges) {
    unionFind.add(productA.toString());
    unionFind.add(productB.toString());
    unionFind.union(productA.toString(), productB.toString());
  }

  return [...unionFind.components().values()]
    .filter((ids) => ids.length >= 2)
    .map((ids) => ids.map((id) => BigInt(id)));
}

function groupDuplicateBrandsV1(brands: BrandWithProductCount[]): DuplicateBrandGroup[] {
  const byNormalized = new Map<string, BrandWithProductCount[]>();

  for (const brand of brands) {
    const key = normalizeBrandName(brand.name);
    const bucket = byNormalized.get(key) ?? [];
    bucket.push(brand);
    byNormalized.set(key, bucket);
  }

  const groups: DuplicateBrandGroup[] = [];
  for (const [normalizedName, members] of byNormalized) {
    if (members.length <= 1) continue;
    groups.push({
      normalizedName,
      members,
      kind: classifyDuplicateGroup(members),
      totalProducts: members.reduce((sum, m) => sum + m.productCount, 0),
    });
  }

  return groups.sort((a, b) => b.totalProducts - a.totalProducts || a.normalizedName.localeCompare(b.normalizedName));
}

export function classifyAggressiveDuplicateGroup(
  members: BrandWithProductCount[]
): DuplicateBrandGroup["kind"] {
  const v1Keys = new Set(members.map((m) => normalizeBrandName(m.name)));
  if (v1Keys.size === 1) return classifyDuplicateGroup(members);
  return "punctuation_spacing";
}

export function groupDuplicateBrandsAggressive(brands: BrandWithProductCount[]): DuplicateBrandGroup[] {
  const byAggressive = new Map<string, BrandWithProductCount[]>();

  for (const brand of brands) {
    const key = normalizeBrandNameAggressive(brand.name);
    if (!key) continue;
    const bucket = byAggressive.get(key) ?? [];
    bucket.push(brand);
    byAggressive.set(key, bucket);
  }

  const groups: DuplicateBrandGroup[] = [];
  for (const [normalizedName, members] of byAggressive) {
    if (members.length <= 1) continue;
    groups.push({
      normalizedName,
      members,
      kind: classifyAggressiveDuplicateGroup(members),
      totalProducts: members.reduce((sum, m) => sum + m.productCount, 0),
    });
  }

  return groups.sort((a, b) => b.totalProducts - a.totalProducts || a.normalizedName.localeCompare(b.normalizedName));
}

export function groupDuplicateBrands(
  brands: BrandWithProductCount[],
  mode: BrandDedupMode = "v1"
): DuplicateBrandGroup[] {
  return mode === "v2" ? groupDuplicateBrandsAggressive(brands) : groupDuplicateBrandsV1(brands);
}

export { pickCanonicalBrand, pickDisplayBrandName };
