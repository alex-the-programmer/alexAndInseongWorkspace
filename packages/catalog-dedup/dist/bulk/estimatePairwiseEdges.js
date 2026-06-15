import { isBlockedPair } from "../core/productNameBlocking.js";
import { buildComponentsFromEdges, sellerPairKey } from "../core/groupDuplicates.js";
function productsBySeller(products) {
    const bySeller = new Map();
    for (const product of products) {
        for (const sellerId of product.sellerIds) {
            const key = sellerId.toString();
            const bucket = bySeller.get(key) ?? [];
            bucket.push(product);
            bySeller.set(key, bucket);
        }
    }
    return bySeller;
}
function sellerIdsInComponent(productIds, productById) {
    const sellers = new Set();
    for (const productId of productIds) {
        const product = productById.get(productId);
        if (!product)
            continue;
        for (const sellerId of product.sellerIds) {
            sellers.add(sellerId.toString());
        }
    }
    return sellers;
}
export function estimatePairwiseEdgesForBrand(params) {
    const { products, minOverlap, maxCounterpartsPerProduct } = params;
    const bySeller = productsBySeller(products);
    const sellerIds = [...bySeller.keys()].map((id) => BigInt(id));
    const edges = [];
    const pairEdgeCounts = new Map();
    for (let i = 0; i < sellerIds.length; i++) {
        for (let j = i + 1; j < sellerIds.length; j++) {
            const sellerA = sellerIds[i];
            const sellerB = sellerIds[j];
            const productsA = bySeller.get(sellerA.toString()) ?? [];
            const productsB = bySeller.get(sellerB.toString()) ?? [];
            if (productsA.length === 0 || productsB.length === 0)
                continue;
            const pairKey = sellerPairKey(sellerA, sellerB);
            let pairEdges = 0;
            for (const productA of productsA) {
                const matches = productsB
                    .filter((productB) => productB.id !== productA.id &&
                    isBlockedPair(productA.name, productB.name, minOverlap))
                    .slice(0, maxCounterpartsPerProduct);
                for (const productB of matches) {
                    edges.push([productA.id, productB.id]);
                    pairEdges++;
                }
            }
            if (pairEdges > 0) {
                pairEdgeCounts.set(pairKey, (pairEdgeCounts.get(pairKey) ?? 0) + pairEdges);
            }
        }
    }
    return { edges, pairEdgeCounts };
}
export function estimatePairwiseEdges(params) {
    const { brandBuckets, sellerNamesById, oliveYoungSellerId, minOverlap, maxCounterpartsPerProduct, maxOyAbsentSamples = 20, } = params;
    const sellerPairCounts = new Map();
    const oyAbsentClusterSamples = [];
    let estimatedEdges = 0;
    let multiProductComponents = 0;
    let productsInComponents = 0;
    let productsWouldTombstone = 0;
    let threePlusSellerComponents = 0;
    let oyAbsentThreePlusSellerComponents = 0;
    const oySellerKey = oliveYoungSellerId?.toString() ?? null;
    for (const bucket of brandBuckets) {
        const { edges, pairEdgeCounts } = estimatePairwiseEdgesForBrand({
            products: bucket.products,
            sellerNamesById,
            minOverlap,
            maxCounterpartsPerProduct,
        });
        estimatedEdges += edges.length;
        for (const [pairKey, edgeCount] of pairEdgeCounts) {
            const [sellerIdAStr, sellerIdBStr] = pairKey.split(":");
            const sellerIdA = BigInt(sellerIdAStr);
            const sellerIdB = BigInt(sellerIdBStr);
            const existing = sellerPairCounts.get(pairKey);
            if (existing) {
                existing.overlappingBrands += 1;
                existing.estimatedEdges += edgeCount;
            }
            else {
                sellerPairCounts.set(pairKey, {
                    sellerIdA,
                    sellerIdB,
                    sellerNameA: sellerNamesById.get(sellerIdAStr) ?? sellerIdAStr,
                    sellerNameB: sellerNamesById.get(sellerIdBStr) ?? sellerIdBStr,
                    overlappingBrands: 1,
                    estimatedEdges: edgeCount,
                });
            }
        }
        const productById = new Map(bucket.products.map((p) => [p.id.toString(), p]));
        const components = buildComponentsFromEdges(edges);
        for (const productIds of components) {
            const ids = productIds.map((id) => id.toString());
            if (ids.length < 2)
                continue;
            const sellers = sellerIdsInComponent(ids, productById);
            const sellerCount = sellers.size;
            multiProductComponents += 1;
            productsInComponents += productIds.length;
            productsWouldTombstone += productIds.length - 1;
            if (sellerCount < 3)
                continue;
            threePlusSellerComponents += 1;
            const hasOy = oySellerKey !== null && sellers.has(oySellerKey);
            if (hasOy)
                continue;
            oyAbsentThreePlusSellerComponents += 1;
            if (oyAbsentClusterSamples.length >= maxOyAbsentSamples)
                continue;
            const sellerNames = [...sellers]
                .map((id) => sellerNamesById.get(id) ?? id)
                .sort((a, b) => a.localeCompare(b));
            const sampleProductNames = ids
                .map((id) => productById.get(id)?.name)
                .filter((name) => Boolean(name))
                .slice(0, 5);
            oyAbsentClusterSamples.push({
                brandName: bucket.brandName,
                productCount: productIds.length,
                sellerCount,
                sellerNames,
                sampleProductNames,
            });
        }
    }
    const oyAbsentThreePlusSellerComponentPct = threePlusSellerComponents === 0
        ? 0
        : (oyAbsentThreePlusSellerComponents / threePlusSellerComponents) * 100;
    return {
        sellerPairCounts,
        totals: {
            brandBuckets: brandBuckets.length,
            estimatedEdges,
            multiProductComponents,
            productsInComponents,
            productsWouldTombstone,
            threePlusSellerComponents,
            oyAbsentThreePlusSellerComponents,
            oyAbsentThreePlusSellerComponentPct,
        },
        oyAbsentClusterSamples,
    };
}
//# sourceMappingURL=estimatePairwiseEdges.js.map