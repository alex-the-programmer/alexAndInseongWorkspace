# ALE-62 Scrape iHerb K-beauty subset (optional)

## Status: **Blocked** (2026-06-12)

**Blocker:** iHerb category listing and PDP pages return Cloudflare **403** from datacenter HTTP without a real browser session cookie. Sitemap category discovery works; product ingest does not.

**Done in worktree (uncommitted):** seller seed migration applied; scrapers integration wired with `IHERB_SCRAPING_DISABLED=true` default; 52 K-beauty `SellerCategory` rows seeded; **0** products ingested.

**To unblock:** Export `IHERB_BROWSER_COOKIE` from a real browser session on `www.iherb.com`, set `IHERB_SCRAPING_DISABLED=false`, re-run `POST /jobs/iherb/category-products`.

---

## Context

[Linear ALE-62](https://linear.app/dewly/issue/ALE-62/scrape-iherb-k-beauty-subset-optional): add a **scoped retailer integration** for [iHerb](https://www.iherb.com/) **K-beauty categories only** (priority **11**, marked **optional** on the K-beauty retailer roadmap).

**Goal:** Spike first with an explicit **go / no-go** gate. If we proceed: implement listing ingest (and optionally PDP enrichment) for the K-beauty vertical slice only — **not** the full ~50k-product iHerb catalog.

**Branch:** `ALE-62-scrape-iherb-k-beauty-subset-optional` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — iHerb row (currently **Optional**).
- [ALE-56](ALE-56-scrape-jolse-catalog-integration.md) — sitemap + category listing queue topology.
- YesStyle blocked pattern — `YESSTYLE_SCRAPING_DISABLED` defaults **on** when Cloudflare blocks unattended scraping; mirror if iHerb HTML/API remain blocked from scraper hosts.

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

**Scope note:** This ticket is **optional and lower priority** than dedicated K-beauty retailers (Jolse, Stylevana, Soko Glam, etc.). Do **not** start backend migration or bulk ingest until Phase 0 spike concludes **proceed** with a documented, repeatable listing data path.

---

## Goals

| Goal | Detail |
|------|--------|
| Go/no-go spike | Validate bot protection, ToS risk, and at least one **scriptable listing data source** for K-beauty categories from production-like hosts |
| New seller | `iHerb` as its own `sellers` row with US `productUrlTemplate` |
| **Subset ingest only** | Products discovered via **K-beauty category tree** (`/c/k-beauty` and `/c/k-beauty-*`); exclude supplements, vitamins, and general health catalog |
| Listing ingest | Persist `products`, `seller_products`, `seller_product_prices`, listing facet specs for in-scope SKUs |
| PDP enrichment | Structured specs (description, ingredients, images) — phase after listing is stable **if** PDP/catalog fetch is viable |
| Operations | BullMQ namespace `iherb.*`, HTTP enqueue routes, env knobs, spike/debug scripts; **`IHERB_SCRAPING_DISABLED`** default **on** if spike finds datacenter blocks |
| Roadmap | Move iHerb from **Optional** → **Spike** / **In progress** / **Done** or **Blocked** in `kBeautyRetailerRoadmap.md` |

**Out of scope (v1):**

- Full iHerb catalog ingest (~50k SKUs across all health/beauty verticals).
- Cross-retailer product dedupe / `ProductMatchCandidate` merges.
- Frontend changes.
- Non-US iHerb locales (`sg.iherb.com`, `jp.iherb.com`, …) — ingest **US** (`www.iherb.com`) only.
- iHerb house-brand-only slices outside the K-beauty category tree unless explicitly added in spike.
- Affiliate / rewards / checkout APIs.
- Review ingest unless spike finds a stable public endpoint.

---

## Current state

### iHerb storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | Custom Express storefront (`x-powered-by: Express` on sitemaps); **Cloudflare** on HTML and catalog hosts |
| Bot wall | Homepage, category pages (`/c/k-beauty`), PDP (`/pr/...`), and `catalog.app.iherb.com` return **403** + `cf-mitigated: challenge` from datacenter `curl` with Chrome UA |
| Sitemaps | **`robots.txt` → `https://www.iherb.com/sitemap_index.xml`** returns **200** (no challenge) |
| Sitemap children | `products-0-www-{0,1,2}.xml`, `categories-0-www-0.xml`, `specialty-0-www-0.xml`, reviews, blog, etc. — **200** from Node |
| Product URLs | `https://www.iherb.com/pr/{slug}/{numericId}` e.g. `/pr/doctor-s-best-5-htp-100-mg-60-veggie-caps/1` |
| Product id | Numeric id at **end of path** (stable key for `Product.sku`) |
| K-beauty hub | `https://www.iherb.com/c/k-beauty` — public category landing with ~40+ subcategories (Treatments & Serums, Sheet Masks, …) |
| K-beauty categories in sitemap | **52** `<loc>` URLs matching `/c/k-beauty` prefix in `categories-0-www-0.xml` |
| Est. K-beauty SKU count | ~**3,000–4,000** products (sum of subcategory counts on hub page; not full 50k catalog) |
| Historical catalog API | `https://catalog.app.iherb.com/product/{id}` (XML) — cited in third-party scrapers; **403** from datacenter today |
| `robots.txt` | Allows `/tr/list`, `/tr/cb`; disallows checkout, profile, many `/Pro/*` endpoints |

**Implication:** iHerb is **higher friction than Jolse/StyleKorean** and closer to **YesStyle** for HTML/API access. Sitemaps alone can enumerate **all** product ids (~50k) but **cannot** filter to K-beauty without category membership or PDP metadata. The integration must center on **K-beauty category listing ingest**, not a blind full-product sitemap walk.

### K-beauty subset definition (proposed — lock in spike)

**In scope URLs** (seed `seller_categories`):

- All category `<loc>` values from `categories-0-www-0.xml` where path matches `/c/k-beauty` or `/c/k-beauty-*`.
- Hub: `https://www.iherb.com/c/k-beauty`.

**Out of scope:**

- Product sitemap walk without category filter (would ingest non–K-beauty SKUs).
- General `/c/beauty`, `/c/makeup`, `/c/skin-care` unless spike proves they are redundant with the K-beauty tree.

**Env allowlist (optional hardening):**

- `IHERB_K_BEAUTY_CATEGORY_PATH_PREFIXES=/c/k-beauty` — reject category URLs outside prefix during mapping jobs.

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| Jolse | `jolse.*` | Gzip product sitemaps + category HTML | `upsertProductFromJolseHit` |
| YesStyle | `yesStyle.*` | Category sitemap + HTML (**blocked by default**) | `upsertProductFromYesStyleHit` |

iHerb should follow the **StyleKorean/Jolse queue shape** (category hierarchy → category products → per-product upsert) with a **YesStyle-style disabled flag** if Cloudflare blocks persist. Prefer an **Olive Young US–style JSON category API** if spike discovers one behind the storefront.

`queueNames.ts` today has no `iherb.*` namespace.

### Backend card links

iHerb will be **`linkable = true`** (default). Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | iHerb target (ALE-62) |
|------|-------|------------------------|
| `sellers` row | None | **`iHerb`** + US `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / iHerb`** |
| SKU key | N/A | Numeric **product id** from `/pr/{slug}/{id}` |
| Listing discovery | N/A | **K-beauty category sitemap** → paginated category listing (HTML or JSON — TBD in spike) |
| Full-catalog sitemap | N/A | **Explicitly not used** for v1 ingest (discovery aid / validation only) |
| Scraper package | N/A | **`src/scrapers/iherb/*`** |
| Queue namespace | N/A | **`iherb.*`** |
| HTTP client | No iHerb host rules | Throttle + cookie + UA override for `*.iherb.com`, `catalog.app.iherb.com` |
| Scraping kill switch | YesStyle only | **`IHERB_SCRAPING_DISABLED`** (default **true** until spike passes from prod host) |
| Legal / ToS | Not reviewed | Spike doc must note iHerb ToS + robots posture; escalate if counsel wants pause |

---

## Design decisions

### 1. US storefront only, base `https://www.iherb.com` (proposed)

- All scrape URLs rooted at `www.iherb.com`.
- Do not ingest locale-specific hosts (`sg.`, `jp.`, …).

### 2. K-beauty subset only — category-scoped ingest (locked)

- **Do not** enqueue all product sitemap locs.
- Seed categories from `categories-0-www-0.xml` filtered to `k-beauty` paths.
- `iherb.categoryProducts` walks only those `seller_categories.url` values.

### 3. Queue namespace `iherb.*` (locked)

Mirror StyleKorean/Jolse queue set (subset may omit sitemap product queue or repurpose it for **category sitemap seed only**):

```ts
iherb.sellerCategoryHierarchy
iherb.sellerCategoryMapping
iherb.categoryProducts
iherb.sitemapProducts   // optional: category-url discovery only, NOT full product catalog
iherb.product
iherb.productPdp
```

Worker concurrency: **`iherb.product` and `iherb.productPdp` at 1** initially.

### 4. `Product.sku` = numeric product id (proposed — confirm in spike)

Extract from:

- Category listing links: `/pr/{slug}/{id}`
- PDP URL tail when available

Do **not** prefix sku with `iherb:` unless collision testing requires it.

### 5. `Seller.productUrlTemplate` (proposed — confirm in spike)

**Preferred** (if numeric-only or slug-agnostic redirect works from browsers):

```text
https://www.iherb.com/pr/{{sku}}
```

**Fallback** (if only slug+id works):

- Store slug in listing spec `IH Slug` and use template with two placeholders **only if** backend supports it — otherwise store canonical PDP URL on `seller_products` or use full slug in sku (avoid).
- Spike must verify which URL shape works for logged-out users clicking from product cards.

### 6. Listing before PDP (locked)

**Phase A** — K-beauty category listing → `upsertProductFromIherbHit` (brand, product, seller_product, price, listing specs).

**Phase B** — `iherb.productPdp` enrichment once listing queue is stable **and** catalog/PDP fetch is viable.

### 7. HTTP client + disabled-by-default pattern (locked if blocked)

Extend `src/lib/httpClient.ts`:

- `IHERB_REQUEST_DELAY_MS` throttle for `*.iherb.com` and `catalog.app.iherb.com`
- `IHERB_BROWSER_COOKIE` optional cookie injection
- Chrome desktop UA when `SCRAPER_USER_AGENT` is the default bot string

Mirror YesStyle in `registerWorkers.ts` and `server.ts`:

- `IHERB_SCRAPING_DISABLED` — `z.preprocess((v) => envBool(v, true), z.boolean())` (**default true** until spike proves prod viability)
- Job routes return **503** with clear message when disabled; workers not registered

### 8. Category hierarchy — flat K-beauty tree (proposed)

- Hub `/c/k-beauty` → parent for subcategories discovered in categories sitemap.
- Subcategories (`/c/k-beauty-sheet-masks`, …) → `parentSellerCategoryId` points at hub row when resolvable; else flat with `null` parent (StyleKorean escape hatch).

### 9. Spec prefix `IH ` (proposed)

PDP-derived specs use prefix **`IH `** (e.g. `IH Thumbnail URL`, `IH Description`, `IH Ingredients`) for manual curation batches.

### 10. Spike go / no-go criteria (locked)

**Proceed** only if spike documents **all** of:

1. Repeatable category listing fetch (JSON or HTML) returning product id, name, brand, price for ≥1 K-beauty subcategory from **production scraper environment** (not just local laptop).
2. Acceptable rate-limit / 403 behavior with chosen mitigations (cookie, delay, proxy — document if required).
3. Product card URL template validated.
4. Stakeholder sign-off that optional priority still warrants ongoing maintenance vs dedicated retailers.

**Pause / Blocked** if only sitemaps are reachable but listing/PDP remain behind Cloudflare with no approved bypass — ship spike doc + `IHERB_SCRAPING_DISABLED=true` scaffolding only (YesStyle pattern).

---

## Phase 0 — Spike (gate before bulk ingest)

**Deliverable:** `commerce-platform-scrapers/docs/iherbSpike.md` (same shape as `styleKoreanSpike.md` / `yesStyleSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://www.iherb.com/ https://www.iherb.com/c/k-beauty` and record friction.
2. Confirm `sitemap_index.xml` + `categories-0-www-0.xml` walk from Node; count K-beauty category URLs (**52** in early probe).
3. From production scraper host (Fly/Render/etc.), retry category listing + PDP + `catalog.app.iherb.com/product/{id}` — compare to local datacenter results.
4. DevTools / network capture on **one** K-beauty category page (`/c/k-beauty-sheet-masks` or similar): identify XHR/fetch endpoints for product grid (preferred over HTML regex).
5. Lock regex for product id extraction from listing payloads.
6. Paginate one category (`?p=1`, `?p=2`, … — confirm param name in spike); document termination.
7. Capture listing fields: product name, brand, price (USD), sale price, thumbnail, availability.
8. Test `IHERB_BROWSER_COOKIE` + Chrome UA from scraper host.
9. Propose locked `productUrlTemplate`, `Product.sku` field, and listing field mapping.
10. Review iHerb Terms of Service / robots.txt constraints; note in spike if legal review recommended.
11. **Go / no-go decision** recorded at top of spike doc.

**Debug script (add in spike PR):** `scripts/debugIherbUrls.ts` — prints K-beauty category URLs from categories sitemap + sample product ids from one listing page **without DB writes**.

**Early spike observations (June 2026 — replace with spike doc):**

| Endpoint | Datacenter `curl` |
|----------|-------------------|
| `sitemap_index.xml` | **200** |
| `categories-0-www-0.xml` | **200**; 52 `/c/k-beauty*` locs |
| `products-0-www-0.xml` | **200**; full catalog locs |
| Homepage, `/c/k-beauty`, PDP, `catalog.app.iherb.com` | **403** Cloudflare challenge |

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.  
**Start only after Phase 0 go decision.**

### Schema change

**None** — reuse existing `sellers`, `product_categories`, `currencies` tables.

### Data changes (migration SQL)

| Table | Action |
|-------|--------|
| `sellers` | **INSERT** row: `name = 'iHerb'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = TBD from spike (e.g. `https://www.iherb.com/pr/{{sku}}`) |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / iHerb'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_62_iherb_seller_and_staging_category`

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs an iHerb-specific branch after PDP specs exist.

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`  
**Can land disabled scaffolding before go decision** (queues wired, workers off when `IHERB_SCRAPING_DISABLED=true`).

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `IHERB_SELLER_NAME`, `IHERB_STAGING_PRODUCT_CATEGORY_NAME`, `IHERB_SITE_BASE_URL`, `IHERB_SITEMAP_INDEX_URL`, `IHERB_K_BEAUTY_CATEGORY_PATH_PREFIXES`, `IHERB_SCRAPING_DISABLED`, throttle knobs, optional cookie |
| Entity resolvers | `ensureCommerceEntities.ts` — `findIherbSeller`, `findStagingProductCategoryForIherb` |
| Constants | `src/scrapers/iherb/iherbConstants.ts` |
| Queue names | `queueNames.ts` — `iherbQueueNames`, `iherbProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; respect disabled flag |
| HTTP client | `httpClient.ts` — throttle, cookie, UA override for iHerb hosts |
| HTTP routes | `server.ts` — `POST /jobs/iherb/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-categories` (category discovery only), `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Add iHerb to `scripts/probeRetailerStorefronts.ts` `DEFAULT_TARGETS` |
| `.env.example` | Document all new knobs |

---

## Phase 3 — Listing ingest (K-beauty subset)

Implement after spike doc is approved and `IHERB_SCRAPING_DISABLED=false` is viable in target environment.

| Component | Purpose |
|-----------|---------|
| `collectIherbKBeautyCategoryUrlsFromSitemap.ts` | Parse `categories-0-www-0.xml`; filter `/c/k-beauty*` locs |
| `discoverIherbSellerCategoryNodes.ts` | Upsert `seller_categories` for hub + subcategories |
| `fetchIherbCategoryListingPage.ts` | Paginated fetch for one `seller_categories.url` |
| `extractIherbProductsFromListingPayload.ts` | Parse HTML or JSON listing grid |
| `listingHitToListingFields.ts` | Normalize → upsert payload |
| `summarizeIherbListingFields.ts` | Typed summary of raw listing fields |
| `upsertProductFromIherbHit.ts` | Single DB choke point (mirror `upsertProductFromJolseHit`) |
| Jobs | `sellerCategoryHierarchy`, `sellerCategoryMapping`, `scrapeCategoryProducts`, optional `scrapeSitemapCategories`, `scrapeProduct` |
| `scrapeProduct.ts` worker | Concurrency **1**; `P2002`-aware upserts |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/iherb/seller-category-hierarchy
# POST /jobs/iherb/seller-category-mapping
# POST /jobs/iherb/category-products  { "maxSellerCategories": 1, "maxPages": 2 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 **K-beauty** products ingested from one subcategory smoke; `seller_products` + `seller_product_prices` rows visible for `iHerb`; no ingest of obvious non–K-beauty SKUs (e.g. vitamins from full product sitemap).

---

## Phase 4 — PDP + spec enrichment

| Component | Purpose |
|-----------|---------|
| `fetchIherbProductPdp.ts` | PDP HTML or `catalog.app.iherb.com` XML/JSON fetch |
| `mapIherbPdpToSpecRows.ts` | `ProductSellerSpec` rows; prefix specs `IH ` |
| `enrichProductPdp.ts` job | One job per product id; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | Keyset batch from Postgres → `addBulk` |
| Reviews | **Optional v1** — iHerb has review sitemaps; defer unless stable API found |

**Skip Phase 4** if spike blocks PDP/catalog fetch — listing-only integration still valuable for price cards if listing fields are complete.

---

## Phase 5 — Docs + roadmap + backend follow-ups

| Task | Location |
|------|----------|
| Spike notes | `docs/iherbSpike.md` |
| Roadmap row | `docs/kBeautyRetailerRoadmap.md` — iHerb: Optional → Spike / In progress / Done / **Blocked** |
| Playbook cross-link | One paragraph in `retailerScrapingPlaybook.md` (subset ingest + disabled-flag pattern) |
| Queue hygiene script | `scripts/iherbProductQueue.ts` (optional; copy Jolse script) |
| Thumbnails | `getProductThumbnailUrl` — listing `imageUrl` or `IH Thumbnail URL` fallback |

---

## Test plan

### Scrapers

- Unit tests for product id extraction regexes and listing field mappers with **fixture HTML/JSON** from spike.
- Unit test for K-beauty category URL filter (`/c/k-beauty` prefix) with fixture sitemap XML.
- Unit test for `upsertProductFromIherbHit` with mocked prisma.
- Unit test: `IHERB_SCRAPING_DISABLED=true` → workers not registered; job routes return 503.
- Manual: category smoke on one K-beauty subcategory; verify Bull Board completion; query DB for seller name + in-scope SKUs only.

### Backend

- No migration logic tests required beyond existing patterns; manually verify seller row after migrate.
- Optional: unit test `buildSellerProductPageUrl` with iHerb template + sample sku once locked.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build` (includes `prisma generate`)

---

## Risks

| Risk | Mitigation |
|------|------------|
| Cloudflare blocks all listing/PDP paths | YesStyle-style `IHERB_SCRAPING_DISABLED` default **true**; spike go/no-go; document blocked state on roadmap |
| Full product sitemap tempts scope creep | **Locked:** category-scoped ingest only; no `products-*.xml` bulk enqueue in v1 |
| `catalog.app.iherb.com` API dead or blocked | HTML listing fields for v1; PDP phase optional |
| K-beauty products appear in multiple subcategories | Dedupe by product id in upsert (`Product.sku` unique per seller) |
| Slug required for working PDP links | Spike locks template; store slug in spec if needed |
| iHerb ToS restricts automated access | Spike + legal review before production cron |
| Large category pagination | Cap pages per job (`IHERB_LISTING_MAX_PAGES`); log truncation |
| Rate limiting | `IHERB_REQUEST_DELAY_MS` ≥ 1000ms; concurrency 1 |
| Optional priority / maintenance burden | Explicit go decision; prefer finishing dedicated retailers first |
| Architect rejects seed timing | Spike + doc review before DDL |

---

## Implementation TODO

- [x] **Phase 0:** Spike complete — sitemap OK, listing/PDP blocked by Cloudflare without browser cookie
- [ ] **Phase 0:** Write `docs/iherbSpike.md`; add `debugIherbUrls.ts` (deferred while blocked)
- [x] **Phase 0:** Record **go / no-go** — **blocked** on listing ingest (cookie/browser required)
- [x] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, listing parse strategy
- [ ] **Phase 0:** DevTools capture of category listing API (deferred while blocked)
- [x] **Phase 1:** Architect approval for iHerb seller + staging category seed migration
- [x] **Phase 1:** Apply migration; `db:pull` in scrapers
- [x] **Phase 2:** Env, `IHERB_SCRAPING_DISABLED`, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [ ] **Phase 2:** Add iHerb to `probeRetailerStorefronts.ts` defaults (deferred while blocked)
- [x] **Phase 3:** K-beauty category sitemap seed (52 categories); listing fetch blocked at runtime
- [ ] **Phase 3:** `upsertProductFromIherbHit` smoke ingest (blocked — no listing HTML)
- [ ] **Phase 3:** Unit tests for mappers/upsert + disabled-flag behavior
- [ ] **Phase 4:** PDP enrichment job + spec mapping (blocked — PDP 403)
- [ ] **Phase 4:** Unit tests for PDP mappers (if Phase 4 proceeds)
- [ ] **Phase 5:** Update `kBeautyRetailerRoadmap.md` and playbook cross-link
