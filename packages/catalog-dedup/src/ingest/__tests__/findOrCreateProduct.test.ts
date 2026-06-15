import type { CatalogDedupIngestPrisma } from "../../types/prisma.js";
import { findOrCreateProduct } from "../findOrCreateProduct.js";

const baseParams = {
  brandId: 1n,
  brandName: "COSRX",
  sellerId: 10n,
  name: "Snail Mucin Essence",
  retailerSku: "sku-abc",
  categoryId: 5n,
};

describe("findOrCreateProduct", () => {
  it("returns active product when seller listing exists by retailerSku", async () => {
    const canonical = {
      id: 100n,
      name: "Snail Mucin Essence",
      brandId: 1n,
      categoryId: 5n,
      sku: null,
      mergedIntoProductId: null,
    };

    const prisma = {
      sellerProduct: {
        findFirst: async () => ({
          id: 50n,
          sellerId: 10n,
          productId: 100n,
          retailerSku: "sku-abc",
          product: canonical,
        }),
      },
      product: {
        findFirst: async () => {
          throw new Error("should not use legacy lookup");
        },
        findMany: async () => {
          throw new Error("should not search counterparts");
        },
        create: async () => {
          throw new Error("should not create");
        },
        findUnique: async () => {
          throw new Error("should not resolve merge");
        },
      },
    } as unknown as CatalogDedupIngestPrisma;

    const product = await findOrCreateProduct(prisma, baseParams);
    expect(product.id).toBe(100n);
  });

  it("falls back to legacy product.sku when same seller has a listing", async () => {
    const legacy = {
      id: 200n,
      name: "Legacy",
      brandId: 1n,
      categoryId: 5n,
      sku: "sku-abc",
      mergedIntoProductId: null,
    };

    const prisma = {
      sellerProduct: {
        findFirst: async (args: { where: { sellerId?: bigint; retailerSku?: string; productId?: bigint } }) => {
          if (args.where.retailerSku) return null;
          if (args.where.productId === 200n) return { id: 1n };
          return null;
        },
      },
      product: {
        findFirst: async () => legacy,
        findMany: async () => [],
        create: async () => {
          throw new Error("should not create");
        },
        findUnique: async () => null,
      },
    } as unknown as CatalogDedupIngestPrisma;

    const product = await findOrCreateProduct(prisma, baseParams);
    expect(product.id).toBe(200n);
  });

  it("reuses a cross-seller blocked-pair match", async () => {
    const match = {
      id: 300n,
      name: "Snail Mucin 96 Power Essence",
      brandId: 1n,
      categoryId: 5n,
      sku: "other-sku",
      mergedIntoProductId: null,
    };

    const prisma = {
      sellerProduct: {
        findFirst: async () => null,
      },
      product: {
        findFirst: async () => null,
        findMany: async () => [match],
        create: async () => {
          throw new Error("should not create when match exists");
        },
        findUnique: async () => null,
      },
    } as unknown as CatalogDedupIngestPrisma;

    const product = await findOrCreateProduct(prisma, baseParams);
    expect(product.id).toBe(300n);
  });

  it("creates a product without sku when no match exists", async () => {
    const created = {
      id: 400n,
      name: baseParams.name,
      brandId: baseParams.brandId,
      categoryId: baseParams.categoryId,
      sku: null,
      mergedIntoProductId: null,
    };

    const prisma = {
      sellerProduct: {
        findFirst: async () => null,
      },
      product: {
        findFirst: async () => null,
        findMany: async () => [],
        create: async (args: { data: { name: string; brandId: bigint; categoryId: bigint } }) => {
          expect(args.data).toEqual({
            name: baseParams.name,
            brandId: baseParams.brandId,
            categoryId: baseParams.categoryId,
          });
          return created;
        },
        findUnique: async () => null,
      },
    } as unknown as CatalogDedupIngestPrisma;

    const product = await findOrCreateProduct(prisma, baseParams);
    expect(product.id).toBe(400n);
  });

  it("skips cross-seller dedup for unknown brand names", async () => {
    const created = {
      id: 500n,
      name: baseParams.name,
      brandId: baseParams.brandId,
      categoryId: baseParams.categoryId,
      sku: null,
      mergedIntoProductId: null,
    };

    let findManyCalled = false;
    const prisma = {
      sellerProduct: {
        findFirst: async () => null,
      },
      product: {
        findFirst: async () => null,
        findMany: async () => {
          findManyCalled = true;
          return [];
        },
        create: async () => created,
        findUnique: async () => null,
      },
    } as unknown as CatalogDedupIngestPrisma;

    const product = await findOrCreateProduct(prisma, {
      ...baseParams,
      brandName: "Unknown brand",
    });
    expect(product.id).toBe(500n);
    expect(findManyCalled).toBe(false);
  });
});
