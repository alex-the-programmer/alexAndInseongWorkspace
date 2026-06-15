import type { CatalogDedupIngestPrisma } from "../../types/prisma.js";
import { resolveCanonicalCategory } from "../resolveCanonicalCategory.js";

const prisma = {} as CatalogDedupIngestPrisma;

describe("Phase 6 ingest stubs", () => {
  it("resolveCanonicalCategory throws until Phase 6", async () => {
    await expect(resolveCanonicalCategory(prisma, 99n)).rejects.toThrow(
      "resolveCanonicalCategory is not implemented until ALE-78 Phase 6"
    );
  });
});
