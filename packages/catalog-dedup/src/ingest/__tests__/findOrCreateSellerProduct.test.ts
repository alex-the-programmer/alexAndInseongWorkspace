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

  it("updates unknown pack fields when an existing listing is re-ingested", async () => {
    const existing = {
      id: 4n,
      sellerId: 10n,
      productId: 100n,
      retailerSku: "sku-4",
      packAmount: 0,
      packUnit: PackUnit.UNKNOWN,
      packCount: 1,
      listingTitle: "Hand Cream 50ml (5 Options)",
    };
    const updated = {
      ...existing,
      packAmount: 50,
      packUnit: PackUnit.ML,
    };

    const prisma = {
      sellerProduct: {
        findFirst: async () => existing,
        create: async () => {
          throw new Error("should not create");
        },
        update: async () => updated,
      },
    } as unknown as CatalogDedupIngestPrisma;

    const row = await findOrCreateSellerProduct(prisma, {
      sellerId: 10n,
      productId: 100n,
      retailerSku: "sku-4",
      packAmount: 50,
      packUnit: PackUnit.ML,
      packCount: 1,
      listingTitle: "Hand Cream 50ml (5 Options)",
    });

    expect(row).toEqual(updated);
  });
});
