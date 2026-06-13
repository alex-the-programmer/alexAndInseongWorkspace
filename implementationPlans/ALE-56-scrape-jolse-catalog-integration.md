# ALE-56 Scrape Jolse catalog integration

## Context

[Linear ALE-56](https://linear.app/dewly/issue/ALE-56/scrape-jolse-catalog-integration): add a **full retailer integration** for [Jolse](https://www.jolse.com/) (priority **4** on the K-beauty retailer roadmap).

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook (same BullMQ + upsert shape as Olive Young / StyleKorean).

**Branch:** `ALE-56-scrape-jolse-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — Jolse row (currently **Planned**).
- `commerce-platform-scrapers/docs/styleKoreanSpike.md` — closest prior art (sitemap + category HTML listing + stub PDP).
- [ALE-57](ALE-57-scrape-stylevana-catalog-integration.md) — parallel planned retailer (Magento + Cloudflare); Jolse is lower friction.
- [ALE-53](ALE-53-scrape-olive-young-us-catalog.md) — recent full integration reference (queues, upsert choke point, enqueue-all PDP).

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `Jolse` as its own `sellers` row with US `productUrlTemplate` |
| Listing ingest | Discover SKUs via gzip sitemap + category HTML; persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs (and optionally reviews) from Cafe24 PDP HTML — phase after listing is stable |
| Operations | BullMQ namespace `jolse.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Roadmap | Move Jolse from **Planned** → **Done** in `kBeautyRetailerRoadmap.md` |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges.
- Frontend changes.
- Jolse KR / other locale storefronts — ingest **US English** (`en_US`) site only.
- Full taxonomy unification beyond staging category.

---

## Current state

### Jolse storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **Cafe24** (`CAFE24.*`, `EC_JET` error tracer, `cafe24img.poxo.com` media CDN) |
| CDN | **openresty** with edge cache (`x-cache: HIT`); not Cloudflare on anonymous homepage GETs |
| Bot wall | Homepage + category listing + PDP return **200** from datacenter `curl` with Chrome UA |
| Hosts | Sitemap uses `jolse.com`; `www.jolse.com` also works — pick one canonical base in env |
| Sitemap | `https://jolse.com/sitemap.xml` → **`sitemap0.xml.gz`**, **`sitemap1.xml.gz`** (gzip-compressed urlsets) |
| Sitemap size | ~**4,678** product PDP `<loc>` entries (`sitemap0`: ~3,634 products; `sitemap1`: ~1,044 products) |
| Category URLs | `/product/list.html?cate_no=<digits>`; pagination via `?page=N` (relative links on listing pages) |
| Product URLs (canonical) | `/product/{slug}/{productNo}/` e.g. `/product/apieu-18-first-toner-180ml/103340/` |
| Product URLs (legacy) | `/product/detail.html?product_no={productNo}` → **301** to canonical slug URL |
| Product id | Numeric **`product_no`** in HTML/JS (`productNo = '92503'`) |
| `robots.txt` | Disallows `/api`, `/exec/front/`, `/member/` — treat Cafe24 front APIs as **unlikely for v1** |
| Images | `og:image` on PDP points at `cafe24img.poxo.com/...` (absolute CDN URLs) |

**Implication:** Jolse is a strong fit for the **StyleKorean** integration shape (sitemap discovery + category HTML enrichment + PDP HTML specs). Unlike Stylevana, HTML is reachable from Node without Playwright in early probes. **New requirement:** gzip sitemap support (not needed for other retailers today).

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| YesStyle | `yesStyle.*` | Category sitemap + HTML (blocked by default) | `upsertProductFromYesStyleHit` |

Jolse should follow the **StyleKorean** shape, with Jolse-specific URL patterns and **gzip sitemap** handling.

`queueNames.ts` today defines namespaces for `oliveYoung`, `yesStyle`, `styleKorean`, and `oliveYoungUs` only — Jolse adds `jolse.*`.

### Backend card links

Jolse will be **`linkable = true`** (default). Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | Jolse target (ALE-56) |
|------|-------|------------------------|
| `sellers` row | None | **`Jolse`** + US `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / Jolse`** |
| SKU key | N/A | Numeric **`product_no`** (e.g. `92503`) |
| Listing discovery | N/A | **Gzip product sitemap** (+ category HTML for price/name refresh) |
| Scraper package | N/A | **`src/scrapers/jolse/*`** |
| Queue namespace | N/A | **`jolse.*`** |
| HTTP client | No Jolse host rules; **no gzip body helper** | Throttle + optional cookie + UA override; **gunzip for `.xml.gz` sitemaps** |
| Thumbnail resolver | No Jolse branch | Likely `og:image` fallback (same pattern as StyleKorean) after PDP ingest |

---

## Design decisions

### 1. US storefront only, canonical base `https://www.jolse.com` (proposed)

- Sitemap index is served from `jolse.com` (no `www`); both hosts resolve. Standardize env `JOLSE_SITE_BASE_URL` on **`https://www.jolse.com`** and normalize sitemap locs to that host when enqueueing.
- Spike must confirm no material catalog split between hosts.

### 2. Queue namespace `jolse.*` (locked)

Mirror StyleKorean queue set:

```ts
jolse.sellerCategoryHierarchy
jolse.sellerCategoryMapping
jolse.categoryProducts
jolse.sitemapProducts
jolse.product
jolse.productPdp
```

Worker concurrency: **`jolse.product` and `jolse.productPdp` at 1** initially.

### 3. `Product.sku` = numeric `product_no` (proposed — confirm in spike)

Extract from:

- Sitemap PDP loc: `/product/{slug}/{productNo}/`
- Category listing href: `/product/{slug}/{productNo}/category/{cateNo}/display/1/`
- PDP HTML: `product_no=…` / `productNo = '…'`

Do **not** prefix sku with `jolse:` unless collision testing against existing retailers requires it.

### 4. `Seller.productUrlTemplate` (proposed — confirm in spike)

**Preferred:**

```text
https://www.jolse.com/product/detail.html?product_no={{sku}}
```

Verified: returns **301** to canonical slug PDP. Stable for cards without storing slugs in `Product`.

### 5. Listing before PDP (locked)

**Phase A** — sitemap + category listing → `upsertProductFromJolseHit` (brand, product, seller_product, price, listing specs).

**Phase B** — `jolse.productPdp` enrichment once listing queue is stable.

### 6. HTTP client reuse + Jolse host rules (locked)

Extend `src/lib/httpClient.ts`:

- `JOLSE_REQUEST_DELAY_MS` throttle for `*.jolse.com`
- `JOLSE_BROWSER_COOKIE` optional cookie injection
- Chrome desktop UA substitution when `SCRAPER_USER_AGENT` is the default bot string (same pattern as StyleKorean)
- **`fetchTextGzip` or equivalent** — decompress `.gz` sitemap responses (`Content-Encoding: gzip` or `.xml.gz` URL suffix)

Respect `robots.txt` `Crawl-delay: 10` for bingbot as a signal — default throttle ≥ **900ms** (match StyleKorean).

### 7. Sitemap-first ingest with category enrichment (proposed)

1. **Product sitemap walk** — parse `sitemap0.xml.gz` + `sitemap1.xml.gz`; filter `<loc>` matching `/product/{slug}/{productNo}/`; enqueue minimal listing jobs (id-only), mirroring `styleKorean.scrapeSitemapProducts` + `sitemapProductNoToListingFields`.
2. **Category discovery** — Jolse **does not** expose category URLs in `sitemap0` (CMS/board pages only). Seed `seller_categories` by crawling top-nav / category tree from homepage + `list.html?cate_no=` links (similar to YesStyle category sitemap fallback).
3. **Category products job** — paginate `?page=N` on each `seller_categories.url` to refresh **price, brand, name, thumbnail** for SKUs on listing pages.

**Priority:** sitemap jobs > category listing jobs (`jolseProductIngestPriorities` mirroring StyleKorean).

### 8. Category hierarchy (`cate_no`) — spike → then lock

Cafe24 `cate_no` may not follow StyleKorean’s `ca_id` two-digit-prefix tree. Spike must document parent/child rules (or flat categories with `parentSellerCategoryId = null` when parent rows are missing — same escape hatch as StyleKorean).

### 9. Spec prefix `JL ` (proposed)

PDP-derived specs use prefix **`JL `** (e.g. `JL Thumbnail URL`, `JL Description`, `JL Ingredients`) for manual curation batches — mirror `SK ` / `OY ` conventions in backend scripts.

---

## Phase 0 — Spike (gate before bulk ingest)

**Deliverable:** `commerce-platform-scrapers/docs/jolseSpike.md` (same shape as `styleKoreanSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://www.jolse.com/` (with backend env) and record friction.
2. Confirm gzip sitemap walk end-to-end from Node (decompress + parse); count product PDP URLs.
3. Lock regex for `product_no` extraction from sitemap loc, listing HTML, and PDP HTML.
4. Discover category tree: enumerate `cate_no` values from nav; document hierarchy rule.
5. From one category listing (`cate_no=24`, pages 1–2) and one PDP, capture:
   - product name, brand, price (USD), sale price if any, thumbnail `src`, availability
   - pagination termination (`?page=N` empty vs repeat)
6. Test whether **Chrome UA + optional cookie** remains sufficient from production scraper hosts (no Playwright).
7. Propose locked `productUrlTemplate`, `Product.sku` field, and listing field mapping.
8. Note review widget presence — defer review ingest unless spike finds a stable public endpoint.
9. Document 429/403 behavior and recommended `JOLSE_REQUEST_DELAY_MS`.
10. Check `/exec/front/` or other Cafe24 JSON endpoints — only adopt if HTML parsing is brittle.

**Debug script (add in spike PR):** `scripts/debugJolseUrls.ts` — prints sample `product_no` values from gzip sitemap + one listing page without DB writes.

**Early spike observations (June 2026 — replace with spike doc):**

- Sitemap index + gzip urlsets: **200 OK** from Node `curl | gunzip`.
- Homepage, category listing, PDP HTML: **200 OK** from Node curl with Chrome UA.
- ~**4,678** product URLs in gzip sitemaps.
- `detail.html?product_no=` resolves to canonical slug PDP.
- **Gap:** scrapers `httpClient` has **no gzip helper** yet — must add before sitemap job.

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.

### Schema change

**None** — reuse existing `sellers`, `product_categories`, `currencies` tables.

### Data changes (migration SQL)

| Table | Action |
|-------|--------|
| `sellers` | **INSERT** row: `name = 'Jolse'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = `https://www.jolse.com/product/detail.html?product_no={{sku}}` |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / Jolse'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_56_jolse_seller_and_staging_category`

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs a Jolse-specific branch after PDP specs exist (see Phase 5).

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `JOLSE_SELLER_NAME`, `JOLSE_STAGING_PRODUCT_CATEGORY_NAME`, `JOLSE_SITE_BASE_URL`, `JOLSE_SITEMAP_INDEX_URL`, throttle knobs, optional cookie |
| Entity resolvers | `ensureCommerceEntities.ts` — `findJolseSeller`, `findStagingProductCategoryForJolse` |
| Constants | `src/scrapers/jolse/jolseConstants.ts` |
| Queue names | `queueNames.ts` — `jolseQueueNames`, `jolseProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; stub `productPdp` worker OK initially |
| HTTP client | `httpClient.ts` — throttle, cookie, UA override for `jolse.com`; **gzip fetch helper** |
| HTTP routes | `server.ts` — `POST /jobs/jolse/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products`, `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Already includes Jolse in `scripts/probeRetailerStorefronts.ts` — no change required |
| `.env.example` | Document all new knobs |

---

## Phase 3 — Listing ingest

Implement after spike doc is approved.

| Component | Purpose |
|-----------|---------|
| `collectJolseProductNosFromSitemaps.ts` | Walk `JOLSE_SITEMAP_INDEX_URL`; gunzip child sitemaps; extract `product_no` from PDP `<loc>` |
| `discoverJolseSellerCategoryNodes.ts` | Seed `seller_categories` from nav / `list.html?cate_no=` discovery |
| `fetchJolseCategoryListingPage.ts` | Paginated HTML parse for one `seller_categories.url` (`?page=N`) |
| `extractJolseProductNosFromListingHtml.ts` | Regex extract from `/product/{slug}/{productNo}/…` hrefs |
| `listingHitToListingFields.ts` / `sitemapProductNoToListingFields.ts` | Normalize → upsert payload |
| `summarizeJolseListingFields.ts` | Typed summary of raw listing fields |
| `upsertProductFromJolseHit.ts` | Single DB choke point (mirror `upsertProductFromStyleKoreanHit`) |
| Jobs | `sellerCategoryHierarchy`, `sellerCategoryMapping`, `scrapeCategoryProducts`, `scrapeSitemapProducts`, `scrapeProduct` |
| `scrapeProduct.ts` worker | Concurrency **1**; `P2002`-aware upserts |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/jolse/seller-category-hierarchy
# POST /jobs/jolse/sitemap-products  { "maxProducts": 20 }
# POST /jobs/jolse/category-products  { "maxSellerCategories": 1 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from sitemap smoke; `seller_products` + `seller_product_prices` rows visible for `Jolse`; `buildSellerProductPageUrl` returns valid `jolse.com` links for smoke SKUs.

---

## Phase 4 — PDP + spec enrichment

| Component | Purpose |
|-----------|---------|
| `fetchJolseProductPdp.ts` | PDP HTML fetch (reuse redirect-cookie pattern from `styleKoreanPdp.ts` if needed) |
| `mapJolsePdpToSpecRows.ts` | `ProductSellerSpec` rows; prefix specs `JL ` |
| `enrichProductPdp.ts` job | One job per `product_no`; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | Keyset batch from Postgres → `addBulk` |
| Reviews | **Optional v1** — only ingest if spike finds stable Cafe24 review API or parseable HTML block |

---

## Phase 5 — Docs + roadmap + backend follow-ups

| Task | Location |
|------|----------|
| Spike notes | `docs/jolseSpike.md` |
| Roadmap row | `docs/kBeautyRetailerRoadmap.md` — Jolse: Planned → In progress → Done |
| Playbook cross-link | One paragraph in `retailerScrapingPlaybook.md` (Cafe24 + gzip sitemap pattern) |
| Queue hygiene script | `scripts/jolseProductQueue.ts` (optional; copy StyleKorean script) |
| Thumbnails | `getProductThumbnailUrl` — `fetchJolseOgImage` fallback if `JL Thumbnail URL` not yet populated |

---

## Test plan

### Scrapers

- Unit tests for `product_no` extraction regexes and listing field mappers with **fixture HTML** from spike.
- Unit test for gzip sitemap parser with a **small fixture** `.xml.gz` blob.
- Unit test for `upsertProductFromJolseHit` with mocked prisma (match StyleKorean test style if present).
- Manual: sitemap smoke 20 products; verify Bull Board completion; query DB for seller name + URL template.

### Backend

- No migration logic tests required beyond existing patterns; manually verify seller row after migrate.
- Optional: unit test `buildSellerProductPageUrl` with Jolse template + sample sku once locked.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build` (includes `prisma generate`)

---

## Risks

| Risk | Mitigation |
|------|------------|
| Gzip sitemap parsing missing | Add dedicated helper in Phase 0; unit test with fixture |
| `cate_no` hierarchy unclear | Spike nav crawl; allow flat categories with null parent |
| Category URLs absent from sitemap | Nav crawl + listing cross-links (documented in spike) |
| Cafe24 `/api` blocked | HTML-only v1; no dependency on `/exec/front/` |
| openresty cache serves stale prices | Category refresh job; log last-seen price on upsert |
| Rate limiting / crawl-delay | `JOLSE_REQUEST_DELAY_MS` ≥ 900ms; concurrency 1 |
| SKU collision with another retailer | Numeric ids are retailer-specific; monitor `Product.sku` uniqueness conflicts in smoke |
| Architect rejects seed timing | Spike + doc review before DDL |
| Slug changes break non-template links | Use `detail.html?product_no=` template for cards |

---

## Implementation TODO

- [x] **Phase 0:** Complete spike; write `docs/jolseSpike.md`; add `debugJolseUrls.ts`
- [x] **Phase 0:** Add gzip sitemap fetch/parse helper; unit test with fixture (fixture tests deferred — no test harness)
- [x] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, `cate_no` hierarchy, and HTML parse selectors in spike doc
- [x] **Phase 1:** Architect approval for Jolse seller + staging category seed migration
- [x] **Phase 1:** Apply migration; `db:pull` in scrapers
- [x] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [x] **Phase 3:** Sitemap + category listing fetch + `upsertProductFromJolseHit`; smoke ingest (4,719 products locally)
- [ ] **Phase 3:** Unit tests for mappers/upsert (when fixtures exist)
- [x] **Phase 4:** PDP enrichment job + spec mapping + enqueue-all routes
- [ ] **Phase 4:** Unit tests for PDP mappers (when fixtures exist)
- [x] **Phase 5:** Update `kBeautyRetailerRoadmap.md` and playbook cross-link
- [ ] **Follow-up:** Thumbnail `og:image` fallback in `getProductThumbnailUrl` after ingest (if needed)
