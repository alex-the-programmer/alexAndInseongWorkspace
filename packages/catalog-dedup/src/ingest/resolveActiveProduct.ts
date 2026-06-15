import type { CatalogDedupIngestPrisma, CatalogDedupProduct } from "../types/prisma.js";

/** Follow mergedIntoProductId chain to the active canonical product row. */
export async function resolveActiveProduct(
  prisma: CatalogDedupIngestPrisma,
  product: CatalogDedupProduct
): Promise<CatalogDedupProduct> {
  let current = product;
  const visited = new Set<string>();

  for (let depth = 0; depth < 20; depth++) {
    if (!current.mergedIntoProductId) return current;

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
    if (!next) return current;
    current = next as CatalogDedupProduct;
  }

  throw new Error(`resolveActiveProduct: merge chain too deep for product ${product.id}`);
}
