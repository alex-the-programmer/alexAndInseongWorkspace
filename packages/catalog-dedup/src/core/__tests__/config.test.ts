import type { PrismaClient } from "@prisma/client";
import {
  OLIVE_YOUNG_GLOBAL_NAME,
  getDedupSellers,
  readProductDedupConfig,
} from "../config.js";

describe("readProductDedupConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PRODUCT_DEDUP_MIN_TOKEN_OVERLAP;
    delete process.env.PRODUCT_DEDUP_MAX_COUNTERPARTS_PER_PRODUCT;
    delete process.env.PRODUCT_DEDUP_MAX_OY_PER_SK;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses defaults when env vars are unset", () => {
    expect(readProductDedupConfig()).toEqual({
      minTokenOverlap: 2,
      maxCounterpartsPerProduct: 25,
    });
  });

  it("reads overrides from env", () => {
    process.env.PRODUCT_DEDUP_MIN_TOKEN_OVERLAP = "3";
    process.env.PRODUCT_DEDUP_MAX_COUNTERPARTS_PER_PRODUCT = "40";

    expect(readProductDedupConfig()).toEqual({
      minTokenOverlap: 3,
      maxCounterpartsPerProduct: 40,
    });
  });

  it("falls back to legacy MAX_OY_PER_SK env name", () => {
    process.env.PRODUCT_DEDUP_MAX_OY_PER_SK = "12";

    expect(readProductDedupConfig().maxCounterpartsPerProduct).toBe(12);
  });
});

describe("getDedupSellers", () => {
  it("queries sellers with active product listings", async () => {
    const sellers = [{ id: 1n, name: "Jolse" }];
    let capturedArgs: unknown;
    const findMany = async (args: unknown) => {
      capturedArgs = args;
      return sellers;
    };

    const prisma = {
      seller: { findMany },
    } as unknown as PrismaClient;

    await expect(getDedupSellers(prisma)).resolves.toEqual(sellers);
    expect(capturedArgs).toEqual(
      expect.objectContaining({
        where: {
          sellerProducts: {
            some: { product: { mergedIntoProductId: null } },
          },
        },
        orderBy: { name: "asc" },
      })
    );
  });
});

describe("OLIVE_YOUNG_GLOBAL_NAME", () => {
  it("is exported for dedup scripts", () => {
    expect(OLIVE_YOUNG_GLOBAL_NAME).toBe("Olive Young Global");
  });
});
