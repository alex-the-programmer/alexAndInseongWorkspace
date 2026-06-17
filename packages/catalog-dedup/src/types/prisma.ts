import type { PackUnit } from "../core/productPackSize.js";

/** Brand row returned by ingest helpers — not tied to a specific Prisma generate. */
export type CatalogDedupBrand = {
  id: bigint;
  name: string;
  brandCountryId: bigint | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CatalogDedupProduct = {
  id: bigint;
  name: string;
  brandId: bigint;
  categoryId: bigint;
  sku: string | null;
  mergedIntoProductId: bigint | null;
};

export type CatalogDedupSellerProduct = {
  id: bigint;
  sellerId: bigint;
  productId: bigint;
  retailerSku: string | null;
  packAmount?: number;
  packUnit?: PackUnit;
  packCount?: number;
  listingTitle?: string | null;
};

/** Minimal Prisma surface for ingest — accepts any consumer repo's PrismaClient. */
export type CatalogDedupIngestPrisma = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  brand: {
    create(args: { data: { name: string } }): Promise<CatalogDedupBrand>;
  };
  product: {
    findFirst(args: {
      where: Record<string, unknown>;
      include?: Record<string, unknown>;
      select?: Record<string, unknown>;
    }): Promise<CatalogDedupProduct | null>;
    findMany(args: {
      where: Record<string, unknown>;
      select?: Record<string, unknown>;
      take?: number;
      orderBy?: Record<string, unknown>;
    }): Promise<CatalogDedupProduct[]>;
    findUnique(args: {
      where: { id: bigint };
      select?: Record<string, unknown>;
    }): Promise<Pick<CatalogDedupProduct, "mergedIntoProductId"> | null>;
    create(args: {
      data: {
        name: string;
        brandId: bigint;
        categoryId: bigint;
        sku?: string | null;
      };
    }): Promise<CatalogDedupProduct>;
    update(args: {
      where: { id: bigint };
      data: Record<string, unknown>;
    }): Promise<CatalogDedupProduct>;
  };
  sellerProduct: {
    findFirst(args: {
      where: Record<string, unknown>;
      include?: Record<string, unknown>;
    }): Promise<(CatalogDedupSellerProduct & { product?: CatalogDedupProduct }) | null>;
    create(args: {
      data: {
        sellerId: bigint;
        productId: bigint;
        retailerSku: string;
        packAmount?: number;
        packUnit?: PackUnit;
        packCount?: number;
        listingTitle?: string | null;
      };
    }): Promise<CatalogDedupSellerProduct>;
  };
};
