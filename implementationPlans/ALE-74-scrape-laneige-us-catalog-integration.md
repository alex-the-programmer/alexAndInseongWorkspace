# ALE-74 Scrape Laneige US catalog integration

## Context

[Linear ALE-74](https://linear.app/dewly/issue/ALE-74/scrape-laneige-us-catalog-integration): add a **full seller integration** for the [Laneige US official brand storefront](https://us.laneige.com/).

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook. Laneige US is a **single-brand Shopify store** — reuse the shared `src/scrapers/shopify/` platform layer from [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) instead of reimplementing sitemap/JSON logic.

**Branch:** `ALE-74-scrape-laneige-us-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — Laneige US is **not yet listed** (official brand store; add under candidates or a new “brand official stores” subsection).
- [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) — **hard dependency**: shared Shopify platform layer (`shopify/`) + reference retailer wiring (`sokoGlam/`).
- [ALE-69](ALE-69-scrape-cosrx-us-catalog-integration.md) — closest parallel (second official-brand Shopify adapter; thin copy pattern).
- Linear relation: **related to** ALE-58 (Soko Glam).

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

**Prerequisite:** Land ALE-58’s `src/scrapers/shopify/` module before starting Phase 2. If not on `main`, merge or cherry-pick first; do not duplicate Shopify fetch/parse code into `laneigeUs/`.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `Laneige US` as its own `sellers` row with US `productUrlTemplate` |
| Listing ingest | Discover SKUs via product sitemap + collection JSON; persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs from Shopify product JSON (`body_html`, `tags`, `product_type`, images) via shared `shopify/` mappers |
| Operations | BullMQ namespace `laneigeUs.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Shopify reuse | **No new platform code** unless spike finds a Laneige-only protocol gap; thin `laneigeUs/` folder only |
| Roadmap | Document Laneige US in `kBeautyRetailerRoadmap.md` (candidates / brand-official section) → **Done** when ingest ships |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges (Laneige products also sold on Olive Young, Soko Glam, etc.).
- Frontend changes.
- Laneige KR / global storefronts — ingest **US** (`us.laneige.com`, `localization=US`) only.
- Spanish locale (`/es/…`) sitemap locs and localized PDPs — **exclude** from ingest.
- Full taxonomy unification beyond staging category.
- Shopify **UCP/MCP** agent checkout APIs — catalog-only HTTP JSON is sufficient for scrapers.
- Per-variant `Product` rows unless spike proves parent-product pricing is unusable for cards (Lip Sleeping Mask has many shade/size variants — default to parent product + min variant price).
- Blog / editorial content ingest.

---

## Current state

### Laneige US storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **Shopify** (`shopify-complexity-score` headers, `cdn.shopify.com` preconnect) |
| CDN | `cdn.shopify.com` for product media; theme assets on `us.laneige.com/cdn/shop/` |
| Bot wall | **Cloudflare** (`cf-ray`, `cf-cache-status`); anonymous GETs return **200** for sitemap and JSON endpoints |
| Canonical host | **`https://us.laneige.com/`** (subdomain storefront; no `www` prefix) |
| Sitemap index | `https://us.laneige.com/sitemap.xml` → `sitemap_products_1.xml`, `sitemap_collections_1.xml`, pages, blogs, `sitemap_agentic_discovery.xml`, **plus duplicate `/es/…` child sitemaps** |
| Product catalog size | ~**137** `<loc>` entries in `sitemap_products_1.xml` (~**136** PDPs + root `/`) |
| Collection catalog size | ~**70** collection URLs in `sitemap_collections_1.xml` |
| Product URLs | `/products/{handle}` e.g. `/products/lip-sleeping-mask` |
| Collection URLs | `/collections/{handle}` e.g. `/collections/all-products`, `/collections/water-bank` |
| Product JSON | `GET /products/{handle}.json` → full Shopify product payload — **200** from Node |
| Collection JSON | `GET /collections/all-products/products.json?limit=250&page=N` — **200**; some handles (e.g. `skincare`, `moisturizers`) return **0** products — spike must finalize exclude list |
| Variants | Multi-variant products common (e.g. Lip Sleeping Mask: **14** variants) |
| Brand field | Shopify `vendor` = **`APUS - Laneige`** — normalize to **`Laneige`** in upsert (single-brand store) |
| Currency | USD (`cart_currency=USD`, `localization=US`) |

**Implication:** Laneige US is structurally identical to Soko Glam / COSRX US for scraper purposes. ALE-74 should be a **thin retailer adapter** on top of `shopify/`. Retailer-specific logic: **brand normalization** (`APUS - Laneige` → `Laneige`), **locale filtering** (skip `/es/` sitemap locs), and **collection exclude regex** (empty `products.json` collections, gift sets, marketing landers).

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| Jolse | `jolse.*` | Gzip product sitemaps + category HTML | `upsertProductFromJolseHit` |
| Soko Glam | `sokoGlam.*` | Product sitemap + collection JSON | `upsertProductFromSokoGlamHit` |
| YesStyle | `yesStyle.*` | Category sitemap + HTML (blocked by default) | `upsertProductFromYesStyleHit` |

Laneige US should **copy the Soko Glam / COSRX US wiring shape** and call the same `shopify/` helpers with `siteBaseUrl = https://us.laneige.com`.

`queueNames.ts` today defines namespaces for `oliveYoung`, `yesStyle`, `styleKorean`, `jolse`, `oliveYoungUs`, and (after ALE-58) `sokoGlam` — Laneige US adds `laneigeUs.*`.

### Backend card links

Laneige US will be **`linkable = true`** (default). Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | Laneige US target (ALE-74) |
|------|-------|----------------------------|
| `sellers` row | None | **`Laneige US`** + US `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / Laneige US`** |
| SKU key | N/A | Shopify product **`handle`** (slug string) — same as Soko Glam |
| Listing discovery | N/A | Reuse `shopify/collectProductHandlesFromSitemaps` + `fetchShopifyCollectionProductsPage` |
| Fetch layer | Exists after ALE-58 | **Reuse `shopify/` unchanged** (may need optional `localePathPrefix` filter in sitemap collector if not already in ALE-58) |
| Brand mapping | N/A | Normalize `vendor` **`APUS - Laneige`** → brand **`Laneige`** |
| Locale filtering | N/A | Skip sitemap locs under `/es/` and non-US hosts |
| Scraper package | N/A | **`src/scrapers/laneigeUs/*`** (jobs, constants, upsert, spec prefix) only |
| Queue namespace | N/A | **`laneigeUs.*`** |
| HTTP client | No `us.laneige.com` host rules | Throttle + optional cookie + UA override (Cloudflare) |

---

## Design decisions

### 1. US storefront only, canonical base `https://us.laneige.com` (proposed)

- Standardize env `LANEIGE_US_SITE_BASE_URL` on **`https://us.laneige.com`** (no `www`).
- Sitemap `<loc>` values use `us.laneige.com`; product/collection JSON paths are host-relative.
- **Exclude** `/es/` paths from sitemap walks (Spanish locale duplicate sitemaps in index).

### 2. Queue namespace `laneigeUs.*` (locked)

Mirror Soko Glam / COSRX US queue set:

```ts
laneigeUs.sellerCategoryHierarchy
laneigeUs.sellerCategoryMapping
laneigeUs.categoryProducts
laneigeUs.sitemapProducts
laneigeUs.product
laneigeUs.productPdp
```

Worker concurrency: **`laneigeUs.product` and `laneigeUs.productPdp` at 1** initially.

### 3. `Product.sku` = Shopify product `handle` (proposed — confirm in spike)

Same rationale as Soko Glam:

- Sitemap PDP loc: `/products/{handle}`
- Collection JSON: `product.handle`
- Product JSON: `product.handle`

`buildSellerProductPageUrl` uses `https://us.laneige.com/products/{{sku}}`.

### 4. One `Product` row per Shopify product, not per variant (proposed)

- Upsert **one** commerce `Product` per Shopify parent product (`handle`).
- **Price** on `seller_product_prices`: **minimum** `variant.price` among **available** variants (reuse `shopify/minAvailableVariantPrice.ts`).
- Store variant count / option summary in listing specs if useful (`LG Variant count`, `LG Options`).
- Lip Sleeping Mask–style multi-shade catalogs are the main reason to document this rule in spike.

### 5. `Seller.productUrlTemplate` (proposed)

```text
https://us.laneige.com/products/{{sku}}
```

where `{{sku}}` is the product `handle`.

### 6. Brand normalization — `APUS - Laneige` → `Laneige` (locked intent)

- Shopify `vendor` is **`APUS - Laneige`** on sampled PDPs (Amorepacific US entity).
- In `upsertProductFromLaneigeUsHit`, map vendor to brand name **`Laneige`** via `laneigeUsConstants.ts` allowlist / suffix strip.
- Do **not** create a separate brand row per vendor string variant.

### 7. Listing before PDP (locked)

**Phase A** — sitemap + collection JSON → `upsertProductFromLaneigeUsHit` (brand, product, seller_product, price, listing specs from product JSON).

**Phase B** — `laneigeUs.productPdp` enrichment for `body_html` flattening, tags, images once listing is stable.

Because Shopify `.json` returns rich PDP fields, Phase A jobs should fetch product JSON (not sitemap-only stubs) unless queue pressure requires a two-step split.

### 8. HTTP client reuse + Laneige US host rules (locked)

Extend `src/lib/httpClient.ts`:

- `LANEIGE_US_REQUEST_DELAY_MS` throttle for `us.laneige.com`
- `LANEIGE_US_BROWSER_COOKIE` optional cookie injection
- Chrome desktop UA substitution when `SCRAPER_USER_AGENT` is the default bot string

Default throttle ≥ **700ms** (same starting point as Soko Glam).

### 9. Sitemap-first ingest with collection enrichment (proposed)

1. **Product sitemap walk** — reuse `shopify/collectProductHandlesFromSitemaps`; skip root `/` loc, `/es/` locs, and non-product paths.
2. **Collection discovery** — reuse `shopify/collectCollectionHandlesFromSitemaps` → `seller_categories` rows. Apply Laneige-specific exclude regex (collections with empty `products.json`, gift/set landers, SEO hubs — spike to finalize).
3. **Category products job** — paginate `GET /collections/{handle}/products.json?limit=250&page=N`; skip or log collections that return zero products.

**Priority:** sitemap jobs > collection listing jobs (`laneigeUsProductIngestPriorities` mirroring Soko Glam).

### 10. Collection hierarchy — flat v1 (proposed)

Same as Soko Glam: flat `seller_categories` from collections sitemap; `parentSellerCategoryId = null` unless spike documents a reliable nav-based parent map.

### 11. Spec prefix `LG ` (proposed)

PDP-derived specs use prefix **`LG `** (e.g. `LG Thumbnail URL`, `LG Description`, `LG Product type`, `LG Tags`) — mirror `SG ` / `CRX ` / `WT ` conventions.

### 12. Reuse `shopify/` — do not fork (locked)

| Layer | Location | ALE-74 action |
|-------|----------|---------------|
| Sitemap walk, JSON fetch, listing/PDP mappers | `src/scrapers/shopify/*` | **Reuse as-is** from ALE-58 |
| BullMQ jobs, upsert, spec prefix, env, routes | `src/scrapers/laneigeUs/*` | **Copy/adapt from `sokoGlam/` or `cosrxUs/`** with find-replace |
| Unit tests for Shopify protocol | `shopify/__fixtures__/` | Add Laneige fixtures **only** if JSON shape differs; otherwise reuse Soko Glam fixtures |

If spike finds a Laneige-only gap (e.g. `/es/` loc filtering not yet in shared sitemap collector), extend `shopify/` in a **retailer-agnostic** way — never import `LANEIGE_US_*` env inside `shopify/`.

**Suggested `laneigeUs/` layout (thin):**

```text
src/scrapers/laneigeUs/
  laneigeUsConstants.ts                  # spec prefix, brand normalize map, collection exclude regex, locale exclude
  normalizeLaneigeUsBrandName.ts         # APUS - Laneige → Laneige
  summarizeLaneigeUsListingFields.ts
  upsertProductFromLaneigeUsHit.ts       # Prisma choke point (copy sokoGlam upsert + brand normalize)
  mapLaneigeUsProductJsonToSpecRows.ts   # applies LG prefix
  jobs/
    sellerCategoryHierarchy.ts
    sellerCategoryMapping.ts
    scrapeCategoryProducts.ts
    scrapeSitemapProducts.ts
    scrapeProduct.ts
    enrichProductPdp.ts
    enqueueAllProductPdpEnrichJobs.ts
```

---

## Phase 0 — Spike (gate before bulk ingest)

**Deliverable:** `commerce-platform-scrapers/docs/laneigeUsSpike.md` (same shape as `sokoGlamSpike.md` / `cosrxUsSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://us.laneige.com/` and record friction.
2. Confirm product sitemap walk end-to-end from Node; count product PDP URLs (~136 expected); confirm `/es/` locs are excluded.
3. Lock regex for `handle` extraction; confirm identical to Soko Glam `/products/{handle}` shape.
4. Enumerate collections from sitemap; propose exclude list (empty `products.json` handles, gift sets, `skin-concern` hub collections).
5. From `all-products` (pages 1–2) and one multi-variant PDP JSON (`lip-sleeping-mask`), capture:
   - product name, brand (`vendor`), min price, compare-at price, thumbnail, availability
   - pagination termination for `products.json`
6. Confirm **parent product vs per-variant** `Product` rows (default: parent product).
7. Confirm **`vendor` normalization** — document all distinct `vendor` strings (expect `APUS - Laneige`).
8. Test Chrome UA + optional cookie from production scraper hosts (JSON should remain sufficient).
9. Lock `productUrlTemplate`, `Product.sku` field, and JSON field mapping (expect same as Soko Glam).
10. Note review widget presence — defer review ingest unless spike finds stable public endpoint.
11. Document 429/403 behavior and recommended `LANEIGE_US_REQUEST_DELAY_MS`.
12. Skim `https://us.laneige.com/agents.md` if present — document UCP/MCP for future agents; **do not** depend on it for v1 scrapers.
13. **Diff vs Soko Glam:** explicitly list anything that requires `shopify/` changes (expect at most locale-path filter on sitemap locs).

**Debug script (add in spike PR):** `scripts/debugLaneigeUsUrls.ts` — prints sample handles from product sitemap + one collection `products.json` page without DB writes (thin fork of `debugSokoGlamUrls.ts`).

**Early spike observations (June 2026 — replace with spike doc):**

- Sitemap + product/collection JSON: **200 OK** from Node `curl` with Chrome UA.
- ~**136** product URLs, ~**70** collections (US locs only).
- `GET /products/lip-sleeping-mask.json` returns **14** variants, `vendor: APUS - Laneige`, price `24.00`.
- `GET /collections/all-products/products.json?limit=5` returns paginated products.
- Sitemap index includes **`/es/`** duplicate child sitemaps — must filter for US ingest.
- Some collection handles return **empty** `products.json` — exclude in spike.

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.

### Schema change

**None** — reuse existing `sellers`, `product_categories`, `currencies` tables.

### Data changes (migration SQL)

| Table | Action |
|-------|--------|
| `sellers` | **INSERT** row: `name = 'Laneige US'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = `https://us.laneige.com/products/{{sku}}` |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / Laneige US'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_74_laneige_us_seller_and_staging_category`

Mirror the idempotent insert pattern from `ale_58_soko_glam_seller_and_staging_category` (US country lookup with `NULL` fallback).

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs a Laneige-specific branch after PDP specs exist (see Phase 5).

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`  
**Prerequisite:** ALE-58 `shopify/` on branch.

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `LANEIGE_US_SELLER_NAME`, `LANEIGE_US_STAGING_PRODUCT_CATEGORY_NAME`, `LANEIGE_US_SITE_BASE_URL`, `LANEIGE_US_SITEMAP_INDEX_URL`, throttle knobs, optional cookie, `LANEIGE_US_COLLECTION_PRODUCTS_PAGE_SIZE` (default 250), collection exclude regex, optional `LANEIGE_US_SITEMAP_LOCALE_EXCLUDE_PREFIX` (default `/es/`) |
| Entity resolvers | `ensureCommerceEntities.ts` — `findLaneigeUsSeller`, `findStagingProductCategoryForLaneigeUs` |
| Constants | `src/scrapers/laneigeUs/laneigeUsConstants.ts` — spec prefix, brand normalize map, default collection exclude regex |
| Retailer package | `src/scrapers/laneigeUs/*` — thin; jobs call `shopify/` with `siteBaseUrl` from env |
| Queue names | `queueNames.ts` — `laneigeUsQueueNames`, `laneigeUsProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; stub `productPdp` worker OK initially |
| HTTP client | `httpClient.ts` — throttle, cookie, UA override for `us.laneige.com` |
| HTTP routes | `server.ts` — `POST /jobs/laneige-us/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products`, `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Add `https://us.laneige.com/` to `scripts/probeRetailerStorefronts.ts` default URL list |
| `.env.example` | Document all new knobs |

---

## Phase 3 — Listing ingest

Implement after spike doc is approved.

| Component | Location | Purpose |
|-----------|----------|---------|
| `collectProductHandlesFromSitemaps.ts` | **`shopify/`** | Reuse unchanged (or pass locale exclude filter) |
| `collectCollectionHandlesFromSitemaps.ts` | **`shopify/`** | Reuse unchanged |
| `fetchShopifyProductJson.ts` | **`shopify/`** | Reuse unchanged |
| `mapShopifyProductJsonToListingFields.ts` | **`shopify/`** | Reuse unchanged |
| `discoverLaneigeUsSellerCategoryNodes.ts` | `laneigeUs/` | Job glue + exclude regex → `seller_categories` |
| `normalizeLaneigeUsBrandName.ts` | `laneigeUs/` | `APUS - Laneige` → `Laneige` |
| `summarizeLaneigeUsListingFields.ts` | `laneigeUs/` | Typed summary for upsert |
| `upsertProductFromLaneigeUsHit.ts` | `laneigeUs/` | Single DB choke point |
| Jobs | `laneigeUs/jobs/` | Mirror `sokoGlam/jobs/`; concurrency **1** |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/laneige-us/seller-category-hierarchy
# POST /jobs/laneige-us/sitemap-products  { "maxProducts": 20 }
# POST /jobs/laneige-us/category-products  { "maxSellerCategories": 1 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from sitemap smoke; `seller_products` + `seller_product_prices` rows visible for `Laneige US`; brand name **`Laneige`**; `buildSellerProductPageUrl` returns valid `us.laneige.com` links for smoke handles.

**Full catalog note:** ~136 SKUs — a full sitemap ingest is feasible in a single session after spike approval.

---

## Phase 4 — PDP + spec enrichment

| Component | Location | Purpose |
|-----------|----------|---------|
| `mapShopifyProductJsonToPdpFields.ts` | **`shopify/`** | Reuse unchanged |
| `mapLaneigeUsProductJsonToSpecRows.ts` | `laneigeUs/` | Wraps shared PDP fields → `ProductSellerSpec` rows with **`LG `** prefix |
| `enrichProductPdp.ts` job | `laneigeUs/jobs/` | Re-fetch via `fetchShopifyProductJson`; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | `laneigeUs/jobs/` | Keyset batch from Postgres → `addBulk` |
| Reviews | — | **Optional v1** — only ingest if spike finds stable Yotpo/Judge.me public API |

---

## Phase 5 — Docs + roadmap + backend follow-ups

| Task | Location |
|------|----------|
| Spike notes | `docs/laneigeUsSpike.md` |
| Roadmap | `docs/kBeautyRetailerRoadmap.md` — add Laneige US under **Candidates pool** or new **Brand official stores** row with status **Done** when shipped |
| Playbook | No new subsection required if Shopify retailers section exists from ALE-58; add one-line cross-link if missing |
| Queue hygiene script | `scripts/laneigeUsProductQueue.ts` (optional; copy Soko Glam script) |
| Thumbnails | `getProductThumbnailUrl` — `images[0].src` from `LG Thumbnail URL` spec or Shopify CDN fallback |

---

## Test plan

### Scrapers

- Reuse **`shopify/`** unit tests from ALE-58; add Laneige fixtures only if JSON shape differs.
- Unit test for `normalizeLaneigeUsBrandName` (`APUS - Laneige` → `Laneige`).
- Unit test for `upsertProductFromLaneigeUsHit` with mocked prisma (match Soko Glam test style).
- Manual: sitemap smoke 20 products; full-catalog run optional (~136 SKUs); verify Bull Board completion; query DB for seller name + URL template + brand `Laneige`.

### Backend

- No migration logic tests required beyond existing patterns; manually verify seller row after migrate.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build` (includes `prisma generate`)

---

## Risks

| Risk | Mitigation |
|------|------------|
| ALE-58 `shopify/` not on `main` | Hard prerequisite; cherry-pick before Phase 2 |
| `/es/` sitemap locs inflate SKU count | Filter locale prefix in sitemap walk; document in spike |
| `vendor` string changes | Small allowlist + fallback strip `APUS - ` prefix |
| Empty `products.json` collections | Exclude regex; log skips in category job |
| Multi-variant pricing on cards | Min available variant price; spike Lip Sleeping Mask PDP |
| `handle` changes break old SKUs | Rare; monitor 404 on JSON fetch; optional `LG Shopify product id` spec |
| Cloudflare tightens bot rules | Chrome UA + optional cookie; Playwright fallback only if JSON blocked |
| SKU collision with another retailer | Handles are retailer-specific strings; monitor uniqueness in smoke |
| Cross-retailer Laneige dedupe | Out of scope v1; same brand sold elsewhere is expected |
| Architect rejects seed timing | Spike + doc review before DDL |

---

## Implementation TODO

- [x] **Phase 0:** Complete spike; add `debugLaneigeUsUrls.ts` (spike notes captured in this plan + debug script output)
- [x] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, variant pricing rule, brand normalization, locale exclude, and collection exclude list
- [x] **Phase 0:** Confirm `products.json` pagination (`page` param, max `limit`, termination) — same as other Shopify retailers
- [x] **Phase 0:** Diff vs Soko Glam — added shared `sitemapLocExclusions` + optional `excludeLocPathPrefixes` on sitemap collectors for `/es/`
- [ ] **Phase 1:** Architect approval for Laneige US seller + staging category seed migration
- [x] **Phase 1:** Apply migration locally; scrapers build uses backend schema
- [x] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [x] **Phase 2:** Implement `src/scrapers/laneigeUs/*` + `src/jobs/laneigeUs/*`; jobs call `shopify/` with `siteBaseUrl` from env
- [x] **Phase 3:** Sitemap + collection JSON fetch + `upsertProductFromLaneigeUsHit`; full ingest (136 products via sitemap)
- [x] **Phase 4:** PDP enrichment — 136/136 products with `LG …` specs (full run 2026-06-12)
- [x] **Phase 5:** Probe defaults + `.env.example` Laneige US block
- [ ] **Phase 5:** Update `kBeautyRetailerRoadmap.md` (Laneige US entry)
- [ ] **Follow-up:** Thumbnail resolver fallback after ingest (if needed)
