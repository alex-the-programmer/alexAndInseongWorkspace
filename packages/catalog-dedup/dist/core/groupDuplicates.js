import { normalizeBrandName, normalizeBrandNameAggressive } from "./brandNormalize.js";
import { classifyDuplicateGroup, pickCanonicalBrand, pickDisplayBrandName, } from "./pickCanonical.js";
export class UnionFind {
    parent = new Map();
    rank = new Map();
    add(id) {
        if (!this.parent.has(id)) {
            this.parent.set(id, id);
            this.rank.set(id, 0);
        }
    }
    find(id) {
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
    union(a, b) {
        const rootA = this.find(a);
        const rootB = this.find(b);
        if (rootA === rootB)
            return;
        const rankA = this.rank.get(rootA) ?? 0;
        const rankB = this.rank.get(rootB) ?? 0;
        if (rankA < rankB) {
            this.parent.set(rootA, rootB);
        }
        else if (rankA > rankB) {
            this.parent.set(rootB, rootA);
        }
        else {
            this.parent.set(rootB, rootA);
            this.rank.set(rootA, rankA + 1);
        }
    }
    components() {
        const groups = new Map();
        for (const id of this.parent.keys()) {
            const root = this.find(id);
            const bucket = groups.get(root) ?? [];
            bucket.push(id);
            groups.set(root, bucket);
        }
        return groups;
    }
}
export function sellerPairKey(sellerIdA, sellerIdB) {
    const a = sellerIdA < sellerIdB ? sellerIdA : sellerIdB;
    const b = sellerIdA < sellerIdB ? sellerIdB : sellerIdA;
    return `${a}:${b}`;
}
export function buildComponentsFromEdges(edges) {
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
function groupDuplicateBrandsV1(brands) {
    const byNormalized = new Map();
    for (const brand of brands) {
        const key = normalizeBrandName(brand.name);
        const bucket = byNormalized.get(key) ?? [];
        bucket.push(brand);
        byNormalized.set(key, bucket);
    }
    const groups = [];
    for (const [normalizedName, members] of byNormalized) {
        if (members.length <= 1)
            continue;
        groups.push({
            normalizedName,
            members,
            kind: classifyDuplicateGroup(members),
            totalProducts: members.reduce((sum, m) => sum + m.productCount, 0),
        });
    }
    return groups.sort((a, b) => b.totalProducts - a.totalProducts || a.normalizedName.localeCompare(b.normalizedName));
}
export function classifyAggressiveDuplicateGroup(members) {
    const v1Keys = new Set(members.map((m) => normalizeBrandName(m.name)));
    if (v1Keys.size === 1)
        return classifyDuplicateGroup(members);
    return "punctuation_spacing";
}
export function groupDuplicateBrandsAggressive(brands) {
    const byAggressive = new Map();
    for (const brand of brands) {
        const key = normalizeBrandNameAggressive(brand.name);
        if (!key)
            continue;
        const bucket = byAggressive.get(key) ?? [];
        bucket.push(brand);
        byAggressive.set(key, bucket);
    }
    const groups = [];
    for (const [normalizedName, members] of byAggressive) {
        if (members.length <= 1)
            continue;
        groups.push({
            normalizedName,
            members,
            kind: classifyAggressiveDuplicateGroup(members),
            totalProducts: members.reduce((sum, m) => sum + m.productCount, 0),
        });
    }
    return groups.sort((a, b) => b.totalProducts - a.totalProducts || a.normalizedName.localeCompare(b.normalizedName));
}
export function groupDuplicateBrands(brands, mode = "v1") {
    return mode === "v2" ? groupDuplicateBrandsAggressive(brands) : groupDuplicateBrandsV1(brands);
}
export { pickCanonicalBrand, pickDisplayBrandName };
//# sourceMappingURL=groupDuplicates.js.map