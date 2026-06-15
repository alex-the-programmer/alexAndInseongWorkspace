import { findOrCreateProduct } from "../findOrCreateProduct.js";
import { findOrCreateSellerProduct } from "../findOrCreateSellerProduct.js";
import { createInMemoryIngestPrisma } from "./helpers/inMemoryIngestPrisma.js";

const brandId = 1n;
const categoryId = 10n;
const brandName = "COSRX";

describe("ingest integration (in-memory Prisma)", () => {
  it("attaches cross-seller listings to one product when names match", async () => {
    const { prisma, snapshot } = createInMemoryIngestPrisma();
    const listingName = "Advanced Snail 96 Mucin Power Essence";

    const productA = await findOrCreateProduct(prisma, {
      brandId,
      brandName,
      sellerId: 100n,
      name: listingName,
      retailerSku: "sk-handle-a",
      categoryId,
    });
    await findOrCreateSellerProduct(prisma, {
      sellerId: 100n,
      productId: productA.id,
      retailerSku: "sk-handle-a",
    });

    const productB = await findOrCreateProduct(prisma, {
      brandId,
      brandName,
      sellerId: 200n,
      name: listingName,
      retailerSku: "oy-prdt-999",
      categoryId,
    });
    await findOrCreateSellerProduct(prisma, {
      sellerId: 200n,
      productId: productB.id,
      retailerSku: "oy-prdt-999",
    });

    expect(productB.id).toBe(productA.id);
    const state = snapshot();
    expect(state.products).toHaveLength(1);
    expect(state.sellerProducts).toHaveLength(2);
    expect(state.sellerProducts.every((sp) => sp.productId === productA.id)).toBe(true);
    expect(new Set(state.sellerProducts.map((sp) => sp.sellerId)).size).toBe(2);
  });

  it("re-ingests the same seller listing idempotently", async () => {
    const { prisma, snapshot } = createInMemoryIngestPrisma();
    const params = {
      brandId,
      brandName,
      sellerId: 50n,
      name: "Low pH Good Morning Gel Cleanser",
      retailerSku: "cleanser-001",
      categoryId,
    };

    const first = await findOrCreateProduct(prisma, params);
    const listingA = await findOrCreateSellerProduct(prisma, {
      sellerId: params.sellerId,
      productId: first.id,
      retailerSku: params.retailerSku,
    });

    const second = await findOrCreateProduct(prisma, {
      ...params,
      name: "Low pH Good Morning Gel Cleanser (updated title)",
    });
    const listingB = await findOrCreateSellerProduct(prisma, {
      sellerId: params.sellerId,
      productId: second.id,
      retailerSku: params.retailerSku,
    });

    expect(second.id).toBe(first.id);
    expect(listingB.id).toBe(listingA.id);

    const state = snapshot();
    expect(state.products).toHaveLength(1);
    expect(state.sellerProducts).toHaveLength(1);
    expect(state.sellerProducts[0]?.retailerSku).toBe("cleanser-001");
    expect(state.products[0]?.sku).toBeNull();
  });

  it("keeps same-seller shade variants as separate products", async () => {
    const { prisma, snapshot } = createInMemoryIngestPrisma();

    const shadeA = await findOrCreateProduct(prisma, {
      brandId,
      brandName,
      sellerId: 77n,
      name: "Velvet Lip Tint Rose Festival",
      retailerSku: "tint-rose",
      categoryId,
    });
    await findOrCreateSellerProduct(prisma, {
      sellerId: 77n,
      productId: shadeA.id,
      retailerSku: "tint-rose",
    });

    const shadeB = await findOrCreateProduct(prisma, {
      brandId,
      brandName,
      sellerId: 77n,
      name: "Velvet Lip Tint Ocean Coral",
      retailerSku: "tint-coral",
      categoryId,
    });
    await findOrCreateSellerProduct(prisma, {
      sellerId: 77n,
      productId: shadeB.id,
      retailerSku: "tint-coral",
    });

    expect(shadeB.id).not.toBe(shadeA.id);
    const state = snapshot();
    expect(state.products).toHaveLength(2);
    expect(state.sellerProducts).toHaveLength(2);
  });
});
