/** Follow mergedIntoProductId chain to the active canonical product row. */
export async function resolveActiveProduct(prisma, product) {
    let current = product;
    const visited = new Set();
    for (let depth = 0; depth < 20; depth++) {
        if (!current.mergedIntoProductId)
            return current;
        const key = current.id.toString();
        if (visited.has(key)) {
            throw new Error(`resolveActiveProduct: merge cycle at product ${product.id}`);
        }
        visited.add(key);
        const next = await prisma.product.findUnique({
            where: { id: current.mergedIntoProductId },
            select: {
                id: true,
                name: true,
                brandId: true,
                categoryId: true,
                sku: true,
                mergedIntoProductId: true,
            },
        });
        if (!next)
            return current;
        current = next;
    }
    throw new Error(`resolveActiveProduct: merge chain too deep for product ${product.id}`);
}
//# sourceMappingURL=resolveActiveProduct.js.map