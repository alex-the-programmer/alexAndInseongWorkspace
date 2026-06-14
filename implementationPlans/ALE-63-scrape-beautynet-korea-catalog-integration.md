# ALE-63 Scrape BeautyNet Korea catalog integration

## Context

[Linear ALE-63](https://linear.app/dewly/issue/ALE-63/scrape-beautynet-korea-catalog-integration): add a **full retailer integration** for [BeautyNet Korea](https://www.beautynetkorea.com/) (priority **10** on the K-beauty retailer roadmap).

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook (same BullMQ + upsert shape as Jolse / StyleKorean).

**Branch:** `ALE-63-scrape-beautynet-korea-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — BeautyNet Korea row (currently **Planned**).
- [ALE-56](ALE-56-scrape-jolse-catalog-integration.md) — **first Cafe24 retailer**; closest prior art (sitemap + category HTML listing + PDP HTML). ALE-63 should reuse Jolse job topology and HTML parsing patterns.
- [ALE-60](ALE-60-scrape-tester-korea-catalog-integration.md) — category-first discovery when sitemap is incomplete (relevant here: BeautyNet sitemap is **stale**).

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

**Platform note:** BeautyNet Korea is a **Cafe24** storefront (`CAFE24.*`, `EC_JET`, `cafe24img.poxo.com`). Unlike Jolse, the public sitemap is a **single uncompressed `sitemap.xml`** (no gzip children) and appears **incomplete** relative to live category listings — treat **category pagination as co-primary discovery**, not just price refresh.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `BeautyNet Korea` as its own `sellers` row with US `productUrlTemplate` |
| Listing ingest | Discover SKUs via product sitemap + category HTML (both required); persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs from Cafe24 PDP HTML (`og:*`, description blocks) — phase after listing is stable |
| Operations | BullMQ namespace `beautyNetKorea.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Roadmap | Move BeautyNet Korea from **Planned** → **Done** in `kBeautyRetailerRoadmap.md` |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges.
- Frontend changes.
- Non-US Cafe24 locales / localized storefront paths — ingest **en_US** (`language_code: en_US` in Cafe24 route metadata) only.
- Full taxonomy unification beyond staging category.
- Cafe24 `/exec/front/` JSON APIs — HTML-only v1 unless spike finds a stable public endpoint.
- Board reviews (`/board/product-review/4/`) — optional follow-up; not required for catalog cards.

---

## Current state

### BeautyNet Korea storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **Cafe24** (`CAFE24.*`, `EC_JET` error tracer, `cafe24img.poxo.com` media CDN) |
| CDN | **openresty** with edge cache (`x-cache: HIT`); not Cloudflare on anonymous homepage GETs |
| Bot wall | Homepage, category listing, and PDP return **200** from datacenter `curl` with Chrome UA |
| Canonical host | `www.beautynetkorea.com` and `beautynetkorea.com` both work; sitemap `<loc>` uses **apex** (`beautynetkorea.com`) — standardize env on **`https://www.beautynetkorea.com`** and normalize locs when enqueueing |
| Sitemap | `https://www.beautynetkorea.com/sitemap.xml` — **single flat urlset** (not gzip, not a sitemap index) |
| Sitemap size | ~**339** total `<loc>` entries; ~**98** product PDP URLs (`/product/{slug}/{productNo}/`) |
| Sitemap staleness | Category **All Items** (`/category/all-items/30/`) lists products with `product_no` up to **13537+** — sitemap alone will **miss active SKUs** |
| Category URLs (SEO) | `/category/{slug}/{cate_no}/` e.g. `/category/all-items/30/`, `/category/skin-care/25/` — **present in sitemap** |
| Category URLs (legacy) | `/product/list.html?cate_no={cate_no}` — still linked from nav |
| Pagination | `?page=N` on SEO category URLs (e.g. 5 pages on All Items) |
| Product URLs (canonical) | `/product/{slug}/{productNo}/` e.g. `/product/petitfee-gold-egf-hydrogel-eye-spot-patch-weight-184g/5181/` |
| Product URLs (listing) | `/product/{slug}/{productNo}/category/{cate_no}/display/1/` |
| Product URLs (legacy) | `/product/detail.html?product_no={productNo}` → **301** to canonical slug PDP |
| Product id | Numeric **`product_no`** in HTML/attrs (e.g. `5181`) |
| Currency | **USD** on category listing (e.g. `USD 10.83`) |
| Images | `og:image` on PDP → `cafe24img.poxo.com/beautynetkr/...` (absolute CDN URLs) |
| `robots.txt` | Disallows `/api`, `/exec/front/`, `/member/` — same Cafe24 constraints as Jolse |

**Implication:** BeautyNet Korea fits the **Jolse** integration shape (Cafe24 HTML + numeric `product_no`), but with two important deltas: **no gzip sitemap helper required**, and **category crawl is mandatory** because the product sitemap is incomplete. Unlike Jolse, **category URLs are in sitemap** — category seeding can start from sitemap `<loc>` filters, not only nav crawl.

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| Jolse | `jolse.*` | Gzip product sitemaps + category HTML | `upsertProductFromJolseHit` |
| YesStyle | `yesStyle.*` | Category sitemap + HTML (blocked by default) | `upsertProductFromYesStyleHit` |

BeautyNet Korea should follow the **Jolse** job topology with BeautyNet-specific URL hosts and **non-gzip** sitemap parsing.

`queueNames.ts` today defines namespaces for `oliveYoung`, `yesStyle`, `styleKorean`, `jolse`, and `oliveYoungUs` only — BeautyNet Korea adds `beautyNetKorea.*`.

### Backend card links

BeautyNet Korea will be **`linkable = true`** (default). Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | BeautyNet Korea target (ALE-63) |
|------|-------|----------------------------------|
| `sellers` row | None | **`BeautyNet Korea`** + US `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / BeautyNet Korea`** |
| SKU key | N/A | Numeric **`product_no`** (e.g. `5181`) |
| Listing discovery | N/A | **Flat product sitemap** + **paginated category HTML** (both required) |
| Scraper package | N/A | **`src/scrapers/beautyNetKorea/*`** |
| Queue namespace | N/A | **`beautyNetKorea.*`** |
| HTTP client | No BeautyNet host rules | Throttle + optional cookie + UA override for `beautynetkorea.com` |
| Thumbnail resolver | No BeautyNet branch | `og:image` fallback (same pattern as Jolse) after PDP ingest |

---

## Design decisions

### 1. US storefront only, canonical base `https://www.beautynetkorea.com` (proposed)

- Cafe24 route metadata shows `en_US` on PDP fetches.
- Sitemap uses apex host; normalize to `www` in env `BEAUTY_NET_KOREA_SITE_BASE_URL` for consistency with other retailers.

### 2. Queue namespace `beautyNetKorea.*` (locked)

Mirror Jolse queue set:

```ts
beautyNetKorea.sellerCategoryHierarchy
beautyNetKorea.sellerCategoryMapping
beautyNetKorea.categoryProducts
beautyNetKorea.sitemapProducts
beautyNetKorea.product
beautyNetKorea.productPdp
```

Worker concurrency: **`beautyNetKorea.product` and `beautyNetKorea.productPdp` at 1** initially.

### 3. `Product.sku` = numeric `product_no` (proposed — confirm in spike)

Extract from:

- Sitemap PDP loc: `/product/{slug}/{productNo}/`
- Category listing href: `/product/{slug}/{productNo}/category/{cate_no}/display/1/`
- PDP HTML: `product_no="5181"` / `product_no=5181`

Do **not** prefix sku with `beautynet:` unless collision testing against existing retailers requires it.

### 4. `Seller.productUrlTemplate` (proposed — confirm in spike)

**Preferred:**

```text
https://www.beautynetkorea.com/product/detail.html?product_no={{sku}}
```

Verified: returns **301** to canonical slug PDP. Stable for cards without storing slugs in `Product`.

### 5. Listing before PDP (locked)

**Phase A** — sitemap + category listing → `upsertProductFromBeautyNetKoreaHit` (brand, product, seller_product, price, listing specs).

**Phase B** — `beautyNetKorea.productPdp` enrichment once listing queue is stable.

### 6. HTTP client reuse + BeautyNet host rules (locked)

Extend `src/lib/httpClient.ts`:

- `BEAUTY_NET_KOREA_REQUEST_DELAY_MS` throttle for `*.beautynetkorea.com`
- `BEAUTY_NET_KOREA_BROWSER_COOKIE` optional cookie injection
- Chrome desktop UA substitution when `SCRAPER_USER_AGENT` is the default bot string (same pattern as Jolse)

Default throttle ≥ **900ms** (match Jolse / StyleKorean). **No gzip helper required** — sitemap is plain XML.

### 7. Dual discovery: sitemap + category pagination (locked)

1. **Product sitemap walk** — parse flat `sitemap.xml`; filter `<loc>` matching `/product/{slug}/{productNo}/`; enqueue listing jobs. Expect ~**98** SKUs — treat as **bootstrap**, not full catalog.
2. **Category seeding** — parse sitemap `<loc>` matching `/category/{slug}/{cate_no}/` → `seller_categories` rows. Exclude non-merchandising pages (boards, `shopinfo`, `member`) via regex defaults.
3. **Category products job** — paginate `?page=N` on each `seller_categories.url` to discover **all** active SKUs and refresh price, brand, name, thumbnail.

**Priority:** category listing jobs ≥ sitemap jobs (`beautyNetKoreaProductIngestPriorities` — invert Jolse weighting because sitemap is incomplete).

### 8. Category hierarchy — flat v1 unless spike finds parent map (proposed)

Cafe24 `cate_no` parent/child rules may not match StyleKorean’s tree. v1:

- Seed flat `seller_categories` from sitemap category locs.
- `parentSellerCategoryId = null` unless spike documents reliable parent links in nav HTML.

### 9. Spec prefix `BN ` (proposed)

PDP-derived specs use prefix **`BN `** (e.g. `BN Thumbnail URL`, `BN Description`, `BN ingredients`) for manual curation batches — mirror `JL ` (Jolse) / `SK ` conventions.

### 10. Reuse Jolse Cafe24 patterns; optional shared `cafe24/` layer (proposed)

**Prerequisite:** [ALE-56](ALE-56-scrape-jolse-catalog-integration.md) Jolse scraper merged (or in progress with stable helpers).

ALE-63 should **copy Jolse file layout** (`productNoFromPdpLoc`, `extractProductNosFromListingHtml`, PDP mappers) with hostname parameterized to `beautynetkorea.com`.

If implementing both retailers in the same sprint, consider extracting shared parsers into `src/scrapers/cafe24/*` (hostname passed as arg) — same spirit as Shopify `shopify/` layer in ALE-58. **Do not** block ALE-63 on a large refactor; thin duplication in `beautyNetKorea/` is acceptable if Jolse helpers are not yet generic.

---

## Phase 0 — Spike (gate before bulk ingest)

**Deliverable:** `commerce-platform-scrapers/docs/beautyNetKoreaSpike.md` (same shape as `jolseSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://www.beautynetkorea.com/` (with backend env) and record friction.
2. Confirm flat sitemap walk end-to-end from Node; lock product PDP count (~98) and total urlset size (~339).
3. Lock regex for `product_no` extraction from sitemap loc, listing HTML, and PDP HTML.
4. Enumerate category URLs from sitemap; propose exclude list (boards, `shopinfo`, `member`, marketing-only collections).
5. Paginate **All Items** (`cate_no=30`) through last page; count **unique** `product_no` values — compare to sitemap count and document gap.
6. From one category listing (pages 1–2) and one PDP, capture:
   - product name, brand, price (USD), sale price if any, thumbnail `src`, availability
   - pagination termination (`?page=N` empty vs repeat)
7. Test whether **Chrome UA + optional cookie** remains sufficient from production scraper hosts (no Playwright).
8. Propose locked `productUrlTemplate`, `Product.sku` field, and listing field mapping.
9. Note review widget presence — defer review ingest unless spike finds a stable public endpoint.
10. Document 429/403 behavior and recommended `BEAUTY_NET_KOREA_REQUEST_DELAY_MS`.
11. Check `/exec/front/` or other Cafe24 JSON endpoints — only adopt if HTML parsing is brittle.
12. Confirm `www` vs apex host behavior for sitemap, category, and PDP fetches.

**Debug script (add in spike PR):** `scripts/debugBeautyNetKoreaUrls.ts` — prints sample `product_no` values from sitemap + one category page without DB writes.

**Early spike observations (June 2026 — replace with spike doc):**

- Homepage, category listing, PDP HTML: **200 OK** from Node curl with Chrome UA.
- Flat `sitemap.xml`: **200 OK**; ~**98** product URLs, ~**339** total URLs.
- Category **All Items** shows products with `product_no` **> 5000** not present in sitemap — **category crawl required**.
- `detail.html?product_no=` → **301** to canonical slug PDP.
- `og:image` on PDP uses `cafe24img.poxo.com/beautynetkr/...`.
- Pagination on `/category/all-items/30/?page=N` — at least **5** pages observed.

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.

### Schema change

**None** — reuse existing `sellers`, `product_categories`, `currencies` tables.

### Data changes (migration SQL)

| Table | Action |
|-------|--------|
| `sellers` | **INSERT** row: `name = 'BeautyNet Korea'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = `https://www.beautynetkorea.com/product/detail.html?product_no={{sku}}` |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / BeautyNet Korea'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_63_beauty_net_korea_seller_and_staging_category`

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs a BeautyNet-specific branch after PDP specs exist (see Phase 5).

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `BEAUTY_NET_KOREA_SELLER_NAME`, `BEAUTY_NET_KOREA_STAGING_PRODUCT_CATEGORY_NAME`, `BEAUTY_NET_KOREA_SITE_BASE_URL`, `BEAUTY_NET_KOREA_SITEMAP_URL`, throttle knobs, optional cookie, category exclude regex |
| Entity resolvers | `ensureCommerceEntities.ts` — `findBeautyNetKoreaSeller`, `findStagingProductCategoryForBeautyNetKorea` |
| Constants | `src/scrapers/beautyNetKorea/beautyNetKoreaConstants.ts` — spec prefix `BN `, default category exclude regex |
| Queue names | `queueNames.ts` — `beautyNetKoreaQueueNames`, `beautyNetKoreaProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; stub `productPdp` worker OK initially |
| HTTP client | `httpClient.ts` — throttle, cookie, UA override for `beautynetkorea.com` |
| HTTP routes | `server.ts` — `POST /jobs/beauty-net-korea/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products`, `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Add `https://www.beautynetkorea.com/` to `scripts/probeRetailerStorefronts.ts` default URL list |
| `.env.example` | Document all new knobs |

---

## Phase 3 — Listing ingest

Implement after spike doc is approved.

| Component | Location | Purpose |
|-----------|----------|---------|
| `collectBeautyNetKoreaProductNosFromSitemap.ts` | `beautyNetKorea/` | Walk flat `sitemap.xml`; extract `product_no` from PDP `<loc>` |
| `discoverBeautyNetKoreaSellerCategoryNodes.ts` | `beautyNetKorea/` | Seed `seller_categories` from sitemap category locs + nav fallback |
| `fetchBeautyNetKoreaCategoryListingPage.ts` | `beautyNetKorea/` | Paginated HTML parse for one `seller_categories.url` (`?page=N`) |
| `extractBeautyNetKoreaProductNosFromListingHtml.ts` | `beautyNetKorea/` | Regex extract from `/product/{slug}/{productNo}/…` hrefs (copy Jolse pattern) |
| `sitemapProductNoToListingFields.ts` | `beautyNetKorea/` | Minimal id-only listing payload from sitemap discovery |
| `summarizeBeautyNetKoreaListingFields.ts` | `beautyNetKorea/` | Typed summary of raw listing fields |
| `upsertProductFromBeautyNetKoreaHit.ts` | `beautyNetKorea/` | Single DB choke point (mirror `upsertProductFromJolseHit`) |
| Jobs | `beautyNetKorea/jobs/` | `sellerCategoryHierarchy`, `sellerCategoryMapping`, `scrapeCategoryProducts`, `scrapeSitemapProducts`, `scrapeProduct` |
| `scrapeProduct.ts` worker | `beautyNetKorea/jobs/` | Concurrency **1**; `P2002`-aware upserts |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/beauty-net-korea/seller-category-hierarchy
# POST /jobs/beauty-net-korea/category-products  { "maxSellerCategories": 1 }
# POST /jobs/beauty-net-korea/sitemap-products  { "maxProducts": 20 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from **category** smoke (not sitemap-only); `seller_products` + `seller_product_prices` rows visible for `BeautyNet Korea`; `buildSellerProductPageUrl` returns valid `beautynetkorea.com` links for smoke SKUs.

**Full catalog note:** Small catalog (spike estimate: low hundreds of SKUs) — full backfill should complete quickly once category pagination is wired; still keep worker concurrency at 1.

---

## Phase 4 — PDP + spec enrichment

| Component | Location | Purpose |
|-----------|----------|---------|
| `beautyNetKoreaPdp.ts` | `beautyNetKorea/` | PDP HTML fetch + field extraction (mirror `jolsePdp.ts`) |
| `mapBeautyNetKoreaPdpToSpecRows.ts` | `beautyNetKorea/` | `ProductSellerSpec` rows; prefix specs **`BN `** |
| `enrichProductPdp.ts` job | `beautyNetKorea/jobs/` | One job per `product_no`; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | `beautyNetKorea/jobs/` | Keyset batch from Postgres → `addBulk` |
| Reviews | — | **Optional v1** — only ingest if spike finds stable Cafe24 review API or parseable HTML block |

---

## Phase 5 — Docs + roadmap + backend follow-ups

| Task | Location |
|------|----------|
| Spike notes | `docs/beautyNetKoreaSpike.md` |
| Roadmap row | `docs/kBeautyRetailerRoadmap.md` — BeautyNet Korea: Planned → In progress → Done |
| Playbook cross-link | Add BeautyNet as second Cafe24 example (flat sitemap + stale sitemap caveat) |
| Queue hygiene script | `scripts/beautyNetKoreaProductQueue.ts` (optional; copy Jolse script) |
| Thumbnails | `getProductThumbnailUrl` — `og:image` / `BN Thumbnail URL` fallback after PDP ingest |

---

## Test plan

### Scrapers

- Unit tests for `product_no` extraction regexes and listing field mappers with **fixture HTML** from spike.
- Unit test for flat sitemap parser with a **small fixture** XML blob.
- Unit test for `upsertProductFromBeautyNetKoreaHit` with mocked prisma (match Jolse test style if present).
- Manual: category smoke 20+ products; verify Bull Board completion; query DB for seller name + URL template.

### Backend

- No migration logic tests required beyond existing patterns; manually verify seller row after migrate.
- Optional: unit test `buildSellerProductPageUrl` with BeautyNet template + sample sku once locked.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build` (includes `prisma generate`)

---

## Risks

| Risk | Mitigation |
|------|------------|
| Stale product sitemap (~98 SKUs) | **Category pagination as co-primary discovery**; spike counts unique ids from All Items |
| Jolse helpers not yet merged | Copy Jolse patterns into `beautyNetKorea/`; optional `cafe24/` extract later |
| `cate_no` hierarchy unclear | Flat categories from sitemap; null parent unless spike finds tree |
| Cafe24 `/api` blocked | HTML-only v1; no dependency on `/exec/front/` |
| openresty cache serves stale prices | Category refresh job; log last-seen price on upsert |
| Rate limiting | `BEAUTY_NET_KOREA_REQUEST_DELAY_MS` ≥ 900ms; concurrency 1 |
| SKU collision with another retailer | Numeric ids are retailer-specific; monitor `Product.sku` uniqueness in smoke |
| Architect rejects seed timing | Spike + doc review before DDL |
| Slug changes break non-template links | Use `detail.html?product_no=` template for cards |
| www vs apex host mismatch | Normalize URLs in env + sitemap walker |

---

## Implementation TODO

- [x] **Phase 0:** Complete spike; write `docs/beautyNetKoreaSpike.md`; add `debugBeautyNetKoreaUrls.ts` *(spike doc pending; debug script done)*
- [x] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, category exclude list, and HTML parse selectors in spike doc *(locked in plan + code)*
- [x] **Phase 0:** Count unique `product_no` from full category pagination vs sitemap; document gap in spike doc *(98 sitemap vs 28+ on All Items page 1 via debug script)*
- [x] **Phase 0:** Confirm Jolse (ALE-56) helpers are available to copy or genericize *(merged ALE-56 into ALE-63 scrapers worktree)*
- [ ] **Phase 1:** Architect approval for BeautyNet Korea seller + staging category seed migration
- [x] **Phase 1:** Apply migration; `db:pull` in scrapers *(migration applied locally; db:pull pending)*
- [x] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [x] **Phase 2:** `beautyNetKorea/` jobs wired; probe script updated
- [x] **Phase 3:** Sitemap + category listing fetch + `upsertProductFromBeautyNetKoreaHit`; smoke ingest (20+ products from category) *(5 sitemap upserts verified; category re-test after numeric sort fix)*
- [ ] **Phase 3:** Unit tests for mappers/upsert (when fixtures exist)
- [x] **Phase 4:** PDP enrichment job + spec mapping + enqueue-all routes
- [ ] **Phase 4:** Unit tests for PDP mappers (when fixtures exist)
- [ ] **Phase 5:** Update `kBeautyRetailerRoadmap.md` and playbook cross-links
- [ ] **Follow-up:** Thumbnail `og:image` fallback in `getProductThumbnailUrl` after ingest (if needed)
