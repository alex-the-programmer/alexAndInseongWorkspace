# ALE-70 Scrape Skinglow Haven catalog integration

## Context

[Linear ALE-70](https://linear.app/dewly/issue/ALE-70/scrape-skinglow-haven-catalog-integration): add a **full retailer integration** for [Skinglow Haven](https://skinglowhaven.com/).

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook (BullMQ + upsert shape). This is the workspace’s **first WooCommerce** retailer — prefer the **WooCommerce Store REST API** over HTML scraping where possible.

**Branch:** `ALE-70-scrape-skinglow-haven-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — add Skinglow Haven row (not yet listed).
- [ALE-53](ALE-53-scrape-olive-young-us-catalog.md) — closest prior art for **JSON API listing ingest** (`oliveYoungUs.*`).
- [ALE-56](ALE-56-scrape-jolse-catalog-integration.md) — queue topology + upsert choke-point pattern (sitemap + category jobs).

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row; **possibly** `currencies` row for `GBP` if missing). **No new columns.** Architect approval required before applying migration.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `Skinglow Haven` as its own `sellers` row with UK storefront + `productUrlTemplate` |
| Listing ingest | Discover SKUs via WooCommerce Store API (+ sitemap cross-check); persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs from Store API product payload (description, images, categories, attributes) — phase after listing is stable |
| Operations | BullMQ namespace `skinglowHaven.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Roadmap | Add Skinglow Haven to `kBeautyRetailerRoadmap.md`; move **Planned** → **In progress** → **Done** |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges.
- Frontend changes.
- WooCommerce authenticated REST (`/wp-json/wc/v3/…` with consumer keys) — Store API is sufficient and unauthenticated today.
- Full taxonomy unification beyond staging category.
- Ingesting non-product WordPress content (posts, pages).

---

## Current state

### Skinglow Haven storefront (early spike — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **WordPress + WooCommerce** (`x-powered-by: PHP/7.4.33`, `cf-edge-cache: cache,platform=wordpress`, LiteSpeed) |
| SEO | **Rank Math** sitemaps (`sitemap_index.xml`) |
| CDN / edge | **Cloudflare** (`cf-cache-status: DYNAMIC` on API) — no bot wall on anonymous GETs from datacenter |
| Currency | **GBP** (`currency_code: "GBP"`, `£` prefix) — **not USD** |
| Store API | **`/wp-json/wc/store/v1/products`** returns **200** JSON without auth |
| Catalog size | **1,304** products (`X-WP-Total: 1304`, 14 pages @ `per_page=100`) |
| Product types (sample) | **`simple`** in first 100 — confirm variable/grouped in full spike |
| Product id | Numeric WooCommerce post **`id`** (e.g. `13837`) — merchant `sku` field often **empty** |
| Product URLs | Canonical slug: `/product/{slug}/` |
| Stable card URL | `https://skinglowhaven.com/?p={{sku}}` → **301** to canonical slug PDP |
| Sitemap | `product-sitemap1.xml` … `product-sitemap7.xml` (~1,304 product locs); `product_cat-sitemap.xml` for categories |
| Categories | 48 WooCommerce categories via Store API; top counts include Treatments/Serums (420), Lightening/Whitening Cream (308), Cleansers (90) |

**Ticket vs reality (spike gate):** Linear describes a **US-based K-beauty boutique**. The live storefront is **UK-priced (£)**, sells a **broad skincare catalog** (including lightening/bleaching, spiritual/Yoruba, African raw ingredients) — not a dedicated K-beauty marketplace like Jolse or StyleKorean. **Phase 0 must confirm retailer fit** and whether v1 ingests the **full catalog** or a **K-beauty–relevant category subset**.

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| Jolse | `jolse.*` | Gzip sitemaps + category HTML | `upsertProductFromJolseHit` |
| StyleKorean | `styleKorean.*` | Sitemaps + category HTML | `upsertProductFromStyleKoreanHit` |

Skinglow Haven should follow **`oliveYoungUs` job topology** (API listing) with **Jolse-style queue names** (sitemap + category fan-out for redundancy).

`queueNames.ts` today has no `skinglowHaven.*` namespace.

### Backend card links

Skinglow Haven will be **`linkable = true`**. Card PDP URLs use `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)` with `?p=` template.

---

## Gap analysis

| Area | Today | Skinglow Haven target (ALE-70) |
|------|-------|--------------------------------|
| `sellers` row | None | **`Skinglow Haven`** + UK `sellerCountryId` + `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / Skinglow Haven`** |
| SKU key | N/A | Numeric WooCommerce **`id`** (stringified) |
| Listing discovery | N/A | **Store API paginated products** + optional category filter |
| Scraper package | N/A | **`src/scrapers/skinglowHaven/*`** |
| Queue namespace | N/A | **`skinglowHaven.*`** |
| HTTP client | No Skinglow host rules | Throttle for `skinglowhaven.com`; Chrome UA if needed |
| Currency helper | `findUsdCurrency` only | Add **`findGbpCurrency`** (or env `SKINGLOW_HAVEN_CURRENCY_NAME`) |
| WooCommerce integration | None | **First** in repo |

---

## Design decisions

### 1. UK storefront, GBP pricing (proposed — confirm in spike)

- `sellerCountryId` → `countries` row **`United Kingdom`** (if seeded).
- Prices from Store API `prices.price` are **minor units** (`currency_minor_unit: 2` → divide by 100 for display amount).
- Migration must **INSERT `currencies` row `GBP`** if not present (architect approval).

### 2. Queue namespace `skinglowHaven.*` (locked)

Mirror Jolse / StyleKorean queue set:

```ts
skinglowHaven.sellerCategoryHierarchy
skinglowHaven.sellerCategoryMapping
skinglowHaven.categoryProducts
skinglowHaven.sitemapProducts
skinglowHaven.product
skinglowHaven.productPdp
```

Worker concurrency: **`skinglowHaven.product` and `skinglowHaven.productPdp` at 1** initially.

### 3. `Product.sku` = WooCommerce post `id` (proposed)

Use stringified numeric `id` from Store API (e.g. `"13837"`). Do **not** use empty merchant `sku` or slug (slugs change; ids are stable).

### 4. `Seller.productUrlTemplate` (proposed)

```text
https://skinglowhaven.com/?p={{sku}}
```

Verified: **301** redirect to canonical `/product/{slug}/` PDP.

### 5. API-first listing, sitemap as secondary (proposed)

**Primary:** paginate `GET /wp-json/wc/store/v1/products?per_page=100&page=N` using `X-WP-TotalPages`.

**Secondary:**

- Walk `product-sitemap*.xml` to enqueue any SKUs missed by API pagination drift.
- `GET /wp-json/wc/store/v1/products/categories` → seed `seller_categories`; `categoryProducts` job fetches `?category={id}` pages.

**Priority:** API catalog sweep jobs > category jobs > sitemap jobs (`skinglowHavenProductIngestPriorities` mirroring StyleKorean).

### 6. Brand extraction (spike → lock)

Store API payloads often lack a dedicated brand field. Spike options (pick one):

- Parse brand from product **name** prefix heuristics (weak).
- Map from **tags** / **categories** when brand-like.
- Default **`Unknown brand`** for v1 (same as other retailers).

### 7. Spec prefix `SGH ` (proposed)

PDP-derived specs use prefix **`SGH `** (e.g. `SGH Description`, `SGH Thumbnail URL`, `SGH Categories`) for manual curation batches.

### 8. Catalog scope (product decision — spike gate)

| Option | Tradeoff |
|--------|----------|
| **Full catalog (~1,304 SKUs)** | Complete retailer mirror; includes non–K-beauty SKUs |
| **Category filter** | Smaller, more relevant set; requires locked category id list |

Default recommendation pending spike: **full catalog** for mechanical completeness; taxonomy filtering is a separate curation job.

---

## Phase 0 — Spike (gate before bulk ingest)

**Deliverable:** `commerce-platform-scrapers/docs/skinglowHavenSpike.md`.

**Checklist:**

1. Run `npm run probe:storefronts -- https://skinglowhaven.com/` and record friction.
2. Confirm Store API remains **200** from production scraper network (not just local curl).
3. Document pagination: `X-WP-Total`, `X-WP-TotalPages`, max `per_page`, rate-limit behavior.
4. Sample 3 product types: `simple`, `variable`, `grouped` (if any) — lock upsert strategy (parent id vs variation ids).
5. Lock brand extraction rule from API fields.
6. Confirm **GBP** currency row exists in target DB; document migration if not.
7. Confirm **United Kingdom** country row exists for `sellerCountryId`.
8. Compare sitemap product count vs `X-WP-Total` — note drift policy.
9. Test Cloudflare under sustained pagination (14+ requests) — tune `SKINGLOW_HAVEN_REQUEST_DELAY_MS`.
10. **Retailer fit:** Document catalog composition vs K-beauty goals; recommend full vs filtered ingest.
11. Check reviews: `review_count` in Store API — defer `ProductReview` ingest unless stable review endpoint found.

**Debug script (add in spike PR):** `scripts/debugSkinglowHavenUrls.ts` — prints first page of Store API products + sitemap sample without DB writes.

**Early spike observations (June 2026 — replace with spike doc):**

- Homepage + Store API: **200 OK** from Node curl.
- **1,304** products; **48** categories.
- **GBP** pricing; UK storefront — contradicts ticket “US warehouse” note.
- Catalog is **not** K-beauty–exclusive — spike must confirm product intent.

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.

### Schema change

**None** — reuse existing `sellers`, `product_categories`, `currencies`, `countries` tables.

### Data changes (migration SQL)

| Table | Action |
|-------|--------|
| `currencies` | **INSERT** `GBP` row **if not exists** (spike confirms current state) |
| `sellers` | **INSERT** row: `name = 'Skinglow Haven'`, `linkable = true`, `sellerCountryId` → UK `countries` row, `productUrlTemplate` = `https://skinglowhaven.com/?p={{sku}}` |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / Skinglow Haven'`, `categoryKind = STAGING` |

**Migration naming:** `ale_70_skinglow_haven_seller_and_staging_category`

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `SKINGLOW_HAVEN_SELLER_NAME`, `SKINGLOW_HAVEN_STAGING_PRODUCT_CATEGORY_NAME`, `SKINGLOW_HAVEN_SITE_BASE_URL`, `SKINGLOW_HAVEN_STORE_API_BASE`, throttle knobs |
| Entity resolvers | `ensureCommerceEntities.ts` — `findSkinglowHavenSeller`, `findStagingProductCategoryForSkinglowHaven`, `findGbpCurrency` |
| Constants | `src/scrapers/skinglowHaven/skinglowHavenConstants.ts` |
| Store API client | `src/scrapers/skinglowHaven/fetchSkinglowHavenStoreApi.ts` — typed GET + pagination headers |
| Queue names | `queueNames.ts` — `skinglowHavenQueueNames`, `skinglowHavenProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` |
| HTTP client | `httpClient.ts` — throttle for `skinglowhaven.com` |
| HTTP routes | `server.ts` — `POST /jobs/skinglow-haven/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products`, `…/catalog-products`, `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Add `https://skinglowhaven.com/` to `scripts/probeRetailerStorefronts.ts` defaults |
| `.env.example` | Document all new knobs |

---

## Phase 3 — Listing ingest

| Component | Purpose |
|-----------|---------|
| `fetchSkinglowHavenCatalogPage.ts` | Paginate Store API products list |
| `fetchSkinglowHavenCategoryProductsPage.ts` | `?category={id}&page=N` |
| `collectSkinglowHavenProductIdsFromSitemaps.ts` | Walk `product-sitemap*.xml`; extract ids from `/product/{slug}/` locs (slug → id via API or loc-only enqueue) |
| `discoverSkinglowHavenSellerCategoryNodes.ts` | Seed `seller_categories` from Store API categories |
| `storeApiProductToListingFields.ts` | Map JSON → upsert payload (name, price minor units → GBP, image, categories) |
| `summarizeSkinglowHavenListingFields.ts` | Typed summary |
| `upsertProductFromSkinglowHavenHit.ts` | Single DB choke point (mirror `upsertProductFromOliveYoungUsHit`) |
| Jobs | `sellerCategoryHierarchy`, `sellerCategoryMapping`, `scrapeCategoryProducts`, `scrapeSitemapProducts`, `scrapeCatalogProducts`, `scrapeProduct` |

**New job vs other retailers:** `scrapeCatalogProducts` — fans out Store API pagination (no Olive Young US equivalent name; could alias `scrapeAllProducts`).

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/skinglow-haven/seller-category-hierarchy
# POST /jobs/skinglow-haven/catalog-products  { "maxPages": 1 }
# POST /jobs/skinglow-haven/sitemap-products  { "maxProducts": 20 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from API smoke; `seller_products` + `seller_product_prices` in **GBP** for `Skinglow Haven`; `buildSellerProductPageUrl` returns valid links.

---

## Phase 4 — PDP + spec enrichment

Store API single-product `GET /wp-json/wc/store/v1/products/{id}` may duplicate listing fields — enrichment job still worthwhile for:

- Long `description` HTML → `SGH Description` spec
- Full `images[]` → `SGH Thumbnail URL` + gallery JSON blob
- `categories`, `tags`, `attributes` → facet specs
- `review_count` / `average_rating` → summary fields (not full review text unless endpoint found)

| Component | Purpose |
|-----------|---------|
| `fetchSkinglowHavenProductPdp.ts` | Store API product by id |
| `mapSkinglowHavenPdpToSpecRows.ts` | `ProductSellerSpec` rows; prefix `SGH ` |
| `enrichProductPdp.ts` job | One job per product id; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | Keyset batch → `addBulk` |

---

## Phase 5 — Docs + roadmap

| Task | Location |
|------|----------|
| Spike notes | `docs/skinglowHavenSpike.md` |
| Roadmap row | `docs/kBeautyRetailerRoadmap.md` — add Skinglow Haven (priority TBD after product review) |
| Playbook cross-link | Paragraph in `retailerScrapingPlaybook.md` (WooCommerce Store API pattern) |
| Queue hygiene script | `scripts/skinglowHavenProductQueue.ts` (optional) |

---

## Test plan

### Scrapers

- Unit tests for `storeApiProductToListingFields` with **fixture JSON** from spike.
- Unit tests for price minor-unit → decimal conversion (GBP).
- Unit test for sitemap loc parsing (if slug-only extraction used).
- Unit test for `upsertProductFromSkinglowHavenHit` with mocked prisma.
- Manual: catalog smoke 20 products; verify Bull Board + DB rows.

### Backend

- Manually verify seller + GBP currency rows after migrate.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build`

---

## Risks

| Risk | Mitigation |
|------|------------|
| Ticket describes wrong retailer / locale | Spike doc + product sign-off before bulk ingest |
| Catalog not K-beauty–focused | Document in roadmap; optional category filter in v2 |
| Store API disabled or rate-limited | Sitemap fallback; throttle; concurrency 1 |
| Cloudflare blocks datacenter IPs | Monitor 403; optional cookie env knob |
| `GBP` / UK country missing in DB | Migration inserts; spike verifies |
| Empty merchant SKU | Use WooCommerce post `id` only |
| Variable products | Spike types; upsert variations or parent-only policy |
| HTML descriptions with unsafe content | Store as spec text; no server-side render in v1 |
| Architect rejects seed timing | Spike + doc review before DDL |

---

## Implementation TODO

- [x] **Phase 0:** Complete spike; write `docs/skinglowHavenSpike.md`; add `debugSkinglowHavenUrls.ts`
- [x] **Phase 0:** Confirm retailer fit, catalog scope (full vs filtered), brand rule, product types — **full catalog v1**; brand from name heuristic; simple products confirmed in spike
- [x] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, GBP price mapping
- [x] **Phase 1:** Architect approval for seller + staging category (+ GBP if needed) migration
- [x] **Phase 1:** Apply migration; `db:pull` in scrapers (migration applied to local DB)
- [x] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [x] **Phase 3:** Store API catalog + category listing + `upsertProductFromSkinglowHavenHit`; smoke ingest (1 page / 100 products on PORT=3190)
- [ ] **Phase 3:** Unit tests for mappers/upsert (scrapers repo has no test runner yet)
- [x] **Phase 4:** PDP enrichment job + spec mapping + enqueue-all routes
- [ ] **Phase 4:** Unit tests for PDP mappers
- [x] **Phase 5:** Update `kBeautyRetailerRoadmap.md` and playbook cross-link
