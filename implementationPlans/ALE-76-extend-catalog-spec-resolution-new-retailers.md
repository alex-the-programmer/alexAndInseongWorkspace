# ALE-76 Extend catalog spec resolution for new K-beauty retailers

## Context

[Linear ALE-76](https://linear.app/dewly/issue/ALE-76/extend-catalog-spec-resolution-for-new-k-beauty-retailer-scrapes)

Over the last few weeks we landed many new retailer integrations in `commerce-platform-scrapers` (Shopify, WooCommerce, Cafe24). Scrapers persist product specs with **per-retailer prefixes** (`CRX Thumbnail URL`, `PL Description`, `JL ingredients`, etc.).

Catalog **read** logic in `commerce-platform-backend` still encodes vendor-specific heuristics for **Olive Young** and **StyleKorean** only. New retailer data is partially usable via generic regex fallbacks, but thumbnails and ingredients are unreliable — especially on products that also have legacy OY specs from merges.

**Branch:** `ALE-76-extend-catalog-spec-resolution-new-retailers` (primarily `commerce-platform-backend`; optional small scraper follow-ups).

**Database changes:** Optional **seed-only** rows in `seller_spec_mappings` linking new `seller_specs.name` values to canonical `product_specs` (e.g. `Ingredients (INCI list)`, `Thumbnail URL`). **No new columns.** Architect approval required before applying any migration.

**Related scrape tickets:** ALE-56 (Jolse), ALE-58–59 (Soko Glam, Wishtrend), ALE-61 (RoseRoseShop), ALE-66–74 (Peach & Lily, Moida, Oh Lolly, COSRX US, Skinglow Haven, Beauty of Joseon US, Medicube US, Innisfree US, Laneige US).

---

## Current state (audit)

### Where vendor logic lives today

| Layer | File | What is vendor-specific |
|-------|------|-------------------------|
| Thumbnail (single product) | `commerce-platform-backend/src/interactions/catalog/getProductThumbnailUrl.ts` | Hard-coded scores for `Thumbnail path`, `OY US Thumbnail URL`, OY JSON image paths; OY CDN origin; StyleKorean OG fallback via `SK PDP URL` |
| Thumbnail (batch cards) | `commerce-platform-backend/src/interactions/catalog/getShoppingProductCardsBatch.ts` | Same scoring as above but **missing** `OY US Thumbnail URL` boost; no SK OG fallback |
| Ingredients | `commerce-platform-backend/src/interactions/catalog/ingredientSpecResolution.ts` | `KNOWN_INGREDIENT_SPEC_NAMES` = `SK ingredients`, `OY PDP.detailsInfo.details.ftrdIngrdText`; score boosts for SK/OY only |
| Ingredient fetch | `commerce-platform-backend/src/interactions/catalog/fetchIngredientSpecRows.ts` | DB query OR-clause only includes known names, canonical mappings, or comma+glycerin/niacinamide heuristic |
| Spec tagging (ops script) | `commerce-platform-backend/scripts/tagSpecs.ts` | Explicit rules for OY + SK; everything else defaults to `FACET` |
| Spec curation (ops script) | `commerce-platform-backend/scripts/manualSpecCurationBatch5SourceSpecific.ts` | StyleKorean only |

### What scrapers persist today

| Retailer | Prefix | Thumbnail spec | Ingredient spec | Notes |
|----------|--------|----------------|-----------------|-------|
| Olive Young Global | `OY ` | `Thumbnail path`, JSON image paths | `ftrdIngrdText`, notice fields | Richest integration |
| Olive Young US | `OY US ` | `OY US Thumbnail URL` | `OY US product info (English)` (sometimes INCI-like) | API entities |
| StyleKorean | `SK ` | `SK Image URLs (json)`, OG via `SK PDP URL` | `SK ingredients` | HTML section extract |
| Jolse | `JL ` | `JL Thumbnail URL` | `JL ingredients` | HTML section extract |
| Soko Glam | `SG ` | `SG Thumbnail URL` | — | Shopify `body_html` only in `SG Description` |
| Wishtrend | `WT ` | `WT Thumbnail URL` | — | Same |
| RoseRoseShop | `RR ` | `RR Thumbnail URL` | — | Same |
| Peach & Lily | `PL ` | `PL Thumbnail URL` | — | Same |
| Moida | `MO ` | `MO Thumbnail URL` | — | Same |
| Oh Lolly | `OL ` | `OL Thumbnail URL` | — | Same |
| COSRX US | `CRX ` | `CRX Thumbnail URL` | — | Same |
| Beauty of Joseon US | `BOJ ` | `BOJ Thumbnail URL` | — | Same |
| Medicube US | `MC ` | `MC Thumbnail URL` | — | Same |
| Innisfree US | `IFU ` | `IFU Thumbnail URL` | — | Same |
| Laneige US | `LG ` | `LG Thumbnail URL` | — | Same |
| Skinglow Haven | `SGH ` | `SGH Thumbnail URL` | — | WooCommerce; plain-text description |

**Pattern:** All Shopify/WooCommerce retailers store **absolute CDN URLs** in `{PREFIX} Thumbnail URL`. None extract a dedicated ingredients spec except Jolse and StyleKorean.

### Gaps

1. **Thumbnails** — `{PREFIX} Thumbnail URL` matches generic `/(thumbnail)/i` (+300) but loses to OY paths (+850–1000) on merged products. No explicit +900 for `* Thumbnail URL` suffix.
2. **Ingredients** — `JL ingredients` scraped but not in `KNOWN_INGREDIENT_SPEC_NAMES`; Shopify descriptions rarely match fetch heuristic unless they contain both commas and glycerin/niacinamide.
3. **Duplicated logic** — `getProductThumbnailUrl` and `getShoppingProductCardsBatch` diverge (OY US boost, SK fallback).
4. **Spec tags** — New image specs tagged `FACET` instead of `PAGE` (still queryable today, but wrong semantics).
5. **No canonical mappings** — `seller_spec_mappings` not seeded for new retailers.
6. **No unit tests** — `ingredientSpecResolution` / thumbnail scoring untested.

---

## Goals

| Goal | Detail |
|------|--------|
| Thumbnails | Prefer the **offering seller's** native thumbnail spec; explicit high score for `* Thumbnail URL` and `* Image 1` across all prefixes |
| Ingredients | Resolve top ingredients from dedicated specs (`SK`, `JL`) and from Shopify/Woo **description** when an INCI block is present |
| DRY | Single shared module for thumbnail + ingredient spec name scoring used by both code paths |
| Scraper follow-up (optional) | Extract `{PREFIX} ingredients` from Shopify `body_html` during PDP enrich (shared helper) |
| Observability | Audit script: per-seller % of products with resolvable thumbnail + ≥2 top ingredients |
| Tests | Unit tests for scoring + parsing; no DB in resolver tests |

**Out of scope (v1):**

- LLM ingredient normalization changes (`normalizeIngredientLabels`, shopping agent).
- Frontend component changes.
- Re-scraping entire catalogs (only needed if we add scraper-side ingredient extraction and want backfill).

---

## Proposed design

### 1. Shared seller spec conventions module (backend)

Add `commerce-platform-backend/src/interactions/catalog/sellerSpecConventions.ts`:

```ts
// Prefixes aligned with commerce-platform-scrapers *Constants.ts files
export const RETAILER_SPEC_PREFIXES = [
  "OY US ", "OY ", "SK ", "JL ", "SG ", "WT ", "RR ", "PL ", "MO ", "OL ",
  "CRX ", "BOJ ", "MC ", "IFU ", "LG ", "SGH ",
] as const;

export function scoreThumbnailSpecName(name: string): number;
export function scoreIngredientSpecName(name: string, canonicalName?: string | null): number;
export function isRetailerThumbnailSpecName(name: string): boolean;
export function isRetailerIngredientSpecName(name: string): boolean;
```

**Thumbnail scoring (proposed):**

| Rule | Score |
|------|------:|
| Exact `Thumbnail path` | 1000 |
| Ends with `Thumbnail URL` (any prefix) | 950 |
| `OY US Thumbnail URL` | 980 (keep) |
| OY `thumbnailList[0].imagePath` | 900 |
| OY `detailData.product.imagePath` | 850 |
| Ends with `Image 1` | 800 |
| Generic image regex | 300 |
| Prefix boost `OY US ` / `OY ` | 250 / 200 |

**Ingredient scoring updates:**

- Add to `KNOWN_INGREDIENT_SPEC_NAMES`: `JL ingredients`, and `{PREFIX} ingredients` for each retailer (or one regex: `/ ingredients$/i` with prefix).
- Add `+700` for names ending in ` ingredients` (mirrors SK).
- Add `+500` for `{PREFIX} Description` **only when** value passes `isIngredientLikeValue` (comma-separated INCI in HTML description).
- Keep existing OY featured / notice rules.

Refactor `ingredientSpecResolution.ts` to import shared scoring; keep parse/token helpers in place.

### 2. Unify thumbnail resolvers

- Extract shared `resolveThumbnailFromProductSpecs(rows, urlTemplate)` used by:
  - `getProductThumbnailUrl.ts`
  - `getShoppingProductCardsBatch.ts`
- Port SK OG fallback into batch path **or** document intentional omission (prefer shared helper so behavior matches).
- When multiple sellers offer the same product, prefer specs whose prefix matches the **lowest-price linkable seller** (requires passing seller context into resolver — stretch goal; v1 can use highest score globally).

### 3. Expand ingredient row fetch

Update `fetchIngredientSpecRows.ts` OR-clause:

- `{ sellerSpec: { name: { endsWith: " ingredients" } } }` (Prisma `endsWith`)
- `{ sellerSpec: { name: { endsWith: " Description" } } }` combined with existing value heuristics
- Include `JL ingredients` in known list

### 4. Scraper-side ingredient extraction (optional, same ticket or follow-up)

Add `commerce-platform-scrapers/src/scrapers/shared/extractSectionFromHtml.ts` (port from `jolsePdp.ts` / `styleKoreanPdp.ts`):

- `extractSectionText(html, "Ingredients")`
- `extractIngredientsFromShopifyBodyHtml(body_html)`

Wire into `mapShopifyProductJsonToSpecRows` pattern — each retailer's `map*ProductJsonToSpecRows` pushes `{PREFIX} ingredients` when found.

**Backfill:** one-off script `enrichMissingShopifyIngredients.ts` per seller queue, or re-run PDP enrich jobs.

### 5. Spec tagging script update

Extend `scripts/tagSpecs.ts`:

```sql
WHEN "name" LIKE '% Thumbnail URL' OR "name" LIKE '% Image %' THEN 'PAGE'
WHEN "name" LIKE '% ingredients' OR "name" LIKE '% howToUse' THEN 'FACET'
WHEN "name" LIKE '% Description' THEN 'FACET'
```

Run manually against dev/staging after deploy.

### 6. Canonical mappings (optional seed migration)

Backend migration seeding `seller_spec_mappings` examples:

| `seller_specs.name` pattern | `product_specs.name` |
|----------------------------|----------------------|
| `% ingredients` | `Ingredients (INCI list)` |
| `% Thumbnail URL` | `Primary product image URL` (if canonical exists) |
| `% Description` | `Product description` |

Verify canonical `product_specs` rows exist before seeding.

### 7. Audit script

`commerce-platform-backend/scripts/auditCatalogSpecCoverage.ts`:

- For each seller with `seller_products`, sample N products.
- Report: `% with thumbnail URL resolved`, `% with ≥2 top ingredients`, top missing spec names.
- Output JSON + markdown summary for before/after comparison.

---

## Test plan

| Test | Location |
|------|----------|
| `scoreThumbnailSpecName` prefers `CRX Thumbnail URL` over generic OY image path when scores tied | `src/__tests__/interactions/catalog/sellerSpecConventions.test.ts` |
| `resolveTopIngredientsFromSpecs` picks `JL ingredients` over description | `ingredientSpecResolution.test.ts` |
| `resolveTopIngredientsFromSpecs` parses INCI from `PL Description` HTML | same |
| Shared thumbnail resolver returns Shopify CDN URL from `WT Thumbnail URL` | same |
| `fetchIngredientSpecRows` query includes new name patterns | interaction test with factories (optional) |

Run: `cd commerce-platform-backend && npm run lint && npm run build && npm test`

---

## Rollout

1. Land backend scoring + shared resolver (immediate win for thumbnails on unmerged products).
2. Run `tagSpecs.ts` on staging.
3. Optionally land scraper ingredient extraction + targeted PDP re-enrich.
4. Run audit script before/after; attach results to ALE-76.

---

## TODO

- [x] Add `sellerSpecConventions.ts` with prefix registry + scoring helpers
- [x] Refactor `getProductThumbnailUrl.ts` and `getShoppingProductCardsBatch.ts` to use shared resolver
- [x] Extend `ingredientSpecResolution.ts` + `fetchIngredientSpecRows.ts` for new spec names
- [x] Add unit tests for scoring and ingredient resolution
- [x] Update `scripts/tagSpecs.ts` for new retailer spec name patterns
- [ ] Add `scripts/auditCatalogSpecCoverage.ts` and run on staging sample
- [x] (Optional) Shared `extractSectionFromHtml` in scrapers + `{PREFIX} ingredients` in Shopify mappers
- [ ] (Optional) Backend seed migration for `seller_spec_mappings`
- [x] Run `npm run lint`, `npm run build`, `npm test` in backend
- [x] Scrapers: shared Shopify PDP builder + ingredient extraction from `body_html`
- [x] Scrapers: `npm test` + `npm run build` in scrapers worktree
- [ ] PDP re-enrich / backfill existing products with new `{PREFIX} ingredients` specs
- [ ] Create PRs for backend + scrapers
