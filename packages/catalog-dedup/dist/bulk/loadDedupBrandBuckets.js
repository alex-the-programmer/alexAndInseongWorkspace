import { UNKNOWN_BRAND_NAME } from "../core/config.js";
export async function loadDedupBrandBuckets(prisma) {
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
    const brandMap = new Map();
    for (const product of products) {
        const brandKey = product.brandId.toString();
        const bucket = brandMap.get(brandKey) ??
            {
                brandId: product.brandId,
                brandName: product.brand.name,
                products: [],
            };
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
//# sourceMappingURL=loadDedupBrandBuckets.js.map