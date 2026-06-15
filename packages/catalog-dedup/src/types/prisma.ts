/** Brand row returned by ingest helpers — not tied to a specific Prisma generate. */
export type CatalogDedupBrand = {
  id: bigint;
  name: string;
  brandCountryId: bigint | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Minimal Prisma surface for ingest — accepts any consumer repo's PrismaClient. */
export type CatalogDedupIngestPrisma = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  brand: {
    create(args: { data: { name: string } }): Promise<CatalogDedupBrand>;
  };
};
