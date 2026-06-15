import { jest } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";

const repointProductForeignKeys = jest.fn<() => Promise<void>>(async () => {});

jest.unstable_mockModule("../repointProductForeignKeys.js", () => ({
  default: repointProductForeignKeys,
}));

const { default: executeProductMerge } = await import("../mergeProduct.js");

type ProductRow = {
  id: bigint;
  mergedIntoProductId: bigint | null;
};

function createMergePrisma(initial: ProductRow[]) {
  const products = new Map(initial.map((p) => [p.id.toString(), { ...p }]));

  const tx = {
    product: {
      findMany: async ({
        where,
      }: {
        where: { mergedIntoProductId: bigint };
      }) =>
        [...products.values()].filter(
          (p) => p.mergedIntoProductId === where.mergedIntoProductId
        ),
      update: async ({
        where: { id },
        data,
      }: {
        where: { id: bigint };
        data: { mergedIntoProductId: bigint };
      }) => {
        const row = products.get(id.toString());
        if (!row) throw new Error("missing");
        row.mergedIntoProductId = data.mergedIntoProductId;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { mergedIntoProductId: bigint };
        data: { mergedIntoProductId: bigint };
      }) => {
        for (const row of products.values()) {
          if (row.mergedIntoProductId === where.mergedIntoProductId) {
            row.mergedIntoProductId = data.mergedIntoProductId;
          }
        }
      },
    },
  };

  const prisma = {
    product: {
      findUnique: async ({ where: { id } }: { where: { id: bigint } }) =>
        products.get(id.toString()) ?? null,
    },
    $transaction: async (fn: (client: typeof tx) => Promise<void>) => fn(tx),
  } as unknown as PrismaClient;

  return { prisma, products };
}

describe("executeProductMerge", () => {
  beforeEach(() => {
    repointProductForeignKeys.mockClear();
  });

  it("sets mergedIntoProductId on the secondary row (tombstone-era behavior)", async () => {
    const { prisma, products } = createMergePrisma([
      { id: 1n, mergedIntoProductId: null },
      { id: 2n, mergedIntoProductId: null },
    ]);

    await executeProductMerge(prisma, {
      primaryProductId: 1n,
      secondaryProductId: 2n,
    });

    expect(repointProductForeignKeys).toHaveBeenCalledWith(expect.anything(), 2n, 1n);
    expect(products.get("2")?.mergedIntoProductId).toBe(1n);
  });

  it("rejects merging a product into itself", async () => {
    const { prisma } = createMergePrisma([{ id: 1n, mergedIntoProductId: null }]);

    await expect(
      executeProductMerge(prisma, {
        primaryProductId: 1n,
        secondaryProductId: 1n,
      })
    ).rejects.toThrow(/must differ/);
  });
});
