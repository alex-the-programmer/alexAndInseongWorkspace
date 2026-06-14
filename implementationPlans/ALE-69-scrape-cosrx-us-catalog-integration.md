# ALE-69 Scrape COSRX US catalog integration

## Context

[Linear ALE-69](https://linear.app/dewly/issue/ALE-69/scrape-cosrx-us-catalog-integration): add a **full seller integration** for the [COSRX US official brand storefront](https://www.cosrx.com/).

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook. COSRX US is a **single-brand Shopify store** — reuse the shared `src/scrapers/shopify/` platform layer from [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) instead of reimplementing sitemap/JSON logic.

**Branch:** `ALE-69-scrape-cosrx-us-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — COSRX US is **not yet listed** (official brand store; add under candidates or a new “brand official stores” subsection).
- [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) — **hard dependency**: shared Shopify platform layer (`shopify/`) + reference retailer wiring (`sokoGlam/`).
- [ALE-59](ALE-59-scrape-wishtrend-catalog-integration.md) — closest parallel (second Shopify retailer; thin adapter pattern).

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

**Prerequisite:** Land ALE-58’s `src/scrapers/shopify/` module before starting Phase 2. If not on `main`, merge or cherry-pick first; do not duplicate Shopify fetch/parse code into `cosrxUs/`.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `COSRX US` as its own `sellers` row with US `productUrlTemplate` |
| Listing ingest | Discover SKUs via product sitemap + collection JSON; persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs from Shopify product JSON (`body_html`, `tags`, `product_type`, images) via shared `shopify/` mappers |
| Operations | BullMQ namespace `cosrxUs.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Shopify reuse | **No new platform code** unless spike finds a COSRX-only protocol gap; thin `cosrxUs/` folder only |
| Roadmap | Document COSRX US in `kBeautyRetailerRoadmap.md` (candidates / brand-official section) → **Done** when ingest ships |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges (COSRX products also sold on Olive Young, Soko Glam, etc.).
- Frontend changes.
- COSRX KR / global storefronts — ingest **US** (`www.cosrx.com`, `localization=US`) only.
- Full taxonomy unification beyond staging category.
- Shopify **UCP/MCP** agent checkout APIs — catalog-only HTTP JSON is sufficient for scrapers.
- Per-variant `Product` rows unless spike proves parent-product pricing is unusable for cards.
- Blog / editorial content ingest.

---

## Current state

### COSRX US storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **Shopify** (`shopify-complexity-score` headers, `cdn.shopify.com` preconnect) |
| CDN | `cdn.shopify.com` for product media; theme assets on `www.cosrx.com/cdn/shop/` |
| Bot wall | **Cloudflare** (`cf-ray`, `cf-cache-status`); anonymous GETs return **200** for sitemap and JSON endpoints |
| Canonical host | **`https://www.cosrx.com/`** (homepage and sitemap locs use `www`; no bare-host redirect observed in spike) |
| Sitemap index | `https://www.cosrx.com/sitemap.xml` → `sitemap_products_1.xml`, `sitemap_collections_1.xml`, pages, blogs, `sitemap_agentic_discovery.xml` |
| Product catalog size | ~**135** PDP `<loc>` entries in `sitemap_products_1.xml` (136 total locs including root `/`) |
| Collection catalog size | ~**56** collection URLs in `sitemap_collections_1.xml` |
| Product URLs | `/products/{handle}` e.g. `/products/advanced-snail-96-mucin-power-essence` |
| Collection URLs | `/collections/{handle}` e.g. `/collections/cleansers`, `/collections/serums-essences` |
| Product JSON | `GET /products/{handle}.json` → full Shopify product payload — **200** from Node |
| Collection JSON | `GET /collections/{handle}/products.json?limit=250&page=N` — **200** (verified on `cleansers`) |
| Variants | Multi-variant products exist (e.g. Advanced Snail 96 Essence: **2** variants) |
| Brand field | Shopify `vendor` = **`COSRX official`** — normalize to **`COSRX`** in upsert (single-brand store) |
| Currency | USD (`cart_currency=USD`, `localization=US`) |
| `product_type` | Often empty string on sample PDP — rely on `tags` / `body_html` for enrichment |

**Implication:** COSRX US is structurally identical to Soko Glam / Wishtrend for scraper purposes. ALE-69 should be a **thin retailer adapter** on top of `shopify/` — expect a **small diff** (smallest catalog among Shopify retailers so far). The main retailer-specific logic is **brand normalization** (`COSRX official` → `COSRX`).

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| Jolse | `jolse.*` | Gzip product sitemaps + category HTML | `upsertProductFromJolseHit` |
| Soko Glam | `sokoGlam.*` | Product sitemap + collection JSON | `upsertProductFromSokoGlamHit` |
| YesStyle | `yesStyle.*` | Category sitemap + HTML (blocked by default) | `upsertProductFromYesStyleHit` |

COSRX US should **copy the Soko Glam wiring shape** and call the same `shopify/` helpers with `siteBaseUrl = https://www.cosrx.com`.

`queueNames.ts` today defines namespaces for `oliveYoung`, `yesStyle`, `styleKorean`, `jolse`, `oliveYoungUs`, and (after ALE-58) `sokoGlam` — COSRX US adds `cosrxUs.*`.

### Backend card links

COSRX US will be **`linkable = true`** (default). Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | COSRX US target (ALE-69) |
|------|-------|--------------------------|
| `sellers` row | None | **`COSRX US`** + US `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / COSRX US`** |
| SKU key | N/A | Shopify product **`handle`** (slug string) — same as Soko Glam |
| Listing discovery | N/A | Reuse `shopify/collectProductHandlesFromSitemaps` + `fetchShopifyCollectionProductsPage` |
| Fetch layer | Exists after ALE-58 | **Reuse `shopify/` unchanged** |
| Brand mapping | N/A | Normalize `vendor` **`COSRX official`** → brand **`COSRX`** |
| Scraper package | N/A | **`src/scrapers/cosrxUs/*`** (jobs, constants, upsert, spec prefix) only |
| Queue namespace | N/A | **`cosrxUs.*`** |
| HTTP client | No `cosrx.com` host rules | Throttle + optional cookie + UA override (Cloudflare) |

---

## Design decisions

### 1. US storefront only, canonical base `https://www.cosrx.com` (proposed)

- Standardize env `COSRX_US_SITE_BASE_URL` on **`https://www.cosrx.com`** (with `www`).
- Sitemap `<loc>` values already use `www`; product/collection JSON paths are host-relative.

### 2. Queue namespace `cosrxUs.*` (locked)

Mirror Soko Glam / Jolse queue set:

```ts
cosrxUs.sellerCategoryHierarchy
cosrxUs.sellerCategoryMapping
cosrxUs.categoryProducts
cosrxUs.sitemapProducts
cosrxUs.product
cosrxUs.productPdp
```

Worker concurrency: **`cosrxUs.product` and `cosrxUs.productPdp` at 1** initially.

### 3. `Product.sku` = Shopify product `handle` (proposed — confirm in spike)

Same rationale as Soko Glam:

- Sitemap PDP loc: `/products/{handle}`
- Collection JSON: `product.handle`
- Product JSON: `product.handle`

`buildSellerProductPageUrl` uses `https://www.cosrx.com/products/{{sku}}`.

### 4. One `Product` row per Shopify product, not per variant (proposed)

- Upsert **one** commerce `Product` per Shopify parent product (`handle`).
- **Price** on `seller_product_prices`: **minimum** `variant.price` among **available** variants (reuse `shopify/minAvailableVariantPrice.ts`).
- Store variant count / option summary in listing specs if useful (`CRX Variant count`, `CRX Options`).

### 5. `Seller.productUrlTemplate` (proposed)

```text
https://www.cosrx.com/products/{{sku}}
```

where `{{sku}}` is the product `handle`.

### 6. Brand normalization — `COSRX official` → `COSRX` (locked intent)

- Shopify `vendor` is consistently **`COSRX official`** on sampled PDPs.
- In `upsertProductFromCosrxUsHit`, map vendor to brand name **`COSRX`** (strip ` official` suffix or use a small allowlist map in `cosrxUsConstants.ts`).
- Do **not** create a separate brand row per vendor string variant.

### 7. Listing before PDP (locked)

**Phase A** — sitemap + collection JSON → `upsertProductFromCosrxUsHit` (brand, product, seller_product, price, listing specs from product JSON).

**Phase B** — `cosrxUs.productPdp` enrichment for `body_html` flattening, tags, images once listing is stable.

Because Shopify `.json` returns rich PDP fields, Phase A jobs should fetch product JSON (not sitemap-only stubs) unless queue pressure requires a two-step split.

### 8. HTTP client reuse + COSRX US host rules (locked)

Extend `src/lib/httpClient.ts`:

- `COSRX_US_REQUEST_DELAY_MS` throttle for `*.cosrx.com`
- `COSRX_US_BROWSER_COOKIE` optional cookie injection
- Chrome desktop UA substitution when `SCRAPER_USER_AGENT` is the default bot string

Default throttle ≥ **700ms** (same starting point as Soko Glam).

### 9. Sitemap-first ingest with collection enrichment (proposed)

1. **Product sitemap walk** — reuse `shopify/collectProductHandlesFromSitemaps`; skip root `/` loc and non-product paths.
2. **Collection discovery** — reuse `shopify/collectCollectionHandlesFromSitemaps` → `seller_categories` rows. Apply COSRX-specific exclude regex (tools, marketing landing collections — spike to finalize).
3. **Category products job** — paginate `GET /collections/{handle}/products.json?limit=250&page=N`.

**Priority:** sitemap jobs > collection listing jobs (`cosrxUsProductIngestPriorities` mirroring Soko Glam).

### 10. Collection hierarchy — flat v1 (proposed)

Same as Soko Glam: flat `seller_categories` from collections sitemap; `parentSellerCategoryId = null` unless spike documents a reliable nav-based parent map.

### 11. Spec prefix `CRX ` (proposed)

PDP-derived specs use prefix **`CRX `** (e.g. `CRX Thumbnail URL`, `CRX Description`, `CRX Product type`, `CRX Tags`) — mirror `SG ` / `WT ` / `JL ` conventions.

### 12. Reuse `shopify/` — do not fork (locked)

| Layer | Location | ALE-69 action |
|-------|----------|---------------|
| Sitemap walk, JSON fetch, listing/PDP mappers | `src/scrapers/shopify/*` | **Reuse as-is** from ALE-58 |
| BullMQ jobs, upsert, spec prefix, env, routes | `src/scrapers/cosrxUs/*` | **Copy/adapt from `sokoGlam/`** with find-replace |
| Unit tests for Shopify protocol | `shopify/__fixtures__/` | Add COSRX fixtures **only** if JSON shape differs; otherwise reuse Soko Glam fixtures |

If spike finds a COSRX-only gap, extend `shopify/` in a **retailer-agnostic** way — never import `COSRX_US_*` env inside `shopify/`.

**Suggested `cosrxUs/` layout (thin):**

```text
src/scrapers/cosrxUs/
  cosrxUsConstants.ts                  # spec prefix, brand normalize map, collection exclude regex
  normalizeCosrxUsBrandName.ts         # COSRX official → COSRX
  summarizeCosrxUsListingFields.ts
  upsertProductFromCosrxUsHit.ts       # Prisma choke point (copy sokoGlam upsert + brand normalize)
  mapCosrxUsProductJsonToSpecRows.ts   # applies CRX prefix
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

**Deliverable:** `commerce-platform-scrapers/docs/cosrxUsSpike.md` (same shape as `sokoGlamSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://www.cosrx.com/` and record friction.
2. Confirm product sitemap walk end-to-end from Node; count product PDP URLs (~135 expected).
3. Lock regex for `handle` extraction; confirm identical to Soko Glam `/products/{handle}` shape.
4. Enumerate collections from sitemap; propose exclude list (`tools`, gift/promo collections if any).
5. From one collection (`cleansers`, pages 1–2) and one multi-variant PDP JSON, capture:
   - product name, brand (`vendor`), min price, compare-at price, thumbnail, availability
   - pagination termination for `products.json`
6. Confirm **parent product vs per-variant** `Product` rows (default: parent product).
7. Confirm **`vendor` normalization** — document all distinct `vendor` strings (expect single value `COSRX official`).
8. Test Chrome UA + optional cookie from production scraper hosts (JSON should remain sufficient).
9. Lock `productUrlTemplate`, `Product.sku` field, and JSON field mapping (expect same as Soko Glam).
10. Note review widget presence — defer review ingest unless spike finds stable public endpoint.
11. Document 429/403 behavior and recommended `COSRX_US_REQUEST_DELAY_MS`.
12. Skim `https://www.cosrx.com/agents.md` — document UCP/MCP for future agents; **do not** depend on it for v1 scrapers.
13. **Diff vs Soko Glam:** explicitly list anything that requires `shopify/` changes (expect “none” beyond `www` host).

**Debug script (add in spike PR):** `scripts/debugCosrxUsUrls.ts` — prints sample handles from product sitemap + one collection `products.json` page without DB writes (thin fork of `debugSokoGlamUrls.ts`).

**Early spike observations (June 2026 — replace with spike doc):**

- Sitemap + product/collection JSON: **200 OK** from Node `curl` with Chrome UA.
- ~**135** product URLs, ~**56** collections.
- `GET /products/advanced-snail-96-mucin-power-essence.json` returns 2 variants, `vendor: COSRX official`, price `25.00`.
- `GET /collections/cleansers/products.json?limit=5` returns paginated products.
- Cloudflare present but not blocking anonymous catalog JSON in early probes.
- Canonical host uses **`www.cosrx.com`**.

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.

### Schema change

**None** — reuse existing `sellers`, `product_categories`, `currencies` tables.

### Data changes (migration SQL)

| Table | Action |
|-------|--------|
| `sellers` | **INSERT** row: `name = 'COSRX US'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = `https://www.cosrx.com/products/{{sku}}` |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / COSRX US'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_69_cosrx_us_seller_and_staging_category`

Mirror the idempotent insert pattern from `ale_58_soko_glam_seller_and_staging_category` (US country lookup with `NULL` fallback).

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs a COSRX-specific branch after PDP specs exist (see Phase 5).

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`  
**Prerequisite:** ALE-58 `shopify/` on branch.

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `COSRX_US_SELLER_NAME`, `COSRX_US_STAGING_PRODUCT_CATEGORY_NAME`, `COSRX_US_SITE_BASE_URL`, `COSRX_US_SITEMAP_INDEX_URL`, throttle knobs, optional cookie, `COSRX_US_COLLECTION_PRODUCTS_PAGE_SIZE` (default 250), collection exclude regex |
| Entity resolvers | `ensureCommerceEntities.ts` — `findCosrxUsSeller`, `findStagingProductCategoryForCosrxUs` |
| Constants | `src/scrapers/cosrxUs/cosrxUsConstants.ts` — spec prefix, brand normalize map, default collection exclude regex |
| Retailer package | `src/scrapers/cosrxUs/*` — thin; jobs call `shopify/` with `siteBaseUrl` from env |
| Queue names | `queueNames.ts` — `cosrxUsQueueNames`, `cosrxUsProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; stub `productPdp` worker OK initially |
| HTTP client | `httpClient.ts` — throttle, cookie, UA override for `cosrx.com` |
| HTTP routes | `server.ts` — `POST /jobs/cosrx-us/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products`, `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Add `https://www.cosrx.com/` to `scripts/probeRetailerStorefronts.ts` default URL list |
| `.env.example` | Document all new knobs |

---

## Phase 3 — Listing ingest

Implement after spike doc is approved.

| Component | Location | Purpose |
|-----------|----------|---------|
| `collectProductHandlesFromSitemaps.ts` | **`shopify/`** | Reuse unchanged |
| `collectCollectionHandlesFromSitemaps.ts` | **`shopify/`** | Reuse unchanged |
| `fetchShopifyProductJson.ts` | **`shopify/`** | Reuse unchanged |
| `mapShopifyProductJsonToListingFields.ts` | **`shopify/`** | Reuse unchanged |
| `discoverCosrxUsSellerCategoryNodes.ts` | `cosrxUs/` | Job glue + exclude regex → `seller_categories` |
| `normalizeCosrxUsBrandName.ts` | `cosrxUs/` | `COSRX official` → `COSRX` |
| `summarizeCosrxUsListingFields.ts` | `cosrxUs/` | Typed summary for upsert |
| `upsertProductFromCosrxUsHit.ts` | `cosrxUs/` | Single DB choke point |
| Jobs | `cosrxUs/jobs/` | Mirror `sokoGlam/jobs/`; concurrency **1** |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/cosrx-us/seller-category-hierarchy
# POST /jobs/cosrx-us/sitemap-products  { "maxProducts": 20 }
# POST /jobs/cosrx-us/category-products  { "maxSellerCategories": 1 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from sitemap smoke; `seller_products` + `seller_product_prices` rows visible for `COSRX US`; brand name **`COSRX`**; `buildSellerProductPageUrl` returns valid `www.cosrx.com` links for smoke handles.

**Full catalog note:** ~135 SKUs — a full sitemap ingest is feasible in a single smoke session after spike approval.

---

## Phase 4 — PDP + spec enrichment

| Component | Location | Purpose |
|-----------|----------|---------|
| `mapShopifyProductJsonToPdpFields.ts` | **`shopify/`** | Reuse unchanged |
| `mapCosrxUsProductJsonToSpecRows.ts` | `cosrxUs/` | Wraps shared PDP fields → `ProductSellerSpec` rows with **`CRX `** prefix |
| `enrichProductPdp.ts` job | `cosrxUs/jobs/` | Re-fetch via `fetchShopifyProductJson`; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | `cosrxUs/jobs/` | Keyset batch from Postgres → `addBulk` |
| Reviews | — | **Optional v1** — only ingest if spike finds stable Yotpo/Judge.me public API |

---

## Phase 5 — Docs + roadmap + backend follow-ups

| Task | Location |
|------|----------|
| Spike notes | `docs/cosrxUsSpike.md` |
| Roadmap | `docs/kBeautyRetailerRoadmap.md` — add COSRX US under **Candidates pool** or new **Brand official stores** row with status **Done** when shipped |
| Playbook | No new subsection required if Shopify retailers section exists from ALE-58; add one-line cross-link if missing |
| Queue hygiene script | `scripts/cosrxUsProductQueue.ts` (optional; copy Soko Glam script) |
| Thumbnails | `getProductThumbnailUrl` — `images[0].src` from `CRX Thumbnail URL` spec or Shopify CDN fallback |

---

## Test plan

### Scrapers

- Reuse **`shopify/`** unit tests from ALE-58; add COSRX fixtures only if JSON shape differs.
- Unit test for `normalizeCosrxUsBrandName` (`COSRX official` → `COSRX`).
- Unit test for `upsertProductFromCosrxUsHit` with mocked prisma (match Soko Glam test style).
- Manual: sitemap smoke 20 products; full-catalog run optional (~135 SKUs); verify Bull Board completion; query DB for seller name + URL template + brand `COSRX`.

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
| `vendor` string changes | Small allowlist + fallback strip ` official` suffix |
| `www` vs bare host drift | Lock `COSRX_US_SITE_BASE_URL` on `www`; spike confirms redirects |
| Multi-variant pricing on cards | Min available variant price; spike multi-variant PDP |
| `handle` changes break old SKUs | Rare; monitor 404 on JSON fetch; optional `CRX Shopify product id` spec |
| Collection sitemap noise | Exclude regex in env; document in spike |
| Cloudflare tightens bot rules | Chrome UA + optional cookie; Playwright fallback only if JSON blocked |
| SKU collision with another retailer | Handles are retailer-specific strings; monitor uniqueness in smoke |
| Cross-retailer COSRX dedupe | Out of scope v1; same brand sold elsewhere is expected |
| Architect rejects seed timing | Spike + doc review before DDL |

---

## Implementation TODO

- [ ] **Phase 0:** Complete spike; write `docs/cosrxUsSpike.md`; add `debugCosrxUsUrls.ts`
- [x] **Phase 0:** `debugCosrxUsUrls.ts` added (defaults to first sitemap handle)
- [ ] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, variant pricing rule, brand normalization, and collection exclude list in spike doc
- [ ] **Phase 0:** Confirm `products.json` pagination (`page` param, max `limit`, termination)
- [x] **Phase 0:** Diff vs Soko Glam — confirm no `shopify/` changes required
- [ ] **Phase 1:** Architect approval for COSRX US seller + staging category seed migration
- [x] **Phase 1:** Apply migration; `db:pull` in scrapers
- [x] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [x] **Phase 2:** Implement `src/scrapers/cosrxUs/*` (copy from `sokoGlam/`); jobs call `shopify/` with `siteBaseUrl` from env
- [x] **Phase 3:** Sitemap + collection JSON fetch + `upsertProductFromCosrxUsHit`; smoke ingest (20+ products)
- [x] **Phase 3:** Unit tests for brand normalize + upsert (when fixtures exist)
- [x] **Phase 4:** PDP enrichment job + spec mapping + enqueue-all routes (full catalog: 136 products enriched)
- [x] **Phase 4:** Unit tests for PDP mappers (when fixtures exist)
- [ ] **Phase 5:** Update `kBeautyRetailerRoadmap.md` (COSRX US entry) and probe defaults
- [ ] **Follow-up:** Thumbnail resolver fallback after ingest (if needed)
