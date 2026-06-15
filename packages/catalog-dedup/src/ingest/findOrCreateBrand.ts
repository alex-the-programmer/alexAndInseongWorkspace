import {
  UNKNOWN_BRAND_NAME,
  normalizeBrandName,
  normalizeBrandNameAggressive,
} from "../core/brandNormalize.js";
import type { CatalogDedupBrand, CatalogDedupIngestPrisma } from "../types/prisma.js";
import { isUniqueConstraintError } from "./isUniqueConstraintError.js";

type BrandRow = CatalogDedupBrand;

async function findBrandByNormalizedName(
  prisma: CatalogDedupIngestPrisma,
  normalizedName: string
): Promise<BrandRow | null> {
  const rows = await prisma.$queryRaw<BrandRow[]>`
    SELECT id, name, "brandCountryId", "createdAt", "updatedAt"
    FROM brands
    WHERE lower(trim(regexp_replace(name, '\\s+', ' ', 'g'))) = ${normalizedName}
    ORDER BY id ASC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function findBrandByAggressiveName(
  prisma: CatalogDedupIngestPrisma,
  aggressiveKey: string
): Promise<BrandRow | null> {
  if (!aggressiveKey) return null;
  const rows = await prisma.$queryRaw<BrandRow[]>`
    SELECT id, name, "brandCountryId", "createdAt", "updatedAt"
    FROM brands
    WHERE lower(regexp_replace(name, '[^a-z0-9가-힣]+', '', 'g')) = ${aggressiveKey}
    ORDER BY id ASC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function findExistingBrand(
  prisma: CatalogDedupIngestPrisma,
  displayName: string
): Promise<BrandRow | null> {
  const normalizedName = normalizeBrandName(displayName);
  const existing = await findBrandByNormalizedName(prisma, normalizedName);
  if (existing) return existing;

  const aggressiveKey = normalizeBrandNameAggressive(displayName);
  return findBrandByAggressiveName(prisma, aggressiveKey);
}

export default async function findOrCreateBrand(
  prisma: CatalogDedupIngestPrisma,
  rawName: string
): Promise<CatalogDedupBrand> {
  const displayName = rawName.trim() || UNKNOWN_BRAND_NAME;

  const existing = await findExistingBrand(prisma, displayName);
  if (existing) return existing;

  try {
    return await prisma.brand.create({ data: { name: displayName } });
  } catch (e) {
    if (!isUniqueConstraintError(e)) throw e;
    const retry = await findExistingBrand(prisma, displayName);
    if (retry) return retry;
    throw new Error(`Could not resolve brand: ${displayName}`);
  }
}
