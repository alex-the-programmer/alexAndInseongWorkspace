import type { CatalogDedupIngestPrisma } from "../../types/prisma.js";
import { PackUnit } from "../../core/productPackSize.js";
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
        create: async () => {
          throw new Error("should not create");
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

  it("creates a row when no listing or variant exists", async () => {
    const created = {
      id: 2n,
      sellerId: 10n,
      productId: 200n,
      retailerSku: "sku-2",
      packAmount: 500,
      packUnit: PackUnit.MG,
      packCount: 1,
    };

    let findCount = 0;
    const prisma = {
      sellerProduct: {
        findFirst: async () => {
          findCount += 1;
          return null;
        },
        create: async () => created,
      },
    } as unknown as CatalogDedupIngestPrisma;

    const row = await findOrCreateSellerProduct(prisma, {
      sellerId: 10n,
      productId: 200n,
      retailerSku: "sku-2",
      packAmount: 500,
      packUnit: PackUnit.MG,
    });
    expect(row).toEqual(created);
    expect(findCount).toBe(2);
  });

  it("retries lookup after unique-constraint race on create", async () => {
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
          return findCount <= 2 ? null : raced;
        },
        create: async () => {
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
    expect(findCount).toBe(3);
  });
});
