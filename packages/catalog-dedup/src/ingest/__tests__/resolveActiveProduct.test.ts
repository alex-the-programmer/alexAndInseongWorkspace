import type { CatalogDedupIngestPrisma } from "../../types/prisma.js";
import { resolveActiveProduct } from "../resolveActiveProduct.js";

describe("resolveActiveProduct", () => {
  it("returns the product when it is not merged", async () => {
    const product = {
      id: 1n,
      name: "A",
      brandId: 1n,
      categoryId: 1n,
      sku: null,
      mergedIntoProductId: null,
    };

    const prisma = {
      product: {
        findUnique: async () => {
          throw new Error("should not query");
        },
      },
    } as unknown as CatalogDedupIngestPrisma;

    const active = await resolveActiveProduct(prisma, product);
    expect(active.id).toBe(1n);
  });

  it("follows mergedIntoProductId to the canonical row", async () => {
    const duplicate = {
      id: 2n,
      name: "Dup",
      brandId: 1n,
      categoryId: 1n,
      sku: null,
      mergedIntoProductId: 1n,
    };
    const canonical = {
      id: 1n,
      name: "Canonical",
      brandId: 1n,
      categoryId: 1n,
      sku: null,
      mergedIntoProductId: null,
    };

    const prisma = {
      product: {
        findUnique: async () => canonical,
      },
    } as unknown as CatalogDedupIngestPrisma;

    const active = await resolveActiveProduct(prisma, duplicate);
    expect(active.id).toBe(1n);
    expect(active.name).toBe("Canonical");
  });
});
