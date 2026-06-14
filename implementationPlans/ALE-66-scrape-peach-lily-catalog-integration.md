# ALE-66 Scrape Peach & Lily catalog integration

## Context

[Linear ALE-66](https://linear.app/dewly/issue/ALE-66/scrape-peach-and-lily-catalog-integration): add a **full retailer integration** for [Peach & Lily](https://www.peachandlily.com/) — a **US-based K-beauty specialist** (curated multi-brand boutique with a strong house brand).

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook. Peach & Lily is a **Shopify storefront** and should reuse the shared `src/scrapers/shopify/` platform layer introduced in [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) — same thin-retailer pattern as [ALE-59](ALE-59-scrape-wishtrend-catalog-integration.md).

**Branch:** `ALE-66-scrape-peach-lily-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — Peach & Lily is **not yet listed**; add during Phase 5.
- [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) — **hard dependency**: shared Shopify platform layer (`shopify/`) + reference retailer wiring (`sokoGlam/`).
- [ALE-59](ALE-59-scrape-wishtrend-catalog-integration.md) — closest parallel (second Shopify retailer; copy wiring shape).

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

**Prerequisite:** Merge or cherry-pick ALE-58’s `src/scrapers/shopify/` module before starting Phase 2. If ALE-58 is not landed, implement only Phase 0 spike + backend migration prep; do not duplicate Shopify fetch/parse code into `peachAndLily/`.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `Peach & Lily` as its own `sellers` row with US `productUrlTemplate` |
| Listing ingest | Discover SKUs via product sitemap + collection JSON; persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs from Shopify product JSON (`body_html`, `tags`, `product_type`, images) via shared `shopify/` mappers |
| Operations | BullMQ namespace `peachAndLily.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Shopify reuse | **No new platform code** unless spike finds a Peach & Lily-only protocol gap; thin `peachAndLily/` folder only |
| Roadmap | Add Peach & Lily row → **In progress** → **Done** in `kBeautyRetailerRoadmap.md` |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges.
- Frontend changes.
- Non-US Shopify markets / localized storefront paths — ingest **US** (`www.peachandlily.com`, `localization=US`) only.
- Full taxonomy unification beyond staging category.
- Shopify **UCP/MCP** agent checkout APIs (`sitemap_agentic_discovery.xml`, `agents.md`) — catalog-only HTTP JSON is sufficient for scrapers.
- Per-variant `Product` rows (YesStyle-style) unless spike proves parent-product pricing is unusable for cards.
- Blog / editorial content ingest (`sitemap_blogs_1.xml`).

---

## Current state

### Peach & Lily storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **Shopify** (`shopify-complexity-score` header, `cdn.shopify.com` preconnect, `cart_currency=USD`) |
| CDN | `cdn.shopify.com` for product media; storefront assets on `www.peachandlily.com/cdn/shop/` |
| Bot wall | **Cloudflare** (`cf-ray`, `cf-cache-status`); anonymous GETs return **200** for sitemap and JSON endpoints |
| Canonical host | `peachandlily.com` **301** → `https://www.peachandlily.com/` (`x-redirect-reason: canonical_host_redirection`) — **use `www`** |
| Sitemap index | `https://www.peachandlily.com/sitemap.xml` → `sitemap_products_1.xml`, `sitemap_collections_1.xml`, pages, blogs, `sitemap_agentic_discovery.xml` |
| Product catalog size | ~**137** PDP `<loc>` entries in `sitemap_products_1.xml` (includes root `/` loc; ~136 product handles) |
| Collection catalog size | ~**121** collection URLs in `sitemap_collections_1.xml` |
| Product URLs | `/products/{handle}` e.g. `/products/glass-skin-refining-serum`, `/products/hydrate-mask` |
| Collection URLs | `/collections/{handle}` e.g. `/collections/toners`, `/collections/cleansers` |
| Product JSON | `GET /products/{handle}.json` → full Shopify product payload — **200** from Node |
| Collection JSON | `GET /collections/{handle}/products.json?limit=250&page=N` — **200** (e.g. `toners` returns 10 products) |
| Variants | Multi-variant products common (e.g. Glass Skin Refining Serum: **3** variants); house-brand and third-party `vendor` values |
| Brand field | Shopify `vendor` maps to `brands.name` (e.g. `Peach & Lily` for house brand; third-party K-beauty brands also present) |
| Currency | USD |

**Implication:** Peach & Lily is structurally identical to Soko Glam / Wishtrend for scraper purposes. ALE-66 should be a **thin retailer adapter** on top of `shopify/` — expect a **small diff** (smaller catalog than Soko Glam). **Host difference:** canonical base is **`https://www.peachandlily.com`** (with `www`), not bare domain.

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| Jolse | `jolse.*` | Gzip product sitemaps + category HTML | `upsertProductFromJolseHit` |
| Soko Glam | `sokoGlam.*` | Product sitemap + collection JSON | `upsertProductFromSokoGlamHit` |
| Wishtrend | `wishtrend.*` | Product sitemap + collection JSON | `upsertProductFromWishtrendHit` |
| YesStyle | `yesStyle.*` | Category sitemap + HTML (blocked by default) | `upsertProductFromYesStyleHit` |

Peach & Lily should **copy the Soko Glam / Wishtrend wiring shape** and call the same `shopify/` helpers with `siteBaseUrl = https://www.peachandlily.com`.

`queueNames.ts` today defines namespaces for `oliveYoung`, `yesStyle`, `styleKorean`, `jolse`, `oliveYoungUs`, and (after ALE-58) `sokoGlam` — Peach & Lily adds `peachAndLily.*`.

### Backend card links

Peach & Lily will be **`linkable = true`** (default). Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | Peach & Lily target (ALE-66) |
|------|-------|------------------------------|
| `sellers` row | None | **`Peach & Lily`** + US `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / Peach & Lily`** |
| SKU key | N/A | Shopify product **`handle`** (slug string) — same as Soko Glam |
| Listing discovery | N/A | Reuse `shopify/collectProductHandlesFromSitemaps` + `fetchShopifyCollectionProductsPage` |
| Fetch layer | Exists after ALE-58 | **Reuse `shopify/` unchanged** |
| Scraper package | N/A | **`src/scrapers/peachAndLily/*`** (jobs, constants, upsert, spec prefix) only |
| Queue namespace | N/A | **`peachAndLily.*`** |
| HTTP client | No `peachandlily.com` host rules | Throttle + optional cookie + UA override (Cloudflare) |
| Roadmap row | Missing | Add Peach & Lily to `kBeautyRetailerRoadmap.md` |

---

## Design decisions

### 1. US storefront only, canonical base `https://www.peachandlily.com` (proposed)

- Standardize env `PEACH_AND_LILY_SITE_BASE_URL` on **`https://www.peachandlily.com`** (with `www`).
- Bare `peachandlily.com` redirects to `www`; sitemap `<loc>` values already use `www`.
- Unlike Soko Glam / Wishtrend, do **not** strip `www` from the canonical base.

### 2. Queue namespace `peachAndLily.*` (locked)

Mirror Soko Glam / Wishtrend queue set:

```ts
peachAndLily.sellerCategoryHierarchy
peachAndLily.sellerCategoryMapping
peachAndLily.categoryProducts
peachAndLily.sitemapProducts
peachAndLily.product
peachAndLily.productPdp
```

Worker concurrency: **`peachAndLily.product` and `peachAndLily.productPdp` at 1** initially.

### 3. `Product.sku` = Shopify product `handle` (proposed — confirm in spike)

Extract from:

- Sitemap PDP loc: `/products/{handle}`
- Collection JSON: `product.handle`
- Product JSON: `product.handle`

**Do not** use numeric `product.id` as `Product.sku` unless spike finds handle collisions or churn.

### 4. One `Product` row per Shopify product, not per variant (proposed)

- Upsert **one** commerce `Product` per Shopify parent product (`handle`).
- **Price** on `seller_product_prices`: use the **minimum** `variant.price` among **available** variants (shared `shopify/minAvailableVariantPrice.ts`).
- Store variant count / option summary in listing specs if useful (`PL Variant count`, `PL Options`).

### 5. `Seller.productUrlTemplate` (proposed)

```text
https://www.peachandlily.com/products/{{sku}}
```

where `{{sku}}` is the product `handle`.

### 6. Listing before PDP (locked)

**Phase A** — sitemap + collection JSON → `upsertProductFromPeachAndLilyHit` (brand, product, seller_product, price, listing specs from product JSON).

**Phase B** — `peachAndLily.productPdp` enrichment for `body_html` flattening, tags, images once listing is stable.

Because Shopify `.json` returns rich PDP fields, Phase A jobs should still fetch product JSON unless queue pressure requires a two-step id-only → enrich split.

### 7. HTTP client reuse + Peach & Lily host rules (locked)

Extend `src/lib/httpClient.ts`:

- `PEACH_AND_LILY_REQUEST_DELAY_MS` throttle for `*.peachandlily.com`
- `PEACH_AND_LILY_BROWSER_COOKIE` optional cookie injection
- Chrome desktop UA substitution when `SCRAPER_USER_AGENT` is the default bot string

Default throttle ≥ **700ms** (tune in spike).

### 8. Sitemap-first ingest with collection enrichment (proposed)

1. **Product sitemap walk** — parse `sitemap_products_1.xml`; filter `<loc>` matching `/products/{handle}`; skip root `/` loc and non-product paths.
2. **Collection discovery** — parse `sitemap_collections_1.xml` → `seller_categories` rows. Filter marketing / checkout collections in spike (`gift-cards`, etc.).
3. **Category products job** — paginate `GET /collections/{handle}/products.json?limit=250&page=N`.

**Priority:** sitemap jobs > collection listing jobs (`peachAndLilyProductIngestPriorities` mirroring Soko Glam).

### 9. Collection hierarchy — flat v1 (proposed)

Shopify collection sitemaps do **not** expose parent/child trees. v1: flat `seller_categories` with `parentSellerCategoryId = null`.

### 10. Spec prefix `PL ` (proposed)

PDP-derived specs use prefix **`PL `** (e.g. `PL Thumbnail URL`, `PL Description`, `PL Product type`, `PL Tags`) — mirror `SG ` / `WT ` conventions.

### 11. Shopify platform reuse (locked)

| Layer | Location | ALE-66 action |
|-------|----------|---------------|
| Sitemap walk, JSON fetch, listing/PDP mappers | `src/scrapers/shopify/*` | **Reuse unchanged** |
| BullMQ jobs, upsert, spec prefix, env, routes | `src/scrapers/peachAndLily/*` | **Copy/adapt from `sokoGlam/`** with find-replace |

**Stays in `src/scrapers/peachAndLily/` (not shared):**

```text
peachAndLilyConstants.ts
summarizePeachAndLilyListingFields.ts
upsertProductFromPeachAndLilyHit.ts
mapPeachAndLilyProductJsonToSpecRows.ts   # applies PL prefix
jobs/*
```

---

## Phase 0 — Spike (gate before bulk ingest)

**Deliverable:** `commerce-platform-scrapers/docs/peachAndLilySpike.md` (same shape as `sokoGlamSpike.md` / `wishtrendSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://www.peachandlily.com/` and record friction.
2. Confirm product sitemap walk end-to-end from Node; reconcile ~137 loc count vs product handle count.
3. Lock regex for `handle` extraction from sitemap loc and collection/product JSON.
4. Enumerate collections from sitemap; propose exclude list (gift cards, promos, empty collections).
5. From one collection (`toners`, `cleansers`) and one multi-variant PDP JSON, capture name, brand (`vendor`), min price, thumbnail, availability, pagination termination.
6. Confirm **parent product vs per-variant** `Product` rows (default: parent product).
7. Test Chrome UA + optional cookie from production scraper hosts.
8. Lock `productUrlTemplate`, `Product.sku` field, and JSON field mapping.
9. Note review widget presence — defer review ingest unless spike finds stable public endpoint.
10. Document 429/403 behavior and recommended `PEACH_AND_LILY_REQUEST_DELAY_MS`.
11. Confirm `www` vs bare host behavior for all JSON/sitemap URLs.

**Debug script (add in spike PR):** `scripts/debugPeachAndLilyUrls.ts` — prints sample handles from product sitemap + one collection `products.json` page without DB writes.

**Early spike observations (June 2026 — replace with spike doc):**

- Sitemap + product/collection JSON: **200 OK** from Node `curl` with Chrome UA.
- ~**137** product sitemap locs (~**121** collections).
- `GET /products/glass-skin-refining-serum.json` returns full variant arrays and `body_html`.
- `GET /collections/toners/products.json?limit=250` returns products.
- Canonical host is **`www.peachandlily.com`** (bare domain redirects).

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.

### Schema change

**None** — reuse existing `sellers`, `product_categories`, `currencies` tables.

### Data changes (migration SQL)

| Table | Action |
|-------|--------|
| `sellers` | **INSERT** row: `name = 'Peach & Lily'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = `https://www.peachandlily.com/products/{{sku}}` |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / Peach & Lily'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_66_peach_and_lily_seller_and_staging_category`

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs a Peach & Lily-specific branch after PDP specs exist (see Phase 5).

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `PEACH_AND_LILY_SELLER_NAME`, `PEACH_AND_LILY_STAGING_PRODUCT_CATEGORY_NAME`, `PEACH_AND_LILY_SITE_BASE_URL`, `PEACH_AND_LILY_SITEMAP_INDEX_URL`, throttle knobs, optional cookie, `PEACH_AND_LILY_COLLECTION_PRODUCTS_PAGE_SIZE` (default 250), collection exclude regex |
| Entity resolvers | `ensureCommerceEntities.ts` — `findPeachAndLilySeller`, `findStagingProductCategoryForPeachAndLily` |
| Constants | `src/scrapers/peachAndLily/peachAndLilyConstants.ts` — spec prefix `PL `, default collection exclude regex |
| Queue names | `queueNames.ts` — `peachAndLilyQueueNames`, `peachAndLilyProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; stub `productPdp` worker OK initially |
| HTTP client | `httpClient.ts` — throttle, cookie, UA override for `peachandlily.com` |
| HTTP routes | `server.ts` — `POST /jobs/peach-and-lily/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products`, `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Add `https://www.peachandlily.com/` to `scripts/probeRetailerStorefronts.ts` default URL list |
| `.env.example` | Document all new knobs |

**Copy source:** Use `sokoGlam/` (or `wishtrend/` if landed) as the template — rename namespace, env vars, spec prefix, and seller resolvers. Jobs call `shopify/` with `{ siteBaseUrl: env.PEACH_AND_LILY_SITE_BASE_URL }`.

---

## Phase 3 — Listing ingest

| Component | Location | Purpose |
|-----------|----------|---------|
| Sitemap / JSON helpers | **`shopify/`** | Reuse unchanged |
| `discoverPeachAndLilySellerCategoryNodes.ts` | `peachAndLily/` | Job glue: `shopify/` collectors + exclude regex → `seller_categories` |
| `summarizePeachAndLilyListingFields.ts` | `peachAndLily/` | Typed summary for upsert |
| `upsertProductFromPeachAndLilyHit.ts` | `peachAndLily/` | Single DB choke point |
| Jobs | `peachAndLily/jobs/` | `sellerCategoryHierarchy`, `sellerCategoryMapping`, `scrapeCategoryProducts`, `scrapeSitemapProducts`, `scrapeProduct` |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/peach-and-lily/seller-category-hierarchy
# POST /jobs/peach-and-lily/sitemap-products  { "maxProducts": 20 }
# POST /jobs/peach-and-lily/category-products  { "maxSellerCategories": 1 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from sitemap smoke; `seller_products` + `seller_product_prices` rows visible for `Peach & Lily`; `buildSellerProductPageUrl` returns valid `www.peachandlily.com` links.

---

## Phase 4 — PDP + spec enrichment

| Component | Location | Purpose |
|-----------|----------|---------|
| `mapShopifyProductJsonToPdpFields.ts` | **`shopify/`** | Reuse neutral PDP field struct |
| `mapPeachAndLilyProductJsonToSpecRows.ts` | `peachAndLily/` | Wraps shared PDP fields → `ProductSellerSpec` rows with **`PL `** prefix |
| `enrichProductPdp.ts` job | `peachAndLily/jobs/` | Re-fetch via `fetchShopifyProductJson`; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | `peachAndLily/jobs/` | Keyset batch from Postgres → `addBulk` |
| Reviews | — | **Optional v1** — only if spike finds stable public endpoint |

---

## Phase 5 — Docs + roadmap + backend follow-ups

| Task | Location |
|------|----------|
| Spike notes | `docs/peachAndLilySpike.md` |
| Roadmap row | `docs/kBeautyRetailerRoadmap.md` — **add** Peach & Lily row (suggested after Soko Glam / Wishtrend Shopify boutiques); Planned → In progress → Done |
| Playbook | No change unless spike surfaces a `www`-canonical Shopify edge case worth documenting in Shopify subsection |
| Queue hygiene script | `scripts/peachAndLilyProductQueue.ts` (optional) |
| Thumbnails | `getProductThumbnailUrl` — `PL Thumbnail URL` spec or Shopify CDN fallback |

---

## Test plan

### Scrapers

- Reuse existing **`shopify/`** unit tests; no new platform tests unless spike finds a gap.
- Unit test for `upsertProductFromPeachAndLilyHit` with mocked prisma (match Soko Glam test style).
- Manual: sitemap smoke 20 products; verify Bull Board completion; query DB for seller name + URL template.

### Backend

- No migration logic tests required beyond existing patterns; manually verify seller row after migrate.
- Optional: unit test `buildSellerProductPageUrl` with Peach & Lily template + sample handle.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build` (includes `prisma generate`)

---

## Risks

| Risk | Mitigation |
|------|------------|
| ALE-58 `shopify/` not landed | Phase 0 + migration prep only; do not fork Shopify logic into `peachAndLily/` |
| `www` vs bare host mismatch | Lock `PEACH_AND_LILY_SITE_BASE_URL` on `https://www.peachandlily.com`; spike verifies all locs |
| Multi-variant pricing on cards | Use min available variant price via shared helper |
| House brand `vendor` = `Peach & Lily` vs third-party brands | Normal `brands` upsert from `vendor`; no special case v1 |
| Collection sitemap noise | Exclude regex in env; document in spike |
| Cloudflare tightens bot rules | Chrome UA + optional cookie; Playwright fallback only if JSON blocked |
| Small catalog (~137 SKUs) | Fast to validate end-to-end; still follow queue/concurrency discipline |

---

## Implementation TODO

- [x] **Phase 0:** Complete spike; write `docs/peachAndLilySpike.md`; add `debugPeachAndLilyUrls.ts`
- [x] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, variant pricing rule, and collection exclude list in spike doc
- [x] **Phase 0:** Confirm `products.json` pagination and empty-collection handles
- [x] **Phase 1:** Architect approval for Peach & Lily seller + staging category seed migration
- [x] **Phase 1:** Apply migration; `db:pull` in scrapers
- [x] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes (depends on ALE-58 `shopify/`)
- [x] **Phase 2:** `peachAndLily/` wiring — copy from `sokoGlam/`; jobs call `shopify/` with `siteBaseUrl` from env
- [x] **Phase 3:** Sitemap + collection JSON fetch + `upsertProductFromPeachAndLilyHit`; smoke ingest (5/5 products in isolated worktree run)
- [ ] **Phase 3:** Unit tests for upsert (when fixtures exist)
- [ ] **Phase 4:** PDP enrichment job + spec mapping + enqueue-all routes
- [ ] **Phase 4:** Unit tests for PDP mappers (when fixtures exist)
- [ ] **Phase 5:** Add Peach & Lily to `kBeautyRetailerRoadmap.md` and mark Done after full ingest
- [ ] **Follow-up:** Thumbnail resolver fallback after ingest (if needed)
