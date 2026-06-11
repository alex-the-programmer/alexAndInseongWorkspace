# ALE-57 Scrape Stylevana catalog integration

## Context

[Linear ALE-57](https://linear.app/dewly/issue/ALE-57/scrape-stylevana-catalog-integration): add a **full retailer integration** for [Stylevana US](https://www.stylevana.com/en_US/) (priority **5** on the K-beauty retailer roadmap).

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook (same BullMQ + upsert shape as Olive Young / StyleKorean).

**Branch:** `ALE-57-scrape-stylevana-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — Stylevana row (currently **Planned**).
- `commerce-platform-scrapers/docs/styleKoreanSpike.md` — closest prior art (sitemap + category HTML listing + stub PDP).
- [ALE-53](ALE-53-scrape-olive-young-us-catalog.md) — recent full integration reference (queues, upsert choke point, enqueue-all PDP).

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

**Storefront note:** The ticket links `https://www.stylevana.com/en/` but that path **301s** to `https://www.stylevana.com/en_US/en/` (404). The canonical US storefront base is **`https://www.stylevana.com/en_US/`**.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `Stylevana` as its own `sellers` row with US `productUrlTemplate` |
| Listing ingest | Discover SKUs via sitemap + category HTML; persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs (and optionally Yotpo review summary) from PDP HTML or Magento APIs — phase after listing is stable |
| Operations | BullMQ namespace `stylevana.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Roadmap | Move Stylevana from **Planned** → **Done** in `kBeautyRetailerRoadmap.md` |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges.
- Frontend changes.
- Non-US Stylevana locales (`en_GB`, `zh_HK`, …) — ingest **US** (`en_US`) only.
- Full taxonomy unification beyond staging category.

---

## Current state

### Stylevana storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **Magento 2** (RequireJS, PageBuilder, Yotpo reviews, GTM) |
| CDN | `sv9-cdn.stylevana.com` / `cdn.stylevana.com` for media |
| Bot wall | **Cloudflare** (`cf-ray`, `__cflb` cookie); anonymous sitemap GETs return **200** |
| HTML pages | PDP + category listing return **403** from datacenter `curl` with Chrome UA (custom interstitial HTML, not a JSON API) |
| Sitemap | `robots.txt` → `https://www.stylevana.com/en_US/sitemap/sitemap.xml` → **14** child urlsets (`sitemap-1-1.xml` … `sitemap-1-14.xml`) |
| Category URLs | Nested `.html` paths, e.g. `/en_US/skincare/face-care/essence-serum/essence.html` |
| Product URLs | Magento slug PDPs, e.g. `/en_US/eyenlip-cica-blemish-clear-cream-50g104400.html` (numeric suffix **may** be entity id `104400`; not all PDPs have a trailing digit block) |
| REST API | `robots.txt` disallows `/rest/V1/` — treat Magento REST as **blocked / unlikely** for v1 |

**Implication:** Listing ingest can likely **bootstrap SKU discovery from sitemaps** (like StyleKorean) but **price/name/brand** require HTML listing pages or PDP fetches. Expect to mirror StyleKorean’s **Chrome UA override** and possibly add **`STYLEVANA_BROWSER_COOKIE`** (or Playwright fallback) if 403 persists from scraper hosts.

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| YesStyle | `yesStyle.*` | Category sitemap + HTML (blocked by default) | `upsertProductFromYesStyleHit` |

Stylevana should follow the **StyleKorean** shape (sitemap discovery + category HTML enrichment) rather than Olive Young US JSON APIs.

### Backend card links

Stylevana will be **`linkable = true`** (default). No ALE-44-style split seller. Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | Stylevana target (ALE-57) |
|------|-------|---------------------------|
| `sellers` row | None | **`Stylevana`** + US `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / Stylevana`** |
| SKU key | N/A | **TBD in spike** — likely Magento **numeric entity id** (preferred) or `url_key` slug |
| Listing discovery | N/A | **Product sitemap** (+ optional category HTML for price refresh) |
| Scraper package | N/A | **`src/scrapers/stylevana/*`** |
| Queue namespace | N/A | **`stylevana.*`** |
| HTTP client | No Stylevana host rules | Throttle + cookie + UA override for `*.stylevana.com` |
| Thumbnail resolver | No Stylevana branch | May need `SV ` spec prefix or absolute CDN URL handling in `getProductThumbnailUrl` after PDP ingest |

---

## Design decisions

### 1. US storefront only, base URL `en_US` (locked)

- All scrape URLs are rooted at `https://www.stylevana.com/en_US/`.
- Do **not** ingest other locale sitemaps listed in `robots.txt` (`en_GB`, `zh_HK`, …).

### 2. Queue namespace `stylevana.*` (locked)

Mirror StyleKorean queue set:

```ts
stylevana.sellerCategoryHierarchy
stylevana.sellerCategoryMapping
stylevana.categoryProducts
stylevana.sitemapProducts
stylevana.product
stylevana.productPdp
```

Worker concurrency: **`stylevana.product` and `stylevana.productPdp` at 1** initially.

### 3. `Product.sku` = stable Magento product id (spike → then lock)

**Preferred:** numeric **entity id** (e.g. `104400` from slug suffix or PDP `data-product-id`).

**Fallback:** if entity id is unreliable, store **`url_key`** (slug without `.html`) and use a slug-based `productUrlTemplate` — document tradeoff in spike (slug changes break links).

Do **not** prefix sku with `sv:` unless collision testing against existing retailers requires it.

### 4. `Seller.productUrlTemplate` (spike → then lock)

Candidates to validate in spike (Magento common patterns):

| Pattern | Template |
|---------|----------|
| Entity id (preferred) | `https://www.stylevana.com/en_US/catalog/product/view/id/{{sku}}` |
| Url key | `https://www.stylevana.com/en_US/{{sku}}.html` |

Record the chosen template + example resolved URL in `docs/stylevanaSpike.md` before migration.

### 5. Listing before PDP (locked)

**Phase A** — sitemap + category listing → `upsertProductFromStylevanaHit` (brand, product, seller_product, price, listing specs).

**Phase B** — `stylevana.productPdp` enrichment once listing queue is stable.

### 6. HTTP client reuse + Stylevana host rules (locked)

Extend `src/lib/httpClient.ts`:

- `STYLEVANA_REQUEST_DELAY_MS` throttle for `*.stylevana.com`
- `STYLEVANA_BROWSER_COOKIE` optional cookie injection
- Chrome desktop UA substitution when `SCRAPER_USER_AGENT` is the default bot string (same pattern as StyleKorean)

If HTML remains 403 from production scraper hosts after UA + cookie, add **`STYLEVANA_USE_PLAYWRIGHT`** (copy YesStyle pattern) as phase-1.5 — do not block spike on Playwright unless probe fails.

### 7. Sitemap-first ingest with category enrichment (proposed)

1. **Product sitemap walk** — enqueue minimal listing jobs (id-only), mirroring `styleKorean.scrapeSitemapProducts` + `sitemapItIdToListingFields`.
2. **Category sitemap / hierarchy** — seed `seller_categories` from category URLs in early sitemap chunks (filter out CMS/legal pages).
3. **Category products job** — paginate `?p=` on category listing HTML to refresh **price, brand, name, thumbnail** for SKUs already in DB or discovered on listing pages.

**Priority:** sitemap jobs > category listing jobs (same `stylevanaProductIngestPriorities` pattern as StyleKorean).

---

## Phase 0 — Spike (gate before bulk ingest)

**Deliverable:** `commerce-platform-scrapers/docs/stylevanaSpike.md` (same shape as `styleKoreanSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://www.stylevana.com/en_US/` and record friction.
2. Confirm sitemap walk: count product PDP URLs vs category URLs; estimate catalog size.
3. From sitemap samples, test regexes for entity id extraction:
   - `...104400.html` → `104400`
   - slug-only PDPs → how to resolve id (PDP HTML, `?product=`, Magento JSON-LD)
4. With **browser DevTools** (or Playwright), capture one category listing (`essence.html?p=1`) and one PDP:
   - `data-product-id`, JSON-LD `sku` / `productID`, price, brand, image `src`
   - Pagination model (`?p=`, `?page=`, infinite scroll)
5. Test whether **Chrome UA + optional cookie** clears 403 from Node `fetchText`.
6. Propose locked `productUrlTemplate`, `Product.sku` field, and listing field mapping.
7. Note Yotpo widget presence — defer review ingest unless easy JSON endpoint found.
8. Document 429/403 behavior and recommended `STYLEVANA_REQUEST_DELAY_MS`.

**Debug script (add in spike PR):** `scripts/debugStylevanaUrls.ts` — prints sample ids from sitemap + one listing page without DB writes.

**Early spike observations (June 2026 — replace with spike doc):**

- Sitemap index + child urlsets: **200 OK** from Node.
- PDP + category HTML: **403** from Node curl with Chrome UA — **must resolve in spike** before full fan-out.

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.

### Schema change

**None** — reuse existing `sellers`, `product_categories`, `currencies` tables.

### Data changes (migration SQL)

| Table | Action |
|-------|--------|
| `sellers` | **INSERT** row: `name = 'Stylevana'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = *from spike* |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / Stylevana'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_57_stylevana_seller_and_staging_category`

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs a Stylevana-specific branch after PDP specs exist (see Phase 5).

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `STYLEVANA_SELLER_NAME`, `STYLEVANA_STAGING_PRODUCT_CATEGORY_NAME`, `STYLEVANA_SITE_BASE_URL`, sitemap URLs, throttle knobs, optional cookie / Playwright flags |
| Entity resolvers | `ensureCommerceEntities.ts` — `findStylevanaSeller`, `findStagingProductCategoryForStylevana` |
| Constants | `src/scrapers/stylevana/stylevanaConstants.ts` |
| Queue names | `queueNames.ts` — `stylevanaQueueNames`, ingest priorities |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; stub `productPdp` worker OK initially |
| HTTP client | `httpClient.ts` — throttle, cookie, UA override for `stylevana.com` |
| HTTP routes | `server.ts` — `POST /jobs/style-vana/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products`, `…/product-sources`, `…/product-pdp-enrich` |
| `.env.example` | Document all new knobs |

---

## Phase 3 — Listing ingest

Implement after spike doc is approved.

| Component | Purpose |
|-----------|---------|
| `collectStylevanaProductIdsFromSitemaps.ts` | Walk `STYLEVANA_SITEMAP_INDEX_URL`; extract product entity ids / url keys from PDP `<loc>` |
| `discoverStylevanaSellerCategoryNodes.ts` | Seed `seller_categories` from category `<loc>` entries (filter non-catalog paths) |
| `fetchStylevanaCategoryListingPage.ts` | Paginated HTML parse for one `seller_categories.url` |
| `listingHitToListingFields.ts` / `sitemapProductIdToListingFields.ts` | Normalize → upsert payload |
| `summarizeStylevanaListingFields.ts` | Typed summary of raw listing fields |
| `upsertProductFromStylevanaHit.ts` | Single DB choke point (mirror StyleKorean) |
| Jobs | `sellerCategoryHierarchy`, `sellerCategoryMapping`, `scrapeCategoryProducts`, `scrapeSitemapProducts`, `scrapeProduct` |
| `scrapeProduct.ts` worker | Concurrency **1**; `P2002`-aware upserts |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/style-vana/seller-category-hierarchy
# POST /jobs/style-vana/sitemap-products  { "maxProducts": 20 }
# POST /jobs/style-vana/category-products  { "maxSellerCategories": 1 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from sitemap smoke; `seller_products` + `seller_product_prices` rows visible for `Stylevana`; `buildSellerProductPageUrl` returns valid `stylevana.com` links for smoke SKUs.

---

## Phase 4 — PDP + spec enrichment

| Component | Purpose |
|-----------|---------|
| `fetchStylevanaProductPdp.ts` | PDP HTML fetch (or Playwright) |
| `mapStylevanaPdpToSpecRows.ts` | `ProductSellerSpec` rows; prefix specs `SV ` (e.g. `SV Thumbnail URL`, `SV Description`) |
| `enrichProductPdp.ts` job | One job per sku; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | Keyset batch from Postgres → `addBulk` |
| Reviews | **Optional v1** — Yotpo widget is present; only ingest if spike finds a stable public API |

---

## Phase 5 — Docs + roadmap + backend follow-ups

| Task | Location |
|------|----------|
| Spike notes | `docs/stylevanaSpike.md` |
| Roadmap row | `docs/kBeautyRetailerRoadmap.md` — Stylevana: Planned → In progress → Done |
| Playbook cross-link | One paragraph in `retailerScrapingPlaybook.md` (Magento + Cloudflare HTML 403 pattern) |
| Queue hygiene script | `scripts/stylevanaProductQueue.ts` (optional; copy StyleKorean script) |
| Thumbnails | `getProductThumbnailUrl` — handle `SV Thumbnail URL` or absolute `sv9-cdn.stylevana.com` paths if needed |

---

## Test plan

### Scrapers

- Unit tests for id extraction regexes and listing field mappers with **fixture HTML/JSON** from spike.
- Unit test for `upsertProductFromStylevanaHit` with mocked prisma (match StyleKorean test style if present).
- Manual: sitemap smoke 20 products; verify Bull Board completion; query DB for seller name + URL template.

### Backend

- No migration logic tests required beyond existing patterns; manually verify seller row after migrate.
- Optional: unit test `buildSellerProductPageUrl` with Stylevana template + sample sku once locked.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build` (includes `prisma generate`)

---

## Risks

| Risk | Mitigation |
|------|------------|
| HTML 403 from scraper IPs | Chrome UA + cookie env; Playwright fallback; spike before bulk enqueue |
| Cloudflare escalation | `probe:storefronts`; throttle + concurrency 1; monitor 403 rate in logs |
| Inconsistent sku in slug | Prefer entity id from PDP; spike regex + fallback path |
| Large sitemap (14 files) | `STYLEVANA_SITEMAP_MAX_FETCHES` cap; `SCRAPE_MAX_SITEMAP_PRODUCTS` for smoke |
| Magento REST blocked | HTML listing + PDP only for v1 |
| Architect rejects seed timing | Spike + doc review before DDL |
| No scrapers unit test harness yet | Defer mapper tests if harness missing; prioritize spike script + manual smoke |

---

## Implementation TODO

- [ ] **Phase 0:** Complete spike; write `docs/stylevanaSpike.md`; add `debugStylevanaUrls.ts`
- [ ] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, and HTML parse selectors in spike doc
- [ ] **Phase 0:** Resolve 403 on PDP/category HTML from Node (UA, cookie, or Playwright decision)
- [ ] **Phase 1:** Architect approval for Stylevana seller + staging category seed migration
- [ ] **Phase 1:** Apply migration; `db:pull` in scrapers
- [ ] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [ ] **Phase 3:** Sitemap + category listing fetch + `upsertProductFromStylevanaHit`; smoke ingest
- [ ] **Phase 3:** Unit tests for mappers/upsert (when fixtures exist)
- [ ] **Phase 4:** PDP enrichment job + spec mapping + enqueue-all routes
- [ ] **Phase 4:** Unit tests for PDP mappers (when fixtures exist)
- [ ] **Phase 5:** Update `kBeautyRetailerRoadmap.md` and playbook cross-link
- [ ] **Follow-up:** Thumbnail CDN handling in `getProductThumbnailUrl` after ingest (if needed)
