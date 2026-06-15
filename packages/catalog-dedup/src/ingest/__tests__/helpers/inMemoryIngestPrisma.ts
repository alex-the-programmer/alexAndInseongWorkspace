import type {
  CatalogDedupIngestPrisma,
  CatalogDedupProduct,
  CatalogDedupSellerProduct,
} from "../../../types/prisma.js";

type SellerProductRow = CatalogDedupSellerProduct & {
  product?: CatalogDedupProduct;
};

/** Minimal in-memory Prisma double for ingest integration scenarios. */
export function createInMemoryIngestPrisma(): {
  prisma: CatalogDedupIngestPrisma;
  snapshot: () => {
    products: CatalogDedupProduct[];
    sellerProducts: SellerProductRow[];
  };
} {
  let nextProductId = 1n;
  let nextSellerProductId = 1n;
  const products = new Map<string, CatalogDedupProduct>();
  const sellerProducts: SellerProductRow[] = [];

  const prisma = {
    product: {
      findFirst: async ({ where }: { where: { sku?: string } }) => {
        if (!where.sku) return null;
        for (const p of products.values()) {
          if (p.sku === where.sku) return p;
        }
        return null;
      },
      findMany: async ({
        where,
        take,
        orderBy,
      }: {
        where: {
          brandId: bigint;
          mergedIntoProductId: null;
          sellerProducts?: { some: { sellerId: { not: bigint } } };
        };
        take?: number;
        orderBy?: { id: "asc" | "desc" };
      }) => {
        let rows = [...products.values()].filter(
          (p) => p.brandId === where.brandId && p.mergedIntoProductId === null,
        );
        if (where.sellerProducts?.some?.sellerId?.not !== undefined) {
          const excludeSeller = where.sellerProducts.some.sellerId.not;
          rows = rows.filter((p) =>
            sellerProducts.some(
              (sp) => sp.productId === p.id && sp.sellerId !== excludeSeller,
            ),
          );
        }
        if (orderBy?.id === "asc") {
          rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        }
        if (take !== undefined) rows = rows.slice(0, take);
        return rows.map((p) => ({
          id: p.id,
          name: p.name,
          brandId: p.brandId,
          categoryId: p.categoryId,
          sku: p.sku,
          mergedIntoProductId: p.mergedIntoProductId,
        }));
      },
      create: async ({
        data,
      }: {
        data: { name: string; brandId: bigint; categoryId: bigint; sku?: string | null };
      }) => {
        const row: CatalogDedupProduct = {
          id: nextProductId++,
          name: data.name,
          brandId: data.brandId,
          categoryId: data.categoryId,
          sku: data.sku ?? null,
          mergedIntoProductId: null,
        };
        products.set(row.id.toString(), row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: bigint } }) => {
        return products.get(where.id.toString()) ?? null;
      },
    },
    sellerProduct: {
      findFirst: async ({
        where,
        include,
      }: {
        where: {
          sellerId?: bigint;
          retailerSku?: string;
          productId?: bigint;
        };
        include?: { product?: boolean };
      }) => {
        const row = sellerProducts.find((sp) => {
          if (where.sellerId !== undefined && sp.sellerId !== where.sellerId) return false;
          if (where.retailerSku !== undefined && sp.retailerSku !== where.retailerSku) return false;
          if (where.productId !== undefined && sp.productId !== where.productId) return false;
          return true;
        });
        if (!row) return null;
        if (include?.product) {
          const product = products.get(row.productId.toString());
          return { ...row, product: product ?? undefined };
        }
        return row;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { sellerId_productId: { sellerId: bigint; productId: bigint } };
        create: { sellerId: bigint; productId: bigint; retailerSku: string };
        update: { retailerSku: string };
      }) => {
        const { sellerId, productId } = where.sellerId_productId;
        const existing = sellerProducts.find(
          (sp) => sp.sellerId === sellerId && sp.productId === productId,
        );
        if (existing) {
          existing.retailerSku = update.retailerSku;
          return existing;
        }
        const row: SellerProductRow = {
          id: nextSellerProductId++,
          sellerId: create.sellerId,
          productId: create.productId,
          retailerSku: create.retailerSku,
        };
        sellerProducts.push(row);
        return row;
      },
    },
  } as unknown as CatalogDedupIngestPrisma;

  return {
    prisma,
    snapshot: () => ({
      products: [...products.values()],
      sellerProducts: [...sellerProducts],
    }),
  };
}
