# ALE-71 Scrape Beauty of Joseon US catalog integration

## Context

[Linear ALE-71](https://linear.app/dewly/issue/ALE-71/scrape-beauty-of-joseon-us-catalog-integration): add a **full seller integration** for the [Beauty of Joseon US official brand storefront](https://beautyofjoseon.com/).

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook. Beauty of Joseon US is a **single-brand Shopify store** with a **very small catalog** (~48 PDPs) — reuse the shared `src/scrapers/shopify/` platform layer from [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) instead of reimplementing sitemap/JSON logic.

**Branch:** `ALE-71-scrape-beauty-of-joseon-us-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — Beauty of Joseon US is **not yet listed** (official brand store; add under candidates or a new “brand official stores” subsection).
- [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) — **hard dependency**: shared Shopify platform layer (`shopify/`) + reference retailer wiring (`sokoGlam/`).
- [ALE-69](ALE-69-scrape-cosrx-us-catalog-integration.md) — closest parallel (second single-brand Shopify official store; thin adapter pattern).
- [ALE-73](ALE-73-scrape-innisfree-us-catalog-integration.md) — parallel single-brand Shopify store; sitemap child locs with `?from=&to=` query params.

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

**Prerequisite:** Land ALE-58’s `src/scrapers/shopify/` module before starting Phase 2. If not on `main`, merge or cherry-pick first; do not duplicate Shopify fetch/parse code into `beautyOfJoseonUs/`.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `Beauty of Joseon US` as its own `sellers` row with US `productUrlTemplate` |
| Listing ingest | Discover SKUs via product sitemap + collection JSON; persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs from Shopify product JSON (`body_html`, `tags`, `product_type`, images) via shared `shopify/` mappers |
| Operations | BullMQ namespace `beautyOfJoseonUs.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Shopify reuse | **No new platform code** unless spike finds a BOJ-only protocol gap; thin `beautyOfJoseonUs/` folder only |
| Roadmap | Document Beauty of Joseon US in `kBeautyRetailerRoadmap.md` (candidates / brand-official section) → **Done** when ingest ships |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges (BOJ products also sold on Olive Young, Soko Glam, etc.).
- Frontend changes.
- Non-US Beauty of Joseon storefronts — ingest **US** (`beautyofjoseon.com`, `localization=US`) only.
- Full taxonomy unification beyond staging category.
- Shopify **UCP/MCP** agent checkout APIs — catalog-only HTTP JSON is sufficient for scrapers.
- Per-variant `Product` rows unless spike proves parent-product pricing is unusable for cards.
- Blog / editorial content ingest.
- Lifestyle merch (fabric, accessories) unless spike confirms they appear in product sitemap and should be ingested.

---

## Current state

### Beauty of Joseon US storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **Shopify** (`shopify-complexity-score` headers, `cdn.shopify.com` preconnect) |
| CDN | `cdn.shopify.com` for product media; theme assets on `beautyofjoseon.com/cdn/shop/` |
| Bot wall | **Cloudflare** (`cf-ray`, `cf-cache-status: DYNAMIC`); anonymous GETs return **200** for sitemap and JSON endpoints |
| Canonical host | **`https://beautyofjoseon.com/`** (bare host; `www.beautyofjoseon.com` **301** → bare host) |
| Sitemap index | `https://beautyofjoseon.com/sitemap.xml` → `sitemap_products_1.xml`, `sitemap_collections_1.xml`, pages, blogs, `sitemap_agentic_discovery.xml` |
| Sitemap child URLs | Child locs include **query params** (`?from=…&to=…`) — walker must fetch the full `<loc>` verbatim (same as Innisfree US) |
| Product catalog size | ~**49** `<loc>` entries in product sitemap (**~48** PDPs after excluding homepage `/` root loc) |
| Collection catalog size | ~**232** collection URLs in `sitemap_collections_1.xml` (many merchandising / lifestyle / marketing landing pages) |
| Product URLs | `/products/{handle}` e.g. `/products/glow-serum-propolis-niacinamide` |
| Collection URLs | `/collections/{handle}` e.g. `/collections/serum`, `/collections/best-sellers` |
| Product JSON | `GET /products/{handle}.json` → full Shopify product payload — **200** from Node |
| Collection JSON | `GET /collections/{handle}/products.json?limit=250&page=N` — **200** (verified on `serum`, `best-sellers`) |
| Variants | Multi-variant products exist (e.g. Glow Serum: **2** variants) |
| Brand field | Shopify `vendor` = **`Beauty of Joseon`** — use as-is for `brands.name` (single-brand store) |
| `product_type` | Often empty string on sample PDP — rely on `tags` / `body_html` for enrichment |
| Currency | USD (`cart_currency=USD`, `localization=US`) |
| Non-skincare collections | Sitemap includes `lifestyle`, `fabric`, `accessory`, gift sets, and many marketing landing collections — spike must finalize **exclude regex** |

**Implication:** Beauty of Joseon US is structurally identical to Soko Glam / COSRX US / Innisfree US for scraper purposes. ALE-71 should be a **thin retailer adapter** on top of `shopify/` — expect the **smallest catalog** among Shopify retailers (~48 SKUs). Main retailer-specific work is **collection exclude regex** (232 collections vs ~48 products) and locking the **bare-host** canonical URL.

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| Jolse | `jolse.*` | Gzip product sitemaps + category HTML | `upsertProductFromJolseHit` |
| Soko Glam | `sokoGlam.*` | Product sitemap + collection JSON | `upsertProductFromSokoGlamHit` |
| YesStyle | `yesStyle.*` | Category sitemap + HTML (blocked by default) | `upsertProductFromYesStyleHit` |

Beauty of Joseon US should **copy the Soko Glam wiring shape** and call the same `shopify/` helpers with `siteBaseUrl = https://beautyofjoseon.com`.

`queueNames.ts` today defines namespaces for `oliveYoung`, `yesStyle`, `styleKorean`, `jolse`, `oliveYoungUs`, and (after ALE-58) `sokoGlam` — Beauty of Joseon US adds `beautyOfJoseonUs.*`.

### Backend card links

Beauty of Joseon US will be **`linkable = true`** (default). Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | Beauty of Joseon US target (ALE-71) |
|------|-------|-------------------------------------|
| `sellers` row | None | **`Beauty of Joseon US`** + US `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / Beauty of Joseon US`** |
| SKU key | N/A | Shopify product **`handle`** (slug string) — same as Soko Glam |
| Listing discovery | N/A | Reuse `shopify/collectProductHandlesFromSitemaps` + `fetchShopifyCollectionProductsPage` |
| Fetch layer | Exists after ALE-58 | **Reuse `shopify/` unchanged** |
| Brand mapping | N/A | Shopify `vendor` **`Beauty of Joseon`** → brand **`Beauty of Joseon`** (no normalization) |
| Scraper package | N/A | **`src/scrapers/beautyOfJoseonUs/*`** (jobs, constants, upsert, spec prefix) only |
| Queue namespace | N/A | **`beautyOfJoseonUs.*`** |
| HTTP client | No `beautyofjoseon.com` host rules | Throttle + optional cookie + UA override (Cloudflare) |

---

## Design decisions

### 1. US storefront only, canonical base `https://beautyofjoseon.com` (proposed)

- Standardize env `BEAUTY_OF_JOSEON_US_SITE_BASE_URL` on **`https://beautyofjoseon.com`** (bare host, no `www`).
- `www.beautyofjoseon.com` redirects to bare host — do not use `www` in `productUrlTemplate`.

### 2. Queue namespace `beautyOfJoseonUs.*` (locked)

Mirror Soko Glam / Jolse queue set:

```ts
beautyOfJoseonUs.sellerCategoryHierarchy
beautyOfJoseonUs.sellerCategoryMapping
beautyOfJoseonUs.categoryProducts
beautyOfJoseonUs.sitemapProducts
beautyOfJoseonUs.product
beautyOfJoseonUs.productPdp
```

Worker concurrency: **`beautyOfJoseonUs.product` and `beautyOfJoseonUs.productPdp` at 1** initially.

### 3. `Product.sku` = Shopify product `handle` (proposed — confirm in spike)

Same rationale as Soko Glam:

- Sitemap PDP loc: `/products/{handle}`
- Collection JSON: `product.handle`
- Product JSON: `product.handle`

`buildSellerProductPageUrl` uses `https://beautyofjoseon.com/products/{{sku}}`.

### 4. One `Product` row per Shopify product, not per variant (proposed)

- Upsert **one** commerce `Product` per Shopify parent product (`handle`).
- **Price** on `seller_product_prices`: **minimum** `variant.price` among **available** variants (reuse `shopify/minAvailableVariantPrice.ts`).
- Store variant count / option summary in listing specs if useful (`BOJ Variant count`, `BOJ Options`).

### 5. `Seller.productUrlTemplate` (proposed)

```text
https://beautyofjoseon.com/products/{{sku}}
```

where `{{sku}}` is the product `handle`.

### 6. Brand = `Beauty of Joseon` always (proposed)

- Map Shopify `vendor` → `brands.name` (`Beauty of Joseon`).
- Spike should confirm no third-party marketplace SKUs appear in the US catalog.
- No vendor-string normalization needed (unlike COSRX US `COSRX official` → `COSRX`).

### 7. Listing before PDP (locked)

**Phase A** — sitemap + collection JSON → `upsertProductFromBeautyOfJoseonUsHit` (brand, product, seller_product, price, listing specs from product JSON).

**Phase B** — `beautyOfJoseonUs.productPdp` enrichment for `body_html` flattening, tags, images once listing is stable.

Because Shopify `.json` returns rich PDP fields, Phase A jobs should fetch product JSON (not sitemap-only stubs) unless queue pressure requires a two-step split.

### 8. HTTP client reuse + Beauty of Joseon US host rules (locked)

Extend `src/lib/httpClient.ts`:

- `BEAUTY_OF_JOSEON_US_REQUEST_DELAY_MS` throttle for `*.beautyofjoseon.com`
- `BEAUTY_OF_JOSEON_US_BROWSER_COOKIE` optional cookie injection
- Chrome desktop UA substitution when `SCRAPER_USER_AGENT` is the default bot string

Default throttle ≥ **700ms** (same starting point as Soko Glam).

### 9. Sitemap-first ingest with collection enrichment (proposed)

1. **Product sitemap walk** — reuse `shopify/collectProductHandlesFromSitemaps`; fetch child sitemap locs **verbatim** (including `?from=&to=`); skip root `/` loc and non-product paths.
2. **Collection discovery** — reuse `shopify/collectCollectionHandlesFromSitemaps` → `seller_categories` rows. Apply BOJ-specific exclude regex (lifestyle, fabric, accessory, marketing landing collections — spike to finalize).
3. **Category products job** — paginate `GET /collections/{handle}/products.json?limit=250&page=N`.

**Priority:** sitemap jobs > collection listing jobs (`beautyOfJoseonUsProductIngestPriorities` mirroring Soko Glam).

**Note:** With only ~48 products, sitemap ingest alone may cover the full catalog; collection jobs are still useful for category metadata and cross-check.

### 10. Collection hierarchy — flat v1 (proposed)

Same as Soko Glam: flat `seller_categories` from collections sitemap (after exclude filter); `parentSellerCategoryId = null` unless spike documents a reliable nav-based parent map.

### 11. Spec prefix `BOJ ` (proposed)

PDP-derived specs use prefix **`BOJ `** (e.g. `BOJ Thumbnail URL`, `BOJ Description`, `BOJ Product type`, `BOJ Tags`) — mirror `SG ` / `CRX ` / `IFU ` conventions.

### 12. Reuse `shopify/` — do not fork (locked)

| Layer | Location | ALE-71 action |
|-------|----------|---------------|
| Sitemap walk, JSON fetch, listing/PDP mappers | `src/scrapers/shopify/*` | **Reuse as-is** from ALE-58 |
| BullMQ jobs, upsert, spec prefix, env, routes | `src/scrapers/beautyOfJoseonUs/*` | **Copy/adapt from `sokoGlam/`** with find-replace |
| Unit tests for Shopify protocol | `shopify/__fixtures__/` | Add BOJ fixtures **only** if JSON shape differs; otherwise reuse Soko Glam fixtures |

If spike finds a BOJ-only gap, extend `shopify/` in a **retailer-agnostic** way — never import `BEAUTY_OF_JOSEON_US_*` env inside `shopify/`.

**Suggested `beautyOfJoseonUs/` layout (thin):**

```text
src/scrapers/beautyOfJoseonUs/
  beautyOfJoseonUsConstants.ts                  # spec prefix, collection exclude regex
  summarizeBeautyOfJoseonUsListingFields.ts
  upsertProductFromBeautyOfJoseonUsHit.ts       # Prisma choke point (copy sokoGlam upsert)
  mapBeautyOfJoseonUsProductJsonToSpecRows.ts   # applies BOJ prefix
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

**Deliverable:** `commerce-platform-scrapers/docs/beautyOfJoseonUsSpike.md` (same shape as `sokoGlamSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://beautyofjoseon.com/` and record friction.
2. Confirm product sitemap walk end-to-end from Node; count product PDP URLs (~48 expected).
3. Lock regex for `handle` extraction; confirm identical to Soko Glam `/products/{handle}` shape.
4. Enumerate collections from sitemap; propose exclude list (`lifestyle`, `fabric`, `accessory`, gift/promo/marketing landing collections).
5. From one collection (`serum`, `best-sellers`, pages 1–2) and one multi-variant PDP JSON, capture:
   - product name, brand (`vendor`), min price, compare-at price, thumbnail, availability
   - pagination termination for `products.json`
6. Confirm **parent product vs per-variant** `Product` rows (default: parent product).
7. Confirm **`vendor`** is consistently `Beauty of Joseon` across all PDPs.
8. Test Chrome UA + optional cookie from production scraper hosts (JSON should remain sufficient).
9. Lock `productUrlTemplate`, `Product.sku` field, and JSON field mapping (expect same as Soko Glam).
10. Note review widget presence — defer review ingest unless spike finds stable public endpoint.
11. Document 429/403 behavior and recommended `BEAUTY_OF_JOSEON_US_REQUEST_DELAY_MS`.
12. Skim `https://beautyofjoseon.com/agents.md` — document UCP/MCP for future agents; **do not** depend on it for v1 scrapers.
13. **Diff vs Soko Glam:** explicitly list anything that requires `shopify/` changes (expect “none” beyond sitemap loc query params, already handled generically).
14. Confirm whether lifestyle merch PDPs (fabric, accessories) are in product sitemap and should be ingested or excluded.

**Debug script (add in spike PR):** `scripts/debugBeautyOfJoseonUsUrls.ts` — prints sample handles from product sitemap + one collection `products.json` page without DB writes (thin fork of `debugSokoGlamUrls.ts`).

**Early spike observations (June 2026 — replace with spike doc):**

- Sitemap + product/collection JSON: **200 OK** from Node `curl` with Chrome UA.
- ~**48** product URLs, ~**232** collections (heavy exclude list needed).
- `GET /products/glow-serum-propolis-niacinamide.json` returns 2 variants, `vendor: Beauty of Joseon`, price `13.60`.
- `GET /collections/serum/products.json?limit=5` and `best-sellers` return paginated products.
- Cloudflare present but not blocking anonymous catalog JSON in early probes.
- Canonical host is **bare** `beautyofjoseon.com` (`www` redirects away).
- Sitemap child locs include `?from=&to=` query params.

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.

### Schema change

**None** — reuse existing `sellers`, `product_categories`, `currencies` tables.

### Data changes (migration SQL)

| Table | Action |
|-------|--------|
| `sellers` | **INSERT** row: `name = 'Beauty of Joseon US'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = `https://beautyofjoseon.com/products/{{sku}}` |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / Beauty of Joseon US'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_71_beauty_of_joseon_us_seller_and_staging_category`

Mirror the idempotent insert pattern from `ale_58_soko_glam_seller_and_staging_category` (US country lookup with `NULL` fallback).

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs a BOJ-specific branch after PDP specs exist (see Phase 5).

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`  
**Prerequisite:** ALE-58 `shopify/` on branch.

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `BEAUTY_OF_JOSEON_US_SELLER_NAME`, `BEAUTY_OF_JOSEON_US_STAGING_PRODUCT_CATEGORY_NAME`, `BEAUTY_OF_JOSEON_US_SITE_BASE_URL`, `BEAUTY_OF_JOSEON_US_SITEMAP_INDEX_URL`, throttle knobs, optional cookie, `BEAUTY_OF_JOSEON_US_COLLECTION_PRODUCTS_PAGE_SIZE` (default 250), collection exclude regex |
| Entity resolvers | `ensureCommerceEntities.ts` — `findBeautyOfJoseonUsSeller`, `findStagingProductCategoryForBeautyOfJoseonUs` |
| Constants | `src/scrapers/beautyOfJoseonUs/beautyOfJoseonUsConstants.ts` — spec prefix, default collection exclude regex |
| Retailer package | `src/scrapers/beautyOfJoseonUs/*` — thin; jobs call `shopify/` with `siteBaseUrl` from env |
| Queue names | `queueNames.ts` — `beautyOfJoseonUsQueueNames`, `beautyOfJoseonUsProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; stub `productPdp` worker OK initially |
| HTTP client | `httpClient.ts` — throttle, cookie, UA override for `beautyofjoseon.com` |
| HTTP routes | `server.ts` — `POST /jobs/beauty-of-joseon-us/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products`, `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Add `https://beautyofjoseon.com/` to `scripts/probeRetailerStorefronts.ts` default URL list |
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
| `discoverBeautyOfJoseonUsSellerCategoryNodes.ts` | `beautyOfJoseonUs/` | Job glue + exclude regex → `seller_categories` |
| `summarizeBeautyOfJoseonUsListingFields.ts` | `beautyOfJoseonUs/` | Typed summary for upsert |
| `upsertProductFromBeautyOfJoseonUsHit.ts` | `beautyOfJoseonUs/` | Single DB choke point |
| Jobs | `beautyOfJoseonUs/jobs/` | Mirror `sokoGlam/jobs/`; concurrency **1** |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/beauty-of-joseon-us/seller-category-hierarchy
# POST /jobs/beauty-of-joseon-us/sitemap-products  { "maxProducts": 20 }
# POST /jobs/beauty-of-joseon-us/category-products  { "maxSellerCategories": 1 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from sitemap smoke; `seller_products` + `seller_product_prices` rows visible for `Beauty of Joseon US`; brand name **`Beauty of Joseon`**; `buildSellerProductPageUrl` returns valid `beautyofjoseon.com` links for smoke handles.

**Full catalog note:** ~48 SKUs — a full sitemap ingest is trivial after spike approval (single job run).

---

## Phase 4 — PDP + spec enrichment

| Component | Location | Purpose |
|-----------|----------|---------|
| `mapShopifyProductJsonToPdpFields.ts` | **`shopify/`** | Reuse unchanged |
| `mapBeautyOfJoseonUsProductJsonToSpecRows.ts` | `beautyOfJoseonUs/` | Wraps shared PDP fields → `ProductSellerSpec` rows with **`BOJ `** prefix |
| `enrichProductPdp.ts` job | `beautyOfJoseonUs/jobs/` | Re-fetch via `fetchShopifyProductJson`; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | `beautyOfJoseonUs/jobs/` | Keyset batch from Postgres → `addBulk` |
| Reviews | — | **Optional v1** — only ingest if spike finds stable Yotpo/Judge.me public API |

---

## Phase 5 — Docs + roadmap + backend follow-ups

| Task | Location |
|------|----------|
| Spike notes | `docs/beautyOfJoseonUsSpike.md` |
| Roadmap | `docs/kBeautyRetailerRoadmap.md` — add Beauty of Joseon US under **Candidates pool** or new **Brand official stores** row with status **Done** when shipped |
| Playbook | No new subsection required if Shopify retailers section exists from ALE-58; add one-line cross-link if missing |
| Queue hygiene script | `scripts/beautyOfJoseonUsProductQueue.ts` (optional; copy Soko Glam script) |
| Thumbnails | `getProductThumbnailUrl` — `images[0].src` from `BOJ Thumbnail URL` spec or Shopify CDN fallback |

---

## Test plan

### Scrapers

- Reuse **`shopify/`** unit tests from ALE-58; add BOJ fixtures only if JSON shape differs.
- Unit test for `upsertProductFromBeautyOfJoseonUsHit` with mocked prisma (match Soko Glam test style).
- Manual: sitemap smoke 20 products; full-catalog run optional (~48 SKUs); verify Bull Board completion; query DB for seller name + URL template + brand `Beauty of Joseon`.

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
| Collection sitemap noise (232 vs ~48 products) | Exclude regex in env; document in spike; sitemap is primary source |
| Bare host vs `www` drift | Lock `BEAUTY_OF_JOSEON_US_SITE_BASE_URL` on bare host; spike confirms redirects |
| Multi-variant pricing on cards | Min available variant price; spike multi-variant PDP |
| `handle` changes break old SKUs | Rare; monitor 404 on JSON fetch; optional `BOJ Shopify product id` spec |
| Cloudflare tightens bot rules | Chrome UA + optional cookie; Playwright fallback only if JSON blocked |
| SKU collision with another retailer | Handles are retailer-specific strings; monitor uniqueness in smoke |
| Cross-retailer BOJ dedupe | Out of scope v1; same brand sold elsewhere is expected |
| Lifestyle merch in product sitemap | Spike decides ingest vs exclude |
| Architect rejects seed timing | Spike + doc review before DDL |

---

## Implementation TODO

- [ ] **Phase 0:** Complete spike; write `docs/beautyOfJoseonUsSpike.md`; add `debugBeautyOfJoseonUsUrls.ts`
- [ ] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, variant pricing rule, and collection exclude list in spike doc
- [ ] **Phase 0:** Confirm `products.json` pagination (`page` param, max `limit`, termination)
- [ ] **Phase 0:** Diff vs Soko Glam — confirm no `shopify/` changes required
- [ ] **Phase 0:** Decide lifestyle merch ingest policy (fabric/accessory PDPs)
- [ ] **Phase 1:** Architect approval for Beauty of Joseon US seller + staging category seed migration
- [ ] **Phase 1:** Apply migration; `db:pull` in scrapers
- [ ] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [ ] **Phase 2:** Implement `src/scrapers/beautyOfJoseonUs/*` (copy from `sokoGlam/`); jobs call `shopify/` with `siteBaseUrl` from env
- [ ] **Phase 3:** Sitemap + collection JSON fetch + `upsertProductFromBeautyOfJoseonUsHit`; smoke ingest (20+ products)
- [ ] **Phase 3:** Unit tests for upsert (when fixtures exist)
- [ ] **Phase 4:** PDP enrichment job + spec mapping + enqueue-all routes
- [ ] **Phase 4:** Unit tests for PDP mappers (when fixtures exist)
- [ ] **Phase 5:** Update `kBeautyRetailerRoadmap.md` (Beauty of Joseon US entry) and probe defaults
- [ ] **Follow-up:** Thumbnail resolver fallback after ingest (if needed)
