import type { PrismaClient } from "@prisma/client";
import { auditBrandDuplicates } from "../auditBrandDuplicates.js";

function mockPrisma(brands: Array<{ id: bigint; name: string; productCount: number }>) {
  return {
    brand: {
      findMany: async () =>
        brands.map((b) => ({
          id: b.id,
          name: b.name,
          _count: { products: b.productCount },
        })),
    },
  } as unknown as PrismaClient;
}

describe("auditBrandDuplicates", () => {
  it("matches golden v2 grouping counts for known punctuation variants", async () => {
    const report = await auditBrandDuplicates(
      mockPrisma([
        { id: 1n, name: "AGE 20's", productCount: 5 },
        { id: 2n, name: "AGE20'S", productCount: 2 },
        { id: 3n, name: "COSRX", productCount: 10 },
      ]),
      "v2"
    );

    expect(report.mode).toBe("v2");
    expect(report.totalBrands).toBe(3);
    expect(report.duplicateGroupCount).toBe(1);
    expect(report.punctuationSpacingGroupCount).toBe(1);
    expect(report.productsInDuplicateGroups).toBe(7);
    expect(report.topGroups[0]).toEqual(
      expect.objectContaining({
        normalizedName: "age20s",
        kind: "punctuation_spacing",
        totalProducts: 7,
      })
    );
  });

  it("excludes Unknown brand from duplicate grouping", async () => {
    const report = await auditBrandDuplicates(
      mockPrisma([
        { id: 1n, name: "Unknown brand", productCount: 100 },
        { id: 2n, name: "COSRX", productCount: 1 },
        { id: 3n, name: "cosrx", productCount: 2 },
      ]),
      "v1"
    );

    expect(report.totalBrands).toBe(3);
    expect(report.duplicateGroupCount).toBe(1);
    expect(report.topGroups[0]?.members).toHaveLength(2);
  });
});
