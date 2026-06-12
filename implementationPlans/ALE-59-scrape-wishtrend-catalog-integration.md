# ALE-59 Scrape Wishtrend catalog integration

## Context

[Linear ALE-59](https://linear.app/dewly/issue/ALE-59/scrape-wishtrend-catalog-integration): add a **full retailer integration** for [Wishtrend](https://wishtrend.com/) (priority **7** on the K-beauty retailer roadmap).

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook. Wishtrend is the **second Shopify retailer** after Soko Glam — reuse the shared `src/scrapers/shopify/` platform layer introduced in [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) instead of reimplementing sitemap/JSON logic.

**Branch:** `ALE-59-scrape-wishtrend-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — Wishtrend row (currently **Planned**).
- [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) — **hard dependency**: shared Shopify platform layer (`shopify/`) + reference retailer wiring (`sokoGlam/`).
- [ALE-56](ALE-56-scrape-jolse-catalog-integration.md) — recent Cafe24 integration (queue topology reference).

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

**Prerequisite:** Merge or cherry-pick ALE-58’s `src/scrapers/shopify/` module before starting Phase 2. If ALE-58 is not landed, implement only Phase 0 spike + backend migration prep; do not duplicate Shopify fetch/parse code into `wishtrend/`.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `Wishtrend` as its own `sellers` row with US `productUrlTemplate` |
| Listing ingest | Discover SKUs via product sitemap + collection JSON; persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs from Shopify product JSON (`body_html`, `tags`, `product_type`, images) via shared `shopify/` mappers |
| Operations | BullMQ namespace `wishtrend.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Shopify reuse | **No new platform code** unless spike finds a Wishtrend-only protocol gap; thin `wishtrend/` folder only |
| Roadmap | Move Wishtrend from **Planned** → **Done** in `kBeautyRetailerRoadmap.md` |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges.
- Frontend changes.
- Non-US Shopify markets / localized storefront paths — ingest **US** (`wishtrend.com`) only.
- Full taxonomy unification beyond staging category.
- Shopify **UCP/MCP** agent checkout APIs (`/api/ucp/mcp`, `agents.md`) — catalog-only HTTP JSON is sufficient for scrapers.
- Per-variant `Product` rows (YesStyle-style) unless spike proves parent-product pricing is unusable for cards.
- Wishtrend blog / editorial content ingest.

---

## Current state

### Wishtrend storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **Shopify** (`powered-by: Shopify`, `shopify-complexity-score` headers) |
| CDN | `cdn.shopify.com` for product media |
| Bot wall | **Cloudflare** (`cf-ray`, `server: cloudflare`); anonymous GETs return **200** for sitemap and JSON endpoints |
| Canonical host | `www.wishtrend.com` **301** → `https://wishtrend.com/` (`x-redirect-reason: canonical_host_redirection`) |
| Sitemap index | `https://wishtrend.com/sitemap.xml` → `sitemap_products_1.xml`, `sitemap_collections_1.xml`, pages, blogs, `sitemap_agentic_discovery.xml` |
| Product catalog size | ~**161** PDP `<loc>` entries in `sitemap_products_1.xml` (single child urlset today; excludes root `/` loc) |
| Collection catalog size | ~**163** collection URLs in `sitemap_collections_1.xml` |
| Product URLs | `/products/{handle}` e.g. `/products/rice-toner`, `/products/supple-preparation-unscented-toner` |
| Collection URLs | `/collections/{handle}` e.g. `/collections/skincare`, `/collections/gifts-sets` |
| Product JSON | `GET /products/{handle}.json` → full Shopify product payload — **200** from Node |
| Collection JSON | `GET /collections/{handle}/products.json?limit=250&page=N` — **200**; pagination works |
| Variants | Mix of single-variant and multi-option products (e.g. size options on toners/creams) |
| Brand field | Shopify `vendor` maps to `brands.name` (e.g. `I'M FROM`, house brands like `Klairs`, `By Wishtrend`) |
| Currency | USD |

**Implication:** Wishtrend is structurally identical to Soko Glam for scraper purposes. ALE-59 should be a **thin retailer adapter** on top of `shopify/` — expect **smaller diff** than ALE-58 (smaller catalog, no platform module to build).

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| Jolse | `jolse.*` | Gzip product sitemaps + category HTML | `upsertProductFromJolseHit` |
| Soko Glam | `sokoGlam.*` | Product sitemap + collection JSON | `upsertProductFromSokoGlamHit` |
| YesStyle | `yesStyle.*` | Category sitemap + HTML (blocked by default) | `upsertProductFromYesStyleHit` |

Wishtrend should **copy the Soko Glam wiring shape** and call the same `shopify/` helpers with `siteBaseUrl = https://wishtrend.com`.

`queueNames.ts` today defines namespaces for `oliveYoung`, `yesStyle`, `styleKorean`, `jolse`, `oliveYoungUs`, and (after ALE-58) `sokoGlam` — Wishtrend adds `wishtrend.*`.

### Backend card links

Wishtrend will be **`linkable = true`** (default). Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | Wishtrend target (ALE-59) |
|------|-------|---------------------------|
| `sellers` row | None | **`Wishtrend`** + US `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / Wishtrend`** |
| SKU key | N/A | Shopify product **`handle`** (slug string) — same as Soko Glam |
| Listing discovery | N/A | Reuse `shopify/collectProductHandlesFromSitemaps` + `fetchShopifyCollectionProductsPage` |
| Fetch layer | Exists after ALE-58 | **Reuse `shopify/` unchanged** |
| Scraper package | N/A | **`src/scrapers/wishtrend/*`** (jobs, constants, upsert, spec prefix) only |
| Queue namespace | N/A | **`wishtrend.*`** |
| HTTP client | No `wishtrend.com` host rules | Throttle + optional cookie + UA override (Cloudflare) |

---

## Design decisions

### 1. US storefront only, canonical base `https://wishtrend.com` (proposed)

- Standardize env `WISHTREND_SITE_BASE_URL` on **`https://wishtrend.com`** (no `www`).
- Sitemap `<loc>` values use bare host; `www` redirects to canonical.

### 2. Queue namespace `wishtrend.*` (locked)

Mirror Soko Glam / Jolse queue set:

```ts
wishtrend.sellerCategoryHierarchy
wishtrend.sellerCategoryMapping
wishtrend.categoryProducts
wishtrend.sitemapProducts
wishtrend.product
wishtrend.productPdp
```

Worker concurrency: **`wishtrend.product` and `wishtrend.productPdp` at 1** initially.

### 3. `Product.sku` = Shopify product `handle` (proposed — confirm in spike)

Same rationale as Soko Glam:

- Sitemap PDP loc: `/products/{handle}`
- Collection JSON: `product.handle`
- Product JSON: `product.handle`

`buildSellerProductPageUrl` uses `https://wishtrend.com/products/{{sku}}`.

### 4. One `Product` row per Shopify product, not per variant (proposed)

- Upsert **one** commerce `Product` per Shopify parent product (`handle`).
- **Price** on `seller_product_prices`: **minimum** `variant.price` among **available** variants (reuse `shopify/minAvailableVariantPrice.ts`).
- Store variant count / option summary in listing specs if useful (`WT Variant count`, `WT Options`).

### 5. `Seller.productUrlTemplate` (proposed)

```text
https://wishtrend.com/products/{{sku}}
```

where `{{sku}}` is the product `handle`.

### 6. Listing before PDP (locked)

**Phase A** — sitemap + collection JSON → `upsertProductFromWishtrendHit` (brand, product, seller_product, price, listing specs from product JSON).

**Phase B** — `wishtrend.productPdp` enrichment for `body_html` flattening, tags, images once listing is stable.

Because Shopify `.json` returns rich PDP fields, Phase A jobs should fetch product JSON (not sitemap-only stubs) unless queue pressure requires a two-step split.

### 7. HTTP client reuse + Wishtrend host rules (locked)

Extend `src/lib/httpClient.ts`:

- `WISHTREND_REQUEST_DELAY_MS` throttle for `wishtrend.com`
- `WISHTREND_BROWSER_COOKIE` optional cookie injection
- Chrome desktop UA substitution when `SCRAPER_USER_AGENT` is the default bot string

Default throttle ≥ **700ms** (same starting point as Soko Glam).

### 8. Sitemap-first ingest with collection enrichment (proposed)

1. **Product sitemap walk** — reuse `shopify/collectProductHandlesFromSitemaps`; skip root `/` loc and non-product paths.
2. **Collection discovery** — reuse `shopify/collectCollectionHandlesFromSitemaps` → `seller_categories` rows. Apply Wishtrend-specific exclude regex (gift cards, free-gifts, checkout promos — spike to finalize).
3. **Category products job** — paginate `GET /collections/{handle}/products.json?limit=250&page=N`.

**Priority:** sitemap jobs > collection listing jobs (`wishtrendProductIngestPriorities` mirroring Soko Glam).

### 9. Collection hierarchy — flat v1 (proposed)

Same as Soko Glam: flat `seller_categories` from collections sitemap; `parentSellerCategoryId = null` unless spike documents a reliable nav-based parent map.

### 10. Spec prefix `WT ` (proposed)

PDP-derived specs use prefix **`WT `** (e.g. `WT Thumbnail URL`, `WT Description`, `WT Product type`, `WT Tags`) — mirror `SG ` / `JL ` conventions.

### 11. Reuse `shopify/` — do not fork (locked)

| Layer | Location | ALE-59 action |
|-------|----------|---------------|
| Sitemap walk, JSON fetch, listing/PDP mappers | `src/scrapers/shopify/*` | **Reuse as-is** from ALE-58 |
| BullMQ jobs, upsert, spec prefix, env, routes | `src/scrapers/wishtrend/*` | **Copy/adapt from `sokoGlam/`** with find-replace |
| Unit tests for Shopify protocol | `shopify/__fixtures__/` | Add Wishtrend fixtures **only** if JSON shape differs; otherwise reuse Soko Glam fixtures |

If spike finds a Wishtrend-only gap (e.g. unusual locale prefix, different sitemap child naming), extend `shopify/` in a **retailer-agnostic** way — never import `WISHTREND_*` env inside `shopify/`.

**Suggested `wishtrend/` layout (thin):**

```text
src/scrapers/wishtrend/
  wishtrendConstants.ts              # spec prefix, collection exclude regex defaults
  summarizeWishtrendListingFields.ts
  upsertProductFromWishtrendHit.ts   # Prisma choke point (copy sokoGlam upsert)
  mapWishtrendProductJsonToSpecRows.ts  # applies WT prefix
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

**Deliverable:** `commerce-platform-scrapers/docs/wishtrendSpike.md` (same shape as `sokoGlamSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://wishtrend.com/` and record friction.
2. Confirm product sitemap walk end-to-end from Node; count product PDP URLs (~161 expected).
3. Lock regex for `handle` extraction; confirm identical to Soko Glam `/products/{handle}` shape.
4. Enumerate collections from sitemap; propose exclude list (`free-gifts`, `gifts-sets`, marketing-only collections — spike may keep gift **products** but exclude gift **collections** from hierarchy jobs).
5. From one collection (`skincare`, pages 1–2) and one multi-variant PDP JSON, capture:
   - product name, brand (`vendor`), min price, compare-at price, thumbnail, availability
   - pagination termination for `products.json`
6. Confirm **parent product vs per-variant** `Product` rows (default: parent product).
7. Test Chrome UA + optional cookie from production scraper hosts (JSON should remain sufficient).
8. Lock `productUrlTemplate`, `Product.sku` field, and JSON field mapping (expect same as Soko Glam).
9. Note review widget presence — defer review ingest unless spike finds stable public endpoint.
10. Document 429/403 behavior and recommended `WISHTREND_REQUEST_DELAY_MS`.
11. Skim `https://wishtrend.com/agents.md` — document UCP/MCP for future agents; **do not** depend on it for v1 scrapers.
12. **Diff vs Soko Glam:** explicitly list anything that requires `shopify/` changes (expect “none”).

**Debug script (add in spike PR):** `scripts/debugWishtrendUrls.ts` — prints sample handles from product sitemap + one collection `products.json` page without DB writes (can be a thin fork of `debugSokoGlamUrls.ts`).

**Early spike observations (June 2026 — replace with spike doc):**

- Sitemap + product/collection JSON: **200 OK** from Node `curl` with Chrome UA.
- ~**161** product URLs, ~**163** collections.
- `GET /products/rice-toner.json` returns full variant arrays and `body_html`.
- `GET /collections/skincare/products.json?limit=3` returns paginated products.
- Cloudflare present but not blocking anonymous catalog JSON in early probes.
- Canonical host is bare `wishtrend.com`.

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.

### Schema change

**None** — reuse existing `sellers`, `product_categories`, `currencies` tables.

### Data changes (migration SQL)

| Table | Action |
|-------|--------|
| `sellers` | **INSERT** row: `name = 'Wishtrend'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = `https://wishtrend.com/products/{{sku}}` |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / Wishtrend'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_59_wishtrend_seller_and_staging_category`

Mirror the idempotent insert pattern from `ale_56_jolse_seller_and_staging_category` (US country lookup with `NULL` fallback).

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs a Wishtrend-specific branch after PDP specs exist (see Phase 5).

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`  
**Prerequisite:** ALE-58 `shopify/` module merged.

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `WISHTREND_SELLER_NAME`, `WISHTREND_STAGING_PRODUCT_CATEGORY_NAME`, `WISHTREND_SITE_BASE_URL`, `WISHTREND_SITEMAP_INDEX_URL`, throttle knobs, optional cookie, `WISHTREND_COLLECTION_PRODUCTS_PAGE_SIZE` (default 250), collection exclude regex |
| Entity resolvers | `ensureCommerceEntities.ts` — `findWishtrendSeller`, `findStagingProductCategoryForWishtrend` |
| Constants | `src/scrapers/wishtrend/wishtrendConstants.ts` — spec prefix `WT `, default collection exclude regex |
| Queue names | `queueNames.ts` — `wishtrendQueueNames`, `wishtrendProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; stub `productPdp` worker OK initially |
| HTTP client | `httpClient.ts` — throttle, cookie, UA override for `wishtrend.com` |
| HTTP routes | `server.ts` — `POST /jobs/wishtrend/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products`, `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Add `https://wishtrend.com/` to `scripts/probeRetailerStorefronts.ts` default URL list |
| `.env.example` | Document all new knobs |

**Copy source:** Use `sokoGlam/` as the template — rename namespace, env vars, spec prefix, and seller resolvers. Jobs should call `shopify/` with `{ siteBaseUrl: env.WISHTREND_SITE_BASE_URL }`.

---

## Phase 3 — Listing ingest

Implement after spike doc is approved.

| Component | Location | Purpose |
|-----------|----------|---------|
| `collectProductHandlesFromSitemaps.ts` | **`shopify/`** | Reuse unchanged |
| `collectCollectionHandlesFromSitemaps.ts` | **`shopify/`** | Reuse unchanged |
| `fetchShopifyCollectionProductsPage.ts` | **`shopify/`** | Reuse unchanged |
| `fetchShopifyProductJson.ts` | **`shopify/`** | Reuse unchanged |
| `mapShopifyProductJsonToListingFields.ts` | **`shopify/`** | Reuse unchanged |
| `discoverWishtrendSellerCategoryNodes.ts` | `wishtrend/` | Job glue + Wishtrend exclude regex |
| `summarizeWishtrendListingFields.ts` | `wishtrend/` | Typed summary for upsert |
| `upsertProductFromWishtrendHit.ts` | `wishtrend/` | Single DB choke point |
| Jobs | `wishtrend/jobs/` | Mirror `sokoGlam/jobs/` |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/wishtrend/seller-category-hierarchy
# POST /jobs/wishtrend/sitemap-products  { "maxProducts": 20 }
# POST /jobs/wishtrend/category-products  { "maxSellerCategories": 1 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from sitemap smoke; `seller_products` + `seller_product_prices` rows visible for `Wishtrend`; `buildSellerProductPageUrl` returns valid `wishtrend.com` links for smoke handles. Full catalog smoke (~161 products) should complete in minutes given small size.

---

## Phase 4 — PDP + spec enrichment

| Component | Location | Purpose |
|-----------|----------|---------|
| `mapShopifyProductJsonToPdpFields.ts` | **`shopify/`** | Reuse unchanged |
| `mapWishtrendProductJsonToSpecRows.ts` | `wishtrend/` | Wraps shared PDP fields → `ProductSellerSpec` rows with **`WT `** prefix |
| `enrichProductPdp.ts` job | `wishtrend/jobs/` | Re-fetch via `fetchShopifyProductJson`; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | `wishtrend/jobs/` | Keyset batch from Postgres → `addBulk` |
| Reviews | — | **Optional v1** — defer unless spike finds stable widget API |

---

## Phase 5 — Docs + roadmap + backend follow-ups

| Task | Location |
|------|----------|
| Spike notes | `docs/wishtrendSpike.md` |
| Roadmap row | `docs/kBeautyRetailerRoadmap.md` — Wishtrend: Planned → In progress → Done |
| Playbook | Confirm **Shopify retailers** subsection (from ALE-58) mentions Wishtrend as second reference implementation |
| Queue hygiene script | `scripts/wishtrendProductQueue.ts` (optional; copy Soko Glam script) |
| Thumbnails | `getProductThumbnailUrl` — `WT Thumbnail URL` spec or Shopify CDN fallback |

---

## Test plan

### Scrapers

- **No new `shopify/` unit tests required** if Wishtrend JSON shape matches Soko Glam fixtures.
- Unit test for `upsertProductFromWishtrendHit` with mocked prisma (copy Soko Glam test pattern if present).
- Manual: sitemap smoke 20 products; full-catalog smoke (~161); verify Bull Board completion; query DB for seller name + URL template.

### Backend

- No migration logic tests required beyond existing patterns; manually verify seller row after migrate.
- Optional: unit test `buildSellerProductPageUrl` with Wishtrend template + sample handle.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build` (includes `prisma generate`)

---

## Risks

| Risk | Mitigation |
|------|------------|
| ALE-58 not merged | Block Phase 2+ on `shopify/` landing; spike + migration can proceed in parallel |
| Accidental duplication of Shopify logic | Code review: `wishtrend/` must not reimplement JSON/sitemap parsers |
| Multi-variant pricing on cards | Reuse `minAvailableVariantPrice`; spike multi-variant PDP |
| `handle` changes break old SKUs | Rare; monitor 404 on JSON fetch; optional `WT Shopify product id` spec |
| Collection sitemap noise | Exclude regex in env; document in spike (`free-gifts`, etc.) |
| Cloudflare tightens bot rules | Chrome UA + optional cookie; Playwright fallback only if JSON blocked |
| SKU collision with another retailer | Handles are retailer-specific strings; monitor uniqueness in smoke |
| Architect rejects seed timing | Spike + doc review before DDL |
| House-brand vendor strings | `vendor` may be `Klairs`, `By Wishtrend`, etc. — upsert brand by name as-is; no special casing v1 |

---

## Implementation TODO

- [x] **Phase 0:** Complete spike; write `docs/wishtrendSpike.md`; add `debugWishtrendUrls.ts`
- [x] **Phase 0:** Confirm `shopify/` reuse with no protocol changes; document diff vs Soko Glam in spike doc
- [x] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, variant pricing rule, and collection exclude list
- [x] **Phase 0:** Confirm `products.json` pagination termination matches Soko Glam behavior
- [x] **Prerequisite:** ALE-58 `shopify/` platform layer merged to `main`
- [x] **Phase 1:** Architect approval for Wishtrend seller + staging category seed migration
- [x] **Phase 1:** Apply migration; `db:pull` in scrapers
- [x] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [x] **Phase 2:** Copy/adapt `wishtrend/` from `sokoGlam/` — jobs call `shopify/` with `WISHTREND_SITE_BASE_URL`
- [x] **Phase 3:** Sitemap + collection JSON fetch + `upsertProductFromWishtrendHit`; full ingest (**160** products, June 2026)
- [ ] **Phase 3:** Unit test for `upsertProductFromWishtrendHit` (when harness exists)
- [x] **Phase 4:** PDP enrichment job + spec mapping + enqueue-all routes (**160/160** PDP enriched)
- [ ] **Phase 4:** Unit tests for `mapWishtrendProductJsonToSpecRows` (when fixtures exist)
- [x] **Phase 5:** Update `kBeautyRetailerRoadmap.md`; note Wishtrend in playbook Shopify subsection
- [ ] **Follow-up:** Thumbnail resolver fallback after ingest (if needed)

**Shipped:** [backend PR #22](https://github.com/alex-the-programmer/commerce-platform-backend/pull/22), [scrapers PR #4](https://github.com/alex-the-programmer/commerce-platform-scrapers/pull/4) — merged to `main`.
