# ALE-60 Scrape Tester Korea catalog integration

## Context

[Linear ALE-60](https://linear.app/dewly/issue/ALE-60/scrape-tester-korea-catalog-integration): add a **full retailer integration** for [Tester Korea](https://testerkorea.com/) (priority **8** on the K-beauty retailer roadmap).

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook (same BullMQ + upsert shape as StyleKorean / Jolse).

**Branch:** `ALE-60-scrape-tester-korea-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — Tester Korea row (currently **Planned**).
- [ALE-56](ALE-56-scrape-jolse-catalog-integration.md) — recent Cafe24 integration (category HTML + PDP).
- [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) — Shopify JSON pattern (not applicable here, but shows playbook variety).

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

**Platform note:** Tester Korea is the **first MakeShop storefront** in `commerce-platform-scrapers`. Unlike Jolse (Cafe24) or Soko Glam (Shopify), discovery is **category HTML only** — there is no working public product sitemap today.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `Tester Korea` as its own `sellers` row with US `productUrlTemplate` |
| Listing ingest | Discover SKUs via category tree crawl + paginated category HTML; persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs from MakeShop PDP HTML (`og:*`, price block, description) — phase after listing is stable |
| Operations | BullMQ namespace `testerKorea.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Roadmap | Move Tester Korea from **Planned** → **Done** in `kBeautyRetailerRoadmap.md` |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges.
- Frontend changes.
- Tester Korea KR / other locale storefronts — ingest **English** (`testerkorea.com`, `/js/default/EN/`) only.
- Full taxonomy unification beyond staging category.
- Board reviews (`/Board/list/board_name/review`) — optional follow-up; not required for catalog cards.
- Shared MakeShop platform layer — defer until a second MakeShop retailer (e.g. RoseRoseShop) is confirmed on the same stack.

---

## Current state

### Tester Korea storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **MakeShop** (`makeshop.setVariable`, `_makeshop_registerPrototype.js`, PHP `PHPSESSID`) |
| Server | **nginx**; no Cloudflare on anonymous homepage GETs |
| Bot wall | Homepage, category listing, and PDP return **200** from datacenter `curl` with Chrome UA |
| Canonical host | `www.testerkorea.com` **301** → `https://testerkorea.com/` — standardize env on **`https://testerkorea.com`** |
| Sitemap | `/sitemap.xml` returns literal **`E R R O R`** — **not usable** for v1 |
| `robots.txt` | Disallows `/Member/`, `/Payment/`, `/Search/` — no sitemap reference |
| Category URLs | `/Product/Category/list/cid/{cid}` with optional brand filter `/brand_code/{code}` |
| Pagination | `/Product/Category/list/cid/{cid}/page/{n}/pnum/{pageSize}` (e.g. `pnum/10` on sample pages) |
| Product URLs | `/Product/Detail/view/pid/{pid}/cid/{cid}` — **canonical** `/Product/Detail/view/pid/{pid}` (no `cid` required) |
| Product id | Numeric **`pid`** (e.g. `10610`, `10995`) |
| Currency | **USD** (`standard_currency: USD`, prices like `21.50USD`) |
| Images | `og:image` on PDP → absolute URLs under `testerkorea.com/storage/...` |
| Brand discovery | Category pages expose `brand_code` anchors; breadcrumb shows brand subcategories under `cid/112` (BRANDS) |

**Implication:** Tester Korea fits the **StyleKorean / Jolse category-HTML** integration shape, but **without a sitemap queue**. Primary discovery is: crawl category tree → paginate each `seller_categories` row → extract `pid` from listing HTML. Keep a `testerKorea.sitemapProducts` queue name for playbook consistency, but implement it as **“enqueue all known pids from category union”** or omit until spike confirms an alternate bulk-discovery path.

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| Jolse | `jolse.*` | Gzip product sitemaps + category HTML | `upsertProductFromJolseHit` |
| YesStyle | `yesStyle.*` | Category sitemap + HTML (blocked by default) | `upsertProductFromYesStyleHit` |

Tester Korea should follow the **Jolse / StyleKorean** job topology, with **category-first discovery** (closer to YesStyle’s category listing path when sitemap is sparse).

`queueNames.ts` today defines namespaces for `oliveYoung`, `yesStyle`, `styleKorean`, `jolse`, and `oliveYoungUs` only — Tester Korea adds `testerKorea.*`.

### Backend card links

Tester Korea will be **`linkable = true`** (default). Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | Tester Korea target (ALE-60) |
|------|-------|------------------------------|
| `sellers` row | None | **`Tester Korea`** + US `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / Tester Korea`** |
| SKU key | N/A | Numeric **`pid`** (e.g. `10610`) |
| Listing discovery | N/A | **Category tree crawl** + paginated HTML listing (no sitemap) |
| Scraper package | N/A | **`src/scrapers/testerKorea/*`** |
| Queue namespace | N/A | **`testerKorea.*`** |
| HTTP client | No Tester Korea host rules | Throttle + optional cookie + UA override for `testerkorea.com` |
| Thumbnail resolver | No Tester Korea branch | `og:image` fallback after PDP ingest (same pattern as Jolse) |

---

## Design decisions

### 1. English storefront only, canonical base `https://testerkorea.com` (proposed)

- `www` redirects to apex; env `TESTER_KOREA_SITE_BASE_URL` = **`https://testerkorea.com`**.
- All scrape paths are under `/Product/...` with EN frontend assets (`/js/default/EN/`).

### 2. Queue namespace `testerKorea.*` (locked)

Mirror StyleKorean / Jolse queue set:

```ts
testerKorea.sellerCategoryHierarchy
testerKorea.sellerCategoryMapping
testerKorea.categoryProducts
testerKorea.sitemapProducts   // optional alias: bulk re-enqueue from DB or category union — not XML sitemap
testerKorea.product
testerKorea.productPdp
```

Worker concurrency: **`testerKorea.product` and `testerKorea.productPdp` at 1** initially.

### 3. `Product.sku` = numeric `pid` (proposed — confirm in spike)

Extract from:

- Listing href: `/Product/Detail/view/pid/{pid}/cid/{cid}`
- PDP canonical: `/Product/Detail/view/pid/{pid}`
- PDP `makeshop.setVariable({ currenturl: '...' })` when present

Do **not** prefix sku with `testerKorea:` unless collision testing against existing retailers requires it.

### 4. `Seller.productUrlTemplate` (proposed — confirm in spike)

**Preferred:**

```text
https://testerkorea.com/Product/Detail/view/pid/{{sku}}
```

Verified: canonical link on PDP omits `cid`; stable for cards without storing category context.

### 5. Listing before PDP (locked)

**Phase A** — category crawl + listing HTML → `upsertProductFromTesterKoreaHit` (brand, product, seller_product, price, listing specs).

**Phase B** — `testerKorea.productPdp` enrichment once listing queue is stable.

### 6. HTTP client reuse + Tester Korea host rules (locked)

Extend `src/lib/httpClient.ts`:

- `TESTER_KOREA_REQUEST_DELAY_MS` throttle for `testerkorea.com`
- `TESTER_KOREA_BROWSER_COOKIE` optional cookie injection (`PHPSESSID`, `glog` if needed)
- Chrome desktop UA substitution when `SCRAPER_USER_AGENT` is the default bot string (same pattern as StyleKorean / Jolse)
- Default throttle ≥ **900ms** (match Jolse)

### 7. Category-first ingest (proposed)

1. **Category discovery** — crawl homepage nav + category pages for `/Product/Category/list/cid/{cid}` links; persist `seller_categories` (include brand-letter subcategories under BRANDS `cid/112` if needed for coverage).
2. **Category products job** — for each `seller_categories.url`, paginate `/page/{n}/pnum/{pageSize}` until:
   - zero new `pid` values, or
   - empty product grid, or
   - `TESTER_KOREA_LISTING_MAX_PAGES` cap.
3. **Dedup** — same `pid` may appear in multiple categories; upsert is idempotent on `Product.sku`.

**Priority:** category listing jobs use `testerKoreaProductIngestPriorities.categoryListingSource` (no separate sitemap priority unless bulk re-enqueue is added).

### 8. Category hierarchy (`cid`) — spike → then lock

MakeShop `cid` tree may be deeper than top-nav (e.g. BRANDS → letter bucket → brand). Spike must document:

- which `cid` rows are leaves vs parents
- whether to ingest parent categories (often empty grids) or leaves only
- `parentSellerCategoryId` mapping rule (mirror StyleKorean null-parent escape hatch)

### 9. Spec prefix `TK ` (proposed)

PDP-derived specs use prefix **`TK `** (e.g. `TK Thumbnail URL`, `TK Description`, `TK Ingredients`) for manual curation batches — mirror `JL ` / `SK ` / `OY ` conventions in backend scripts.

### 10. `testerKorea.sitemapProducts` semantics (proposed)

Because `/sitemap.xml` is broken, either:

- **Option A (recommended):** Implement queue as **“re-enqueue all distinct pids already in `seller_products` for Tester Korea”** for refresh runs (operational parity with other retailers’ sitemap smoke), **or**
- **Option B:** Omit route/queue until a valid sitemap or MakeShop export is found.

Spike must pick one and document in `testerKoreaSpike.md`.

---

## Phase 0 — Spike (gate before bulk ingest)

**Deliverable:** `commerce-platform-scrapers/docs/testerKoreaSpike.md` (same shape as `jolseSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://testerkorea.com/` (with backend env) and record friction.
2. Confirm **no** alternate sitemap (Google Search Console export, `sitemap_products.xml`, MakeShop admin feed) — document if found.
3. Lock regex for `pid` extraction from listing HTML and PDP HTML.
4. Discover full category tree: enumerate `cid` values from nav + in-category sidebars; document hierarchy rule.
5. From one category listing (`cid/102`, pages 1–3) and one PDP (`pid/10610`), capture:
   - product name, brand, price (USD), sale price if any, thumbnail `src`, sold-out markers
   - pagination termination (`/page/N/pnum/10` vs default page size)
6. Test whether **Chrome UA + optional cookie** remains sufficient from production scraper hosts (no Playwright).
7. Propose locked `productUrlTemplate`, `Product.sku` field, and listing field mapping (CSS selectors or regex on `product-item` tiles).
8. Estimate catalog size (union of pids across N sample categories × extrapolation).
9. Note review widget / board presence — defer review ingest unless spike finds stable public HTML.
10. Document 429/403 behavior and recommended `TESTER_KOREA_REQUEST_DELAY_MS`.

**Debug script (add in spike PR):** `scripts/debugTesterKoreaUrls.ts` — prints sample `pid` values from one category page + one PDP without DB writes.

**Early spike observations (June 2026 — replace with spike doc):**

- Homepage, category listing, PDP HTML: **200 OK** from Node curl with Chrome UA.
- `/sitemap.xml`: **not usable** (`E R R O R` body).
- Canonical PDP URL works **without** `cid`.
- Sample PDP has `og:title`, `og:image`, USD sell price (`21.50USD`).
- ~**60** product links on `cid/102` page 1; pagination URL shape observed as `/page/2/pnum/10`.
- **Gap:** pagination termination and full category tree size **unverified** — spike must lock before bulk ingest.

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.

### Schema change

**None** — reuse existing `sellers`, `product_categories`, `currencies` tables.

### Data changes (migration SQL)

| Table | Action |
|-------|--------|
| `sellers` | **INSERT** row: `name = 'Tester Korea'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = `https://testerkorea.com/Product/Detail/view/pid/{{sku}}` |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / Tester Korea'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_60_tester_korea_seller_and_staging_category`

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs a Tester-Korea-specific branch after PDP specs exist (see Phase 5).

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `TESTER_KOREA_SELLER_NAME`, `TESTER_KOREA_STAGING_PRODUCT_CATEGORY_NAME`, `TESTER_KOREA_SITE_BASE_URL`, throttle knobs, `TESTER_KOREA_LISTING_MAX_PAGES`, optional cookie |
| Entity resolvers | `ensureCommerceEntities.ts` — `findTesterKoreaSeller`, `findStagingProductCategoryForTesterKorea` |
| Constants | `src/scrapers/testerKorea/testerKoreaConstants.ts` |
| Queue names | `queueNames.ts` — `testerKoreaQueueNames`, `testerKoreaProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; stub `productPdp` worker OK initially |
| HTTP client | `httpClient.ts` — throttle, cookie, UA override for `testerkorea.com` |
| HTTP routes | `server.ts` — `POST /jobs/tester-korea/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products` (if Option A), `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Add Tester Korea to `scripts/probeRetailerStorefronts.ts` `DEFAULT_TARGETS` |
| `.env.example` | Document all new knobs |

---

## Phase 3 — Listing ingest

Implement after spike doc is approved.

| Component | Purpose |
|-----------|---------|
| `discoverTesterKoreaSellerCategoryNodes.ts` | Seed `seller_categories` from nav + in-page `cid` links |
| `fetchTesterKoreaCategoryListingPage.ts` | Paginated HTML parse for one `seller_categories.url` |
| `extractTesterKoreaPidsFromListingHtml.ts` | Regex extract from `/Product/Detail/view/pid/{pid}/…` hrefs + tile fields |
| `summarizeTesterKoreaListingFields.ts` | Typed summary of raw listing fields |
| `listingHitToListingFields.ts` | Normalize → upsert payload |
| `upsertProductFromTesterKoreaHit.ts` | Single DB choke point (mirror `upsertProductFromJolseHit`) |
| Jobs | `sellerCategoryHierarchy`, `sellerCategoryMapping`, `scrapeCategoryProducts`, `scrapeProduct` |
| `scrapeSitemapProducts.ts` | **Only if Option A** — re-enqueue known pids or category-union bulk discovery |
| `scrapeProduct.ts` worker | Concurrency **1**; `P2002`-aware upserts |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/tester-korea/seller-category-hierarchy
# POST /jobs/tester-korea/category-products  { "maxSellerCategories": 1 }
# POST /jobs/tester-korea/product-sources    { "maxProducts": 20 }  # if implemented
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from category smoke; `seller_products` + `seller_product_prices` rows visible for `Tester Korea`; `buildSellerProductPageUrl` returns valid `testerkorea.com` links for smoke pids.

---

## Phase 4 — PDP + spec enrichment

| Component | Purpose |
|-----------|---------|
| `fetchTesterKoreaProductPdp.ts` | PDP HTML fetch at `/Product/Detail/view/pid/{pid}` |
| `mapTesterKoreaPdpToSpecRows.ts` | `ProductSellerSpec` rows; prefix specs `TK ` |
| `enrichProductPdp.ts` job | One job per `pid`; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | Keyset batch from Postgres → `addBulk` |
| Reviews | **Optional v1** — `/Board/list/board_name/review` is not product-scoped; defer |

**PDP fields to target (from early probe):**

- Name: `<title>` or `og:title`
- Thumbnail: `og:image`
- Price: `.sell_price` / strike + sale USD amounts
- Description / ingredients: spike selectors in `#productDetail` block

---

## Phase 5 — Docs + roadmap + backend follow-ups

| Task | Location |
|------|----------|
| Spike notes | `docs/testerKoreaSpike.md` |
| Roadmap row | `docs/kBeautyRetailerRoadmap.md` — Tester Korea: Planned → In progress → Done |
| Playbook cross-link | One paragraph in `retailerScrapingPlaybook.md` (MakeShop + category-only discovery) |
| Queue hygiene script | `scripts/testerKoreaProductQueue.ts` (optional; copy Jolse script) |
| Thumbnails | `getProductThumbnailUrl` — `fetchTesterKoreaOgImage` fallback if `TK Thumbnail URL` not yet populated |

---

## Test plan

### Scrapers

- Unit tests for `pid` extraction regexes and listing field mappers with **fixture HTML** from spike.
- Unit test for `upsertProductFromTesterKoreaHit` with mocked prisma (match Jolse / StyleKorean test style if present).
- Manual: category smoke 20 products; verify Bull Board completion; query DB for seller name + URL template.

### Backend

- No migration logic tests required beyond existing patterns; manually verify seller row after migrate.
- Optional: unit test `buildSellerProductPageUrl` with Tester Korea template + sample pid once locked.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build` (includes `prisma generate`)

---

## Risks

| Risk | Mitigation |
|------|------------|
| No product sitemap | Category tree crawl + paginated listings; spike estimates coverage |
| Pagination quirks (`pnum`, page size) | Spike locks termination rule; cap `TESTER_KOREA_LISTING_MAX_PAGES` |
| Duplicate pids across categories | Idempotent upsert on `Product.sku` |
| `cid` hierarchy unclear | Spike nav crawl; allow flat categories with null parent |
| MakeShop session cookies | Optional `TESTER_KOREA_BROWSER_COOKIE`; Chrome UA by default |
| Rate limiting | `TESTER_KOREA_REQUEST_DELAY_MS` ≥ 900ms; concurrency 1 |
| SKU collision with another retailer | Numeric ids are retailer-specific; monitor smoke for `P2002` on `products.sku` |
| Architect rejects seed timing | Spike + doc review before DDL |
| `/Search/` disallowed in robots | Do not rely on site search for discovery |

---

## Implementation TODO

- [ ] **Phase 0:** Complete spike; write `docs/testerKoreaSpike.md`; add `debugTesterKoreaUrls.ts`
- [ ] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, `cid` hierarchy, pagination rule, and HTML parse selectors in spike doc
- [x] **Phase 0:** Decide `testerKorea.sitemapProducts` semantics (Option A — re-enqueue known pids from DB)
- [ ] **Phase 1:** Architect approval for Tester Korea seller + staging category seed migration
- [x] **Phase 1:** Apply migration; `db:pull` in scrapers (migration applied locally; scrapers schema unchanged)
- [x] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [x] **Phase 3:** Category discovery + listing fetch + `upsertProductFromTesterKoreaHit`; smoke ingest (10 products from 1 category on port 3101)
- [ ] **Phase 3:** Unit tests for mappers/upsert (when fixtures exist)
- [x] **Phase 4:** PDP enrichment job + spec mapping + enqueue-all routes
- [ ] **Phase 4:** Unit tests for PDP mappers (when fixtures exist)
- [ ] **Phase 5:** Update `kBeautyRetailerRoadmap.md` and playbook cross-link
- [ ] **Follow-up:** Thumbnail `og:image` fallback in `getProductThumbnailUrl` after ingest (if needed)
