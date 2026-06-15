import type { CatalogDedupIngestPrisma } from "../../types/prisma.js";
import { findOrCreateSellerProduct } from "../findOrCreateSellerProduct.js";

describe("findOrCreateSellerProduct", () => {
  it("returns existing row matched by sellerId and retailerSku", async () => {
    const existing = {
      id: 1n,
      sellerId: 10n,
      productId: 100n,
      retailerSku: "sku-1",
    };

    const prisma = {
      sellerProduct: {
        findFirst: async () => existing,
        upsert: async () => {
          throw new Error("should not upsert");
        },
      },
    } as unknown as CatalogDedupIngestPrisma;

    const row = await findOrCreateSellerProduct(prisma, {
      sellerId: 10n,
      productId: 100n,
      retailerSku: "sku-1",
    });
    expect(row.id).toBe(1n);
  });

  it("upserts by sellerId and productId when no retailerSku row exists", async () => {
    const upserted = {
      id: 2n,
      sellerId: 10n,
      productId: 200n,
      retailerSku: "sku-2",
    };

    const prisma = {
      sellerProduct: {
        findFirst: async () => null,
        upsert: async () => upserted,
      },
    } as unknown as CatalogDedupIngestPrisma;

    const row = await findOrCreateSellerProduct(prisma, {
      sellerId: 10n,
      productId: 200n,
      retailerSku: "sku-2",
    });
    expect(row).toEqual(upserted);
  });

  it("retries lookup after unique-constraint race on upsert", async () => {
    const raced = {
      id: 3n,
      sellerId: 10n,
      productId: 300n,
      retailerSku: "sku-3",
    };
    let findCount = 0;

    const prisma = {
      sellerProduct: {
        findFirst: async () => {
          findCount += 1;
          return findCount === 1 ? null : raced;
        },
        upsert: async () => {
          const err = new Error("unique") as Error & { code: string };
          err.code = "P2002";
          throw err;
        },
      },
    } as unknown as CatalogDedupIngestPrisma;

    const row = await findOrCreateSellerProduct(prisma, {
      sellerId: 10n,
      productId: 300n,
      retailerSku: "sku-3",
    });
    expect(row.id).toBe(3n);
    expect(findCount).toBe(2);
  });
});
