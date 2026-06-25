import type {
  CatalogDedupIngestPrisma,
  CatalogDedupProduct,
  CatalogDedupSellerProduct,
} from "../../../types/prisma.js";

type SellerProductRow = CatalogDedupSellerProduct & {
  product?: CatalogDedupProduct;
};

function variantKey(row: Pick<CatalogDedupSellerProduct, "sellerId" | "productId" | "packAmount" | "packUnit" | "packCount">) {
  return `${row.sellerId}:${row.productId}:${row.packAmount ?? 0}:${row.packUnit ?? "UNKNOWN"}:${row.packCount ?? 1}`;
}

function matchesSellerProductWhere(
  row: SellerProductRow,
  where: {
    sellerId?: bigint;
    retailerSku?: string;
    productId?: bigint;
    packAmount?: number;
    packUnit?: string;
    packCount?: number;
  }
): boolean {
  if (where.sellerId !== undefined && row.sellerId !== where.sellerId) return false;
  if (where.retailerSku !== undefined && row.retailerSku !== where.retailerSku) return false;
  if (where.productId !== undefined && row.productId !== where.productId) return false;
  if (where.packAmount !== undefined && (row.packAmount ?? 0) !== where.packAmount) return false;
  if (where.packUnit !== undefined && (row.packUnit ?? "UNKNOWN") !== where.packUnit) return false;
  if (where.packCount !== undefined && (row.packCount ?? 1) !== where.packCount) return false;
  return true;
}

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
          sellerProducts?: { some: { sellerId?: { not: bigint } } | Record<string, never> };
        };
        take?: number;
        orderBy?: { id: "asc" | "desc" };
      }) => {
        let rows = [...products.values()].filter(
          (p) => p.brandId === where.brandId && p.mergedIntoProductId === null,
        );
        if (where.sellerProducts?.some !== undefined) {
          const excludeSeller = where.sellerProducts.some.sellerId?.not;
          if (excludeSeller !== undefined) {
            rows = rows.filter((p) =>
              sellerProducts.some(
                (sp) => sp.productId === p.id && sp.sellerId !== excludeSeller,
              ),
            );
          } else {
            rows = rows.filter((p) =>
              sellerProducts.some((sp) => sp.productId === p.id),
            );
          }
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
          packAmount?: number;
          packUnit?: string;
          packCount?: number;
        };
        include?: { product?: boolean };
      }) => {
        const row = sellerProducts.find((sp) => matchesSellerProductWhere(sp, where));
        if (!row) return null;
        if (include?.product) {
          const product = products.get(row.productId.toString());
          return { ...row, product: product ?? undefined };
        }
        return row;
      },
      create: async ({
        data,
      }: {
        data: {
          sellerId: bigint;
          productId: bigint;
          retailerSku: string;
          packAmount?: number;
          packUnit?: string;
          packCount?: number;
          listingTitle?: string | null;
        };
      }) => {
        const row: SellerProductRow = {
          id: nextSellerProductId++,
          sellerId: data.sellerId,
          productId: data.productId,
          retailerSku: data.retailerSku,
          packAmount: data.packAmount ?? 0,
          packUnit: data.packUnit ?? "UNKNOWN",
          packCount: data.packCount ?? 1,
          listingTitle: data.listingTitle ?? null,
        };

        const skuConflict = sellerProducts.find(
          (sp) => sp.sellerId === row.sellerId && sp.retailerSku === row.retailerSku,
        );
        if (skuConflict) {
          const err = new Error("unique") as Error & { code: string };
          err.code = "P2002";
          throw err;
        }

        const variantConflict = sellerProducts.find(
          (sp) => variantKey(sp) === variantKey(row),
        );
        if (variantConflict) {
          const err = new Error("unique") as Error & { code: string };
          err.code = "P2002";
          throw err;
        }

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
