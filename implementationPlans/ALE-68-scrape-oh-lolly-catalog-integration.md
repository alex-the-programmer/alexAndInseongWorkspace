# ALE-68 Scrape Oh Lolly catalog integration

## Context

[Linear ALE-68](https://linear.app/dewly/issue/ALE-68/scrape-oh-lolly-catalog-integration): add a **full retailer integration** for [Oh Lolly](https://ohlolly.com/) — a **US-based K-beauty specialist** (California; curated clean Korean beauty, domestic warehouse / fast US shipping).

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook (same BullMQ + upsert shape as Jolse / Soko Glam).

**Branch:** `ALE-68-scrape-oh-lolly-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — Oh Lolly is **not yet listed**; add a row when spike starts.
- [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) — **first Shopify retailer**; introduces shared `src/scrapers/shopify/*`. ALE-68 should **reuse that platform layer** (do not reimplement JSON/sitemap parsing).
- [ALE-59](ALE-59-scrape-wishtrend-catalog-integration.md), [ALE-61](ALE-61-scrape-roseroseshop-catalog-integration.md) — parallel Shopify retailers; same reuse pattern after ALE-58.

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

**Platform note:** Oh Lolly is a **Shopify** storefront (Cloudflare in front). Public `.json` catalog endpoints are reachable from datacenter `curl` in early probes — same integration shape as Soko Glam, not Cafe24/Magento HTML parsers. Catalog is **smaller** (~478 PDPs) than most roadmap retailers, which makes it a good **second or third Shopify consumer** to validate the shared `shopify/` module.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `Oh Lolly` as its own `sellers` row with US `productUrlTemplate` |
| Listing ingest | Discover SKUs via product sitemap + collection JSON; persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs from Shopify product JSON (`body_html`, `tags`, `product_type`, images) |
| Operations | BullMQ namespace `ohLolly.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Roadmap | Add Oh Lolly to `kBeautyRetailerRoadmap.md`; move **Planned** → **Done** when shipped |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges.
- Frontend changes.
- Non-US Shopify markets / localized storefront paths — ingest **US** catalog (`localization=US`) only.
- Full taxonomy unification beyond staging category.
- Shopify **UCP/MCP** agent checkout APIs (`/api/ucp/mcp`, `agents.md`) — catalog-only HTTP JSON is sufficient for scrapers.
- Per-variant `Product` rows (YesStyle-style) unless spike proves parent-product pricing is unusable for cards.

---

## Current state

### Oh Lolly storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **Shopify** (`cdn.shopify.com`, theme assets on `/cdn/shop/`, `shopify-complexity-score` header) |
| CDN / edge | **Cloudflare** (`cf-ray`, `server: cloudflare`); anonymous GETs return **200** for sitemap, collection JSON, product JSON |
| Canonical host | `https://ohlolly.com/` (no `www` redirect observed in early probes) |
| Localization | Default `localization=US`, `cart_currency=USD` cookies on anonymous GET |
| Sitemap index | `https://ohlolly.com/sitemap.xml` → `sitemap_products_1.xml`, `sitemap_collections_1.xml`, pages, blogs, `sitemap_agentic_discovery.xml` |
| Product catalog size | ~**478** PDP `<loc>` entries in `sitemap_products_1.xml` (query params `?from=&to=` on child urlset) |
| Collection catalog size | ~**155** collection URLs in `sitemap_collections_1.xml` |
| Product URLs | `/products/{handle}` e.g. `/products/missha-time-revolution-night-repair-ampoule-5x` |
| Collection URLs | `/collections/{handle}` e.g. `/collections/skincare` |
| Product JSON | `GET /products/{handle}.json` → full product + variants — **200** from Node |
| Collection JSON | `GET /collections/{handle}/products.json?limit=250&page=N` → paginated summaries — **200** (`/collections/skincare` returned products in probe) |
| Brand field | Shopify `vendor` maps to `brands.name` (e.g. `Missha`, `Pyunkang Yul`) |
| Currency | USD |

**Implication:** Oh Lolly is a strong fit for the **Shopify JSON + sitemap** integration introduced in ALE-58. Queue topology mirrors Jolse/StyleKorean; fetch/parse logic should live in **`src/scrapers/shopify/`** with thin `ohLolly/` wiring. Smaller catalog (~478 SKUs) enables fast end-to-end smoke and full ingest during development.

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| Jolse | `jolse.*` | Gzip product sitemaps + category HTML | `upsertProductFromJolseHit` |
| YesStyle | `yesStyle.*` | Category sitemap + HTML (blocked by default) | `upsertProductFromYesStyleHit` |
| Soko Glam (ALE-58) | `sokoGlam.*` | Product sitemap + collection JSON | `upsertProductFromSokoGlamHit` |

`queueNames.ts` today defines namespaces for `oliveYoung`, `yesStyle`, `styleKorean`, `jolse`, and `oliveYoungUs` only — Oh Lolly adds `ohLolly.*`.

### Backend card links

Oh Lolly will be **`linkable = true`** (default). Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | Oh Lolly target (ALE-68) |
|------|-------|--------------------------|
| `sellers` row | None | **`Oh Lolly`** + US `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / Oh Lolly`** |
| SKU key | N/A | Shopify product **`handle`** (slug string) — proposed |
| Listing discovery | N/A | Product sitemap + `collections/{handle}/products.json` |
| Fetch layer | No Oh Lolly helpers; **`shopify/` may not exist until ALE-58 merges** | Reuse **`src/scrapers/shopify/*`** from ALE-58 |
| Scraper package | N/A | **`src/scrapers/ohLolly/*`** (jobs, constants, upsert, spec prefix) |
| Queue namespace | N/A | **`ohLolly.*`** |
| HTTP client | No `ohlolly.com` host rules | Throttle + optional cookie + Chrome UA override |
| Roadmap | Not listed | New row in `kBeautyRetailerRoadmap.md` |

---

## Design decisions

### 1. US storefront only, canonical base `https://ohlolly.com` (proposed)

- Standardize env `OH_LOLLY_SITE_BASE_URL` on **`https://ohlolly.com`** (no `www`).
- Early probes already set `localization=US` / `cart_currency=USD`; spike should confirm prices stay USD without extra locale hacks.

### 2. Queue namespace `ohLolly.*` (locked)

Mirror StyleKorean/Jolse/Soko Glam queue set:

```ts
ohLolly.sellerCategoryHierarchy
ohLolly.sellerCategoryMapping
ohLolly.categoryProducts
ohLolly.sitemapProducts
ohLolly.product
ohLolly.productPdp
```

Worker concurrency: **`ohLolly.product` and `ohLolly.productPdp` at 1** initially.

### 3. `Product.sku` = Shopify product `handle` (proposed — confirm in spike)

Extract from:

- Sitemap PDP loc: `/products/{handle}`
- Collection JSON: `product.handle`
- Product JSON: `product.handle`

**Rationale:** PDP URLs are handle-based; `buildSellerProductPageUrl` can use `https://ohlolly.com/products/{{sku}}`.

### 4. One `Product` row per Shopify product, not per variant (proposed)

- Upsert **one** commerce `Product` per Shopify parent product (`handle`).
- **Price** on `seller_product_prices`: use the **minimum** `variant.price` among **available** variants.
- Store variant count / option summary in listing specs if useful (`OL Variant count`, `OL Options`).

### 5. `Seller.productUrlTemplate` (proposed)

```text
https://ohlolly.com/products/{{sku}}
```

where `{{sku}}` is the product `handle`.

### 6. Listing before PDP (locked)

**Phase A** — sitemap + collection JSON → `upsertProductFromOhLollyHit` (brand, product, seller_product, price, listing specs from product JSON).

**Phase B** — `ohLolly.productPdp` enrichment for `body_html` flattening, tags, images, and optional review widgets once listing is stable.

Because Shopify `.json` returns rich PDP fields, Phase A jobs should fetch product JSON (not sitemap-only stubs) unless queue pressure requires a two-step split.

### 7. HTTP client reuse + Oh Lolly host rules (locked)

Extend `src/lib/httpClient.ts`:

- `OH_LOLLY_REQUEST_DELAY_MS` throttle for `ohlolly.com`
- `OH_LOLLY_BROWSER_COOKIE` optional cookie injection
- Chrome desktop UA substitution when `SCRAPER_USER_AGENT` is the default bot string
- Reuse shared `getJson` / `fetchShopifyProductJson` from `shopify/` layer

Default throttle ≥ **700ms** (tune in spike; small catalog allows slightly faster smoke).

### 8. Sitemap-first ingest with collection enrichment (proposed)

1. **Product sitemap walk** — parse `sitemap_products_1.xml` (handle query params on child urlset); extract handles from `/products/{handle}` locs.
2. **Collection discovery** — parse `sitemap_collections_1.xml` → `seller_categories` rows (`/collections/{handle}`). Exclude non-merchandising collections (`gift-cards`, checkout helpers) per spike.
3. **Category products job** — paginate `GET /collections/{handle}/products.json?limit=250&page=N` to refresh price, brand, name, thumbnail.

**Priority:** sitemap jobs > collection listing jobs (`ohLollyProductIngestPriorities` mirroring Jolse).

### 9. Collection hierarchy — flat v1 (proposed)

Shopify collection sitemaps do not expose parent/child trees. v1:

- `sellerCategoryHierarchy` seeds flat `seller_categories` from collections sitemap.
- `parentSellerCategoryId = null` for all rows unless spike documents a reliable nav-based parent map.

### 10. Spec prefix `OL ` (proposed)

PDP-derived specs use prefix **`OL `** (e.g. `OL Thumbnail URL`, `OL Description`, `OL Product type`, `OL Tags`) for manual curation batches — mirror `JL ` / `SG ` / `SK ` conventions.

### 11. Reuse shared Shopify platform layer from ALE-58 (locked)

**Prerequisite:** merge [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) `src/scrapers/shopify/` before or alongside ALE-68 implementation.

ALE-68 adds only:

- Backend seed (`sellers`, `product_categories`)
- `src/scrapers/ohLolly/*` — upsert choke point, spec prefix mapper, BullMQ jobs, env constants
- Queue registration + HTTP routes
- Oh Lolly-specific collection exclude regex defaults (if any)

**Do not** duplicate sitemap walkers or JSON parsers in `ohLolly/`.

If ALE-58 is not merged when work starts, implement the `shopify/` module per ALE-58 §11 first, then wire Oh Lolly as the next consumer — avoid a one-off Oh-Lolly-only JSON stack.

---

## Phase 0 — Spike (gate before bulk ingest)

**Deliverable:** `commerce-platform-scrapers/docs/ohLollySpike.md` (same shape as `jolseSpike.md` / `sokoGlamSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://ohlolly.com/` (with backend env) and record friction.
2. Confirm product sitemap walk end-to-end from Node; lock count (~478); note query params on child sitemap URL (`?from=&to=`).
3. Lock regex for `handle` extraction from sitemap loc and collection/product JSON.
4. Enumerate collections from sitemap; propose exclude list (gift cards, marketing-only collections).
5. From one collection (`skincare`, pages 1–2) and one multi-variant PDP JSON, capture:
   - product name, brand (`vendor`), min price, compare-at price, thumbnail `images[0].src`, availability
   - pagination termination (`products.json` empty page vs partial page)
6. Decide **parent product vs per-variant** `Product` rows (default: parent product).
7. Test whether **Chrome UA + optional cookie** remains sufficient from production scraper hosts (no Playwright).
8. Propose locked `productUrlTemplate`, `Product.sku` field, and JSON field mapping.
9. Note review widget presence (Yotpo, Judge.me, Shopify native) — defer review ingest unless spike finds a stable public endpoint.
10. Document 429/403 behavior and recommended `OH_LOLLY_REQUEST_DELAY_MS`.
11. Skim `https://ohlolly.com/agents.md` — document UCP/MCP for future agents; **do not** depend on it for v1 scrapers.

**Debug script (add in spike PR):** `scripts/debugOhLollyUrls.ts` — prints sample handles from product sitemap + one collection `products.json` page without DB writes.

**Early spike observations (June 2026 — replace with spike doc):**

- Sitemap + product/collection JSON: **200 OK** from Node `curl` with Chrome UA.
- ~**478** product URLs, ~**155** collections.
- `GET /products/{handle}.json` returns full variant arrays and `body_html`.
- `GET /collections/skincare/products.json?limit=5` returns products.
- Cloudflare present but not blocking anonymous catalog JSON in early probes.
- Default localization is **US** / USD in early probes.

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.

### Schema change

**None** — reuse existing `sellers`, `product_categories`, `currencies` tables.

### Data changes (migration SQL)

| Table | Action |
|-------|--------|
| `sellers` | **INSERT** row: `name = 'Oh Lolly'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = `https://ohlolly.com/products/{{sku}}` |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / Oh Lolly'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_68_oh_lolly_seller_and_staging_category`

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs an Oh Lolly-specific branch after PDP specs exist (see Phase 5).

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `OH_LOLLY_SELLER_NAME`, `OH_LOLLY_STAGING_PRODUCT_CATEGORY_NAME`, `OH_LOLLY_SITE_BASE_URL`, `OH_LOLLY_SITEMAP_INDEX_URL`, throttle knobs, optional cookie, `OH_LOLLY_COLLECTION_PRODUCTS_PAGE_SIZE` (default 250), collection exclude regex |
| Entity resolvers | `ensureCommerceEntities.ts` — `findOhLollySeller`, `findStagingProductCategoryForOhLolly` |
| Constants | `src/scrapers/ohLolly/ohLollyConstants.ts` — spec prefix `OL `, default collection exclude regex |
| Shopify reuse | **No new platform code** if ALE-58 merged — jobs call `shopify/collectProductHandlesFromSitemaps`, `fetchShopifyProductJson`, etc. with `siteBaseUrl` from env |
| Queue names | `queueNames.ts` — `ohLollyQueueNames`, `ohLollyProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; stub `productPdp` worker OK initially |
| HTTP client | `httpClient.ts` — throttle, cookie, UA override for `ohlolly.com` |
| HTTP routes | `server.ts` — `POST /jobs/oh-lolly/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products`, `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Add `https://ohlolly.com/` to `scripts/probeRetailerStorefronts.ts` default URL list |
| `.env.example` | Document all new knobs |

---

## Phase 3 — Listing ingest

Implement after spike doc is approved.

| Component | Location | Purpose |
|-----------|----------|---------|
| `collectProductHandlesFromSitemaps.ts` | **`shopify/`** | Walk sitemap index; parse product urlsets; extract handles (reusable) |
| `collectCollectionHandlesFromSitemaps.ts` | **`shopify/`** | Parse collections sitemap → collection handles (reusable) |
| `fetchShopifyCollectionProductsPage.ts` | **`shopify/`** | Paginated `products.json` for a collection handle |
| `mapShopifyProductJsonToListingFields.ts` | **`shopify/`** | Neutral listing fields (name, vendor, min price, image, handle) |
| `discoverOhLollySellerCategoryNodes.ts` | `ohLolly/` | Job glue: call `shopify/` collectors + apply Oh Lolly exclude regex → `seller_categories` |
| `summarizeOhLollyListingFields.ts` | `ohLolly/` | Typed summary for upsert |
| `upsertProductFromOhLollyHit.ts` | `ohLolly/` | Single DB choke point (mirror `upsertProductFromJolseHit`) |
| Jobs | `ohLolly/jobs/` | `sellerCategoryHierarchy`, `sellerCategoryMapping`, `scrapeCategoryProducts`, `scrapeSitemapProducts`, `scrapeProduct` — thin; pass `siteBaseUrl` into `shopify/` |
| `scrapeProduct.ts` worker | `ohLolly/jobs/` | `fetchShopifyProductJson` → map → upsert; concurrency **1**; `P2002`-aware |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/oh-lolly/seller-category-hierarchy
# POST /jobs/oh-lolly/sitemap-products  { "maxProducts": 20 }
# POST /jobs/oh-lolly/category-products  { "maxSellerCategories": 1 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from sitemap smoke; `seller_products` + `seller_product_prices` rows visible for `Oh Lolly`; `buildSellerProductPageUrl` returns valid `ohlolly.com` links for smoke handles. Full catalog ingest (~478 SKUs) should complete in a single dev session given catalog size.

---

## Phase 4 — PDP + spec enrichment

| Component | Location | Purpose |
|-----------|----------|---------|
| `mapShopifyProductJsonToPdpFields.ts` | **`shopify/`** | Neutral PDP field struct from product JSON |
| `mapOhLollyProductJsonToSpecRows.ts` | `ohLolly/` | Wraps shared PDP fields → `ProductSellerSpec` rows with **`OL `** prefix |
| `enrichProductPdp.ts` job | `ohLolly/jobs/` | Re-fetch via `fetchShopifyProductJson`; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | `ohLolly/jobs/` | Keyset batch from Postgres → `addBulk` |
| Reviews | — | **Optional v1** — only ingest if spike finds stable Yotpo/Judge.me public API or parseable HTML block |

---

## Phase 5 — Docs + roadmap + backend follow-ups

| Task | Location |
|------|----------|
| Spike notes | `docs/ohLollySpike.md` |
| Roadmap row | `docs/kBeautyRetailerRoadmap.md` — add Oh Lolly; Planned → In progress → Done |
| Playbook cross-link | Ensure **Shopify retailers** subsection in `retailerScrapingPlaybook.md` references `shopify/` reuse (from ALE-58) |
| Queue hygiene script | `scripts/ohLollyProductQueue.ts` (optional; copy Jolse script) |
| Thumbnails | `getProductThumbnailUrl` — `images[0].src` from `OL Thumbnail URL` spec or Shopify CDN fallback |

**Suggested roadmap placement:** after curated US specialists (Soko Glam) or alongside Wishtrend — smaller catalog, high curation signal for K-beauty recommendations.

---

## Test plan

### Scrapers

- Reuse unit tests under **`src/scrapers/shopify/`** (from ALE-58) — no duplicate fixture work unless Oh Lolly exposes edge cases.
- Unit test for `upsertProductFromOhLollyHit` with mocked prisma (match Jolse/StyleKorean test style if present).
- Manual: sitemap smoke 20 products; optional full-catalog run (~478); verify Bull Board completion; query DB for seller name + URL template.

### Backend

- No migration logic tests required beyond existing patterns; manually verify seller row after migrate.
- Optional: unit test `buildSellerProductPageUrl` with Oh Lolly template + sample handle once locked.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build` (includes `prisma generate`)

---

## Risks

| Risk | Mitigation |
|------|------------|
| `shopify/` module not merged from ALE-58 | Implement or merge ALE-58 platform layer first; do not fork JSON parsing into `ohLolly/` |
| Multi-variant pricing on cards | Use min available variant price; spike multi-variant PDP; document in upsert |
| `handle` changes break old SKUs | Rare; monitor 404 on JSON fetch; optional `OL Shopify product id` spec for reconciliation |
| Collection sitemap noise (gift cards, promos) | Exclude regex in env; document in spike |
| Cloudflare tightens bot rules | Chrome UA + optional cookie; Playwright fallback only if JSON blocked |
| Small catalog may hide pagination bugs | Spike still validates `products.json` pagination on largest collection |
| Architect rejects seed timing | Spike + doc review before DDL |

---

## Implementation TODO

- [x] **Phase 0:** Early spike observations captured in plan (Shopify JSON + sitemap confirmed)
- [x] **Phase 1:** Architect approval for Oh Lolly seller + staging category seed migration
- [x] **Phase 1:** Apply migration; `db:pull` in scrapers
- [x] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [x] **Phase 2:** Reuse `src/scrapers/shopify/` from ALE-58; wire `ohLolly/` jobs to shared helpers
- [x] **Phase 3:** Sitemap + collection JSON fetch + `upsertProductFromOhLollyHit`; full ingest (477 products from 477 sitemap handles)
- [x] **Phase 4:** PDP enrichment job + spec mapping (477/477 products enriched)
- [ ] **Phase 5:** Update `kBeautyRetailerRoadmap.md` and verify playbook Shopify subsection
