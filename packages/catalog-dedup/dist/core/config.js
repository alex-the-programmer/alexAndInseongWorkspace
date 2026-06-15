import { UNKNOWN_BRAND_NAME } from "./brandNormalize.js";
export { UNKNOWN_BRAND_NAME };
export const OLIVE_YOUNG_GLOBAL_NAME = "Olive Young Global";
export function readProductDedupConfig() {
    return {
        minTokenOverlap: Number(process.env.PRODUCT_DEDUP_MIN_TOKEN_OVERLAP ?? "2") || 2,
        maxCounterpartsPerProduct: Number(process.env.PRODUCT_DEDUP_MAX_COUNTERPARTS_PER_PRODUCT ??
            process.env.PRODUCT_DEDUP_MAX_OY_PER_SK ??
            "25") || 25,
    };
}
/** All sellers with at least one listing on an active (non-tombstone) product. */
export async function getDedupSellers(prisma) {
    return prisma.seller.findMany({
        where: {
            sellerProducts: {
                some: { product: { mergedIntoProductId: null } },
            },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
    });
}
//# sourceMappingURL=config.js.map