import type { CatalogDedupIngestPrisma } from "../../types/prisma.js";
import findOrCreateBrand from "../findOrCreateBrand.js";

describe("findOrCreateBrand", () => {
  it("returns an existing brand matched case-insensitively", async () => {
    const existing = {
      id: 9n,
      name: "COSRX",
      brandCountryId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const queries: string[] = [];

    const prisma = {
      $queryRaw: async () => {
        queries.push("find");
        return [existing];
      },
      brand: {
        create: async () => {
          throw new Error("should not create when brand exists");
        },
      },
    } as unknown as CatalogDedupIngestPrisma;

    const brand = await findOrCreateBrand(prisma, "cosrx");
    expect(brand.id).toBe(9n);
    expect(queries.length).toBe(1);
  });

  it("returns an existing brand matched by aggressive key when v1 differs", async () => {
    const existing = {
      id: 12n,
      name: "AGE 20's",
      brandCountryId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let queryCount = 0;

    const prisma = {
      $queryRaw: async () => {
        queryCount += 1;
        return queryCount === 1 ? [] : [existing];
      },
      brand: {
        create: async () => {
          throw new Error("should not create when aggressive match exists");
        },
      },
    } as unknown as CatalogDedupIngestPrisma;

    const brand = await findOrCreateBrand(prisma, "AGE20'S");
    expect(brand.id).toBe(12n);
    expect(queryCount).toBe(2);
  });

  it("creates a brand when no normalized match exists", async () => {
    const created = {
      id: 11n,
      name: "New Brand",
      brandCountryId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const prisma = {
      $queryRaw: async () => [],
      brand: {
        create: async () => created,
      },
    } as unknown as CatalogDedupIngestPrisma;

    const brand = await findOrCreateBrand(prisma, "  New   Brand ");
    expect(brand.id).toBe(11n);
    expect(brand.name).toBe("New Brand");
  });

  it("retries lookup after a unique-constraint race on create", async () => {
    const existing = {
      id: 42n,
      name: "Race Brand",
      brandCountryId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let queryCount = 0;

    const prisma = {
      $queryRaw: async () => {
        queryCount += 1;
        return queryCount <= 2 ? [] : [existing];
      },
      brand: {
        create: async () => {
          throw { code: "P2002" };
        },
      },
    } as unknown as CatalogDedupIngestPrisma;

    const brand = await findOrCreateBrand(prisma, "Race Brand");
    expect(brand.id).toBe(42n);
    expect(queryCount).toBe(3);
  });

  it("throws when unique-constraint race cannot resolve an existing row", async () => {
    const prisma = {
      $queryRaw: async () => [],
      brand: {
        create: async () => {
          throw { code: "P2002" };
        },
      },
    } as unknown as CatalogDedupIngestPrisma;

    await expect(findOrCreateBrand(prisma, "Ghost Brand")).rejects.toThrow(
      "Could not resolve brand: Ghost Brand"
    );
  });
});
