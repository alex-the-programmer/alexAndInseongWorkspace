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

  it("attaches cross-seller pack-size variants to one canonical product", async () => {
    const { prisma, snapshot } = createInMemoryIngestPrisma();
    const base = "Freshly Juiced Vitamin E Mask";

    const productA = await findOrCreateProduct(prisma, {
      brandId,
      brandName: "Dear, Klairs",
      sellerId: 100n,
      name: `Dear, Klairs ${base} 15g`,
      retailerSku: "klairs-15g",
      categoryId,
    });
    await findOrCreateSellerProduct(prisma, {
      sellerId: 100n,
      productId: productA.id,
      retailerSku: "klairs-15g",
      packAmount: 15,
      packUnit: "G",
      packCount: 1,
    });

    const productB = await findOrCreateProduct(prisma, {
      brandId,
      brandName: "Dear, Klairs",
      sellerId: 200n,
      name: `Dear, Klairs ${base} 90g`,
      retailerSku: "oy-klairs-90g",
      categoryId,
    });
    await findOrCreateSellerProduct(prisma, {
      sellerId: 200n,
      productId: productB.id,
      retailerSku: "oy-klairs-90g",
      packAmount: 90,
      packUnit: "G",
      packCount: 1,
    });

    expect(productB.id).toBe(productA.id);
    const state = snapshot();
    expect(state.products).toHaveLength(1);
    expect(state.products[0]?.name).toBe(base);
    expect(state.sellerProducts).toHaveLength(2);
  });

  it("allows same-seller pack-size variants on one canonical product", async () => {
    const { prisma, snapshot } = createInMemoryIngestPrisma();
    const base = "Freshly Juiced Vitamin E Mask";

    const productA = await findOrCreateProduct(prisma, {
      brandId,
      brandName: "Dear, Klairs",
      sellerId: 77n,
      name: `Dear, Klairs ${base} 15g`,
      retailerSku: "klairs-15g",
      categoryId,
    });
    await findOrCreateSellerProduct(prisma, {
      sellerId: 77n,
      productId: productA.id,
      retailerSku: "klairs-15g",
      packAmount: 15,
      packUnit: "G",
      packCount: 1,
    });

    const productB = await findOrCreateProduct(prisma, {
      brandId,
      brandName: "Dear, Klairs",
      sellerId: 77n,
      name: `Dear, Klairs ${base} 90g`,
      retailerSku: "klairs-90g",
      categoryId,
    });
    await findOrCreateSellerProduct(prisma, {
      sellerId: 77n,
      productId: productB.id,
      retailerSku: "klairs-90g",
      packAmount: 90,
      packUnit: "G",
      packCount: 1,
    });

    expect(productB.id).toBe(productA.id);
    const state = snapshot();
    expect(state.products).toHaveLength(1);
    expect(state.sellerProducts).toHaveLength(2);
    expect(state.sellerProducts.every((sp) => sp.productId === productA.id)).toBe(true);
  });

  it("re-scrape is idempotent for same-seller pack-size variants", async () => {
    const { prisma, snapshot } = createInMemoryIngestPrisma();
    const base = "Freshly Juiced Vitamin E Mask";
    const listings = [
      { sku: "klairs-15g", name: `Dear, Klairs ${base} 15g`, packAmount: 15, packUnit: "G" as const },
      { sku: "klairs-90g", name: `Dear, Klairs ${base} 90g`, packAmount: 90, packUnit: "G" as const },
    ];

    const ingestOnce = async () => {
      const productIds: bigint[] = [];
      const sellerProductIds: bigint[] = [];
      for (const listing of listings) {
        const product = await findOrCreateProduct(prisma, {
          brandId,
          brandName: "Dear, Klairs",
          sellerId: 77n,
          name: listing.name,
          retailerSku: listing.sku,
          categoryId,
        });
        const sellerProduct = await findOrCreateSellerProduct(prisma, {
          sellerId: 77n,
          productId: product.id,
          retailerSku: listing.sku,
          packAmount: listing.packAmount,
          packUnit: listing.packUnit,
          packCount: 1,
        });
        productIds.push(product.id);
        sellerProductIds.push(sellerProduct.id);
      }
      return { productIds, sellerProductIds };
    };

    const first = await ingestOnce();
    const second = await ingestOnce();

    expect(second.productIds[0]).toBe(first.productIds[0]);
    expect(second.productIds[1]).toBe(first.productIds[0]);
    expect(second.sellerProductIds).toEqual(first.sellerProductIds);

    const state = snapshot();
    expect(state.products).toHaveLength(1);
    expect(state.sellerProducts).toHaveLength(2);
  });
});
