import { isUniqueConstraintError } from "./isUniqueConstraintError.js";
export async function findOrCreateSellerProduct(prisma, params) {
    const { sellerId, productId, retailerSku } = params;
    const sku = retailerSku.trim();
    if (!sku) {
        throw new Error("findOrCreateSellerProduct requires a non-empty retailerSku");
    }
    const existing = await prisma.sellerProduct.findFirst({
        where: { sellerId, retailerSku: sku },
    });
    if (existing)
        return existing;
    try {
        return await prisma.sellerProduct.upsert({
            where: {
                sellerId_productId: { sellerId, productId },
            },
            create: { sellerId, productId, retailerSku: sku },
            update: { retailerSku: sku },
        });
    }
    catch (e) {
        if (!isUniqueConstraintError(e))
            throw e;
        const retry = await prisma.sellerProduct.findFirst({
            where: { sellerId, retailerSku: sku },
        });
        if (retry)
            return retry;
        throw e;
    }
}
//# sourceMappingURL=findOrCreateSellerProduct.js.map