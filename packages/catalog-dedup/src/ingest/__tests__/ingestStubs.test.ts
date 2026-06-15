import type { CatalogDedupIngestPrisma } from "../../types/prisma.js";
import { findOrCreateProduct } from "../findOrCreateProduct.js";
import { findOrCreateSellerProduct } from "../findOrCreateSellerProduct.js";
import { resolveCanonicalCategory } from "../resolveCanonicalCategory.js";

const prisma = {} as CatalogDedupIngestPrisma;

describe("Phase 3/6 ingest stubs", () => {
  it("findOrCreateProduct throws until Phase 3", async () => {
    await expect(
      findOrCreateProduct(prisma, {
        brandId: 1n,
        sellerId: 2n,
        name: "Serum",
        retailerSku: "sku-1",
        categoryId: 3n,
      })
    ).rejects.toThrow("findOrCreateProduct is not implemented until ALE-78 Phase 3");
  });

  it("findOrCreateSellerProduct throws until Phase 3", async () => {
    await expect(
      findOrCreateSellerProduct(prisma, {
        sellerId: 1n,
        productId: 2n,
        retailerSku: "sku-1",
      })
    ).rejects.toThrow("findOrCreateSellerProduct is not implemented until ALE-78 Phase 3");
  });

  it("resolveCanonicalCategory throws until Phase 6", async () => {
    await expect(resolveCanonicalCategory(prisma, 99n)).rejects.toThrow(
      "resolveCanonicalCategory is not implemented until ALE-78 Phase 6"
    );
  });
});
