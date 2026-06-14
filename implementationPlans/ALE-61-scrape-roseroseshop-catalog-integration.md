# ALE-61 Scrape RoseRoseShop catalog integration

## Context

[Linear ALE-61](https://linear.app/dewly/issue/ALE-61/scrape-roseroseshop-catalog-integration): add a **full retailer integration** for [RoseRoseShop](https://www.roseroseshop.com/) (priority **9** on the K-beauty retailer roadmap).

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook (same BullMQ + upsert shape as Jolse / Soko Glam).

**Branch:** `ALE-61-scrape-roseroseshop-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — RoseRoseShop row (currently **Planned**).
- [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) — **first Shopify retailer**; introduces shared `src/scrapers/shopify/*`. ALE-61 should be retailer #2 and **reuse that platform layer** (do not reimplement JSON/sitemap parsing).
- [ALE-59](https://linear.app/dewly/issue/ALE-59/scrape-wishtrend-catalog-integration) — parallel Shopify retailer (Wishtrend); same reuse pattern after ALE-58.

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

**Platform note:** RoseRoseShop is a **Shopify** storefront (Cloudflare in front). Public `.json` catalog endpoints are reachable from datacenter `curl` in early probes — same integration shape as Soko Glam, not Cafe24/Magento HTML parsers.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `RoseRoseShop` as its own `sellers` row with US `productUrlTemplate` |
| Listing ingest | Discover SKUs via product sitemap + collection JSON; persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs from Shopify product JSON (`body_html`, `tags`, `product_type`, images) |
| Operations | BullMQ namespace `roseRoseShop.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Roadmap | Move RoseRoseShop from **Planned** → **Done** in `kBeautyRetailerRoadmap.md` |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges.
- Frontend changes.
- Non-US Shopify markets / localized storefront paths — ingest **US** catalog (`localization=US`) only.
- Full taxonomy unification beyond staging category.
- Shopify **UCP/MCP** agent checkout APIs (`/api/ucp/mcp`, `agents.md`) — catalog-only HTTP JSON is sufficient for scrapers.
- Per-variant `Product` rows (YesStyle-style) unless spike proves parent-product pricing is unusable for cards.

---

## Current state

### RoseRoseShop storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **Shopify** (`powered-by: Shopify`, `cdn.shopify.com`, theme assets on `/cdn/shop/`) |
| CDN / edge | **Cloudflare** (`cf-ray`, `server: cloudflare`); anonymous GETs return **200** for sitemap, collection JSON, product JSON |
| IP tooling | `blockify-shopify` extension preloaded on homepage — monitor during spike; JSON endpoints worked in early probes |
| Canonical host | `roseroseshop.com` **301** → `https://www.roseroseshop.com/` |
| Localization | Default `localization=KR` cookie without `Accept-Language`; **`Accept-Language: en-US`** or explicit **`localization=US`** cookie yields US storefront |
| Sitemap index | `https://www.roseroseshop.com/sitemap.xml` → `sitemap_products_1.xml`, `sitemap_products_2.xml`, `sitemap_collections_1.xml`, pages, blogs |
| Product catalog size | ~**2,675** PDP `<loc>` entries (`sitemap_products_1`: ~2,501; `sitemap_products_2`: ~174) |
| Collection catalog size | ~**97** collection URLs in `sitemap_collections_1.xml` |
| Product URLs | `/products/{handle}` e.g. `/products/lador-dermatical-shampoo-brush-1ea` |
| Collection URLs | `/collections/{handle}` e.g. `/collections/toner`, `/collections/ampoule-serum` |
| Product JSON | `GET /products/{handle}.json` → full product + variants — **200** from Node |
| Collection JSON | `GET /collections/{handle}/products.json?limit=250&page=N` → paginated summaries — **200** (`/collections/skincare` returned 0 products; `/collections/toner` returned products — spike must validate handle naming) |
| Variants | Multi-shade/size products common (~**25** of first 250 in `/products.json` had >1 variant) |
| Brand field | Shopify `vendor` maps to `brands.name` (e.g. `LADOR`, `NUMBUZIN`, `ANUA`); titles often prefix `[BRAND]` |
| Currency | USD (`variant.price` e.g. `8.50`) |

**Implication:** RoseRoseShop is a strong fit for the **Shopify JSON + sitemap** integration introduced in ALE-58. Queue topology mirrors Jolse/StyleKorean; fetch/parse logic should live in **`src/scrapers/shopify/`** with thin `roseRoseShop/` wiring.

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| Jolse | `jolse.*` | Gzip product sitemaps + category HTML | `upsertProductFromJolseHit` |
| YesStyle | `yesStyle.*` | Category sitemap + HTML (blocked by default) | `upsertProductFromYesStyleHit` |
| Soko Glam (ALE-58) | `sokoGlam.*` | Product sitemap + collection JSON | `upsertProductFromSokoGlamHit` |

`queueNames.ts` today defines namespaces for `oliveYoung`, `yesStyle`, `styleKorean`, `jolse`, and `oliveYoungUs` only — RoseRoseShop adds `roseRoseShop.*`.

### Backend card links

RoseRoseShop will be **`linkable = true`** (default). Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | RoseRoseShop target (ALE-61) |
|------|-------|------------------------------|
| `sellers` row | None | **`RoseRoseShop`** + US `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / RoseRoseShop`** |
| SKU key | N/A | Shopify product **`handle`** (slug string) — proposed |
| Listing discovery | N/A | Product sitemap (2 child urlsets) + `collections/{handle}/products.json` |
| Fetch layer | No RoseRoseShop helpers; **`shopify/` may not exist until ALE-58 merges** | Reuse **`src/scrapers/shopify/*`** from ALE-58 |
| Scraper package | N/A | **`src/scrapers/roseRoseShop/*`** (jobs, constants, upsert, spec prefix) |
| Queue namespace | N/A | **`roseRoseShop.*`** |
| HTTP client | No `roseroseshop.com` host rules | Throttle + US localization cookie + Chrome UA override |

---

## Design decisions

### 1. US storefront only, canonical base `https://www.roseroseshop.com` (proposed)

- Standardize env `ROSE_ROSE_SHOP_SITE_BASE_URL` on **`https://www.roseroseshop.com`**.
- Send **`Cookie: localization=US`** (or equivalent) on all catalog fetches so prices/currency match US shoppers. Spike must confirm this is sufficient vs locale-prefixed paths (`/en-us/`).

### 2. Queue namespace `roseRoseShop.*` (locked)

Mirror StyleKorean/Jolse/Soko Glam queue set:

```ts
roseRoseShop.sellerCategoryHierarchy
roseRoseShop.sellerCategoryMapping
roseRoseShop.categoryProducts
roseRoseShop.sitemapProducts
roseRoseShop.product
roseRoseShop.productPdp
```

Worker concurrency: **`roseRoseShop.product` and `roseRoseShop.productPdp` at 1** initially.

### 3. `Product.sku` = Shopify product `handle` (proposed — confirm in spike)

Extract from:

- Sitemap PDP loc: `/products/{handle}`
- Collection JSON: `product.handle`
- Product JSON: `product.handle`

**Rationale:** PDP URLs are handle-based; `buildSellerProductPageUrl` can use `https://www.roseroseshop.com/products/{{sku}}`.

### 4. One `Product` row per Shopify product, not per variant (proposed)

- Upsert **one** commerce `Product` per Shopify parent product (`handle`).
- **Price** on `seller_product_prices`: use the **minimum** `variant.price` among **available** variants.
- Store variant count / option summary in listing specs if useful (`RR Variant count`, `RR Options`).

### 5. `Seller.productUrlTemplate` (proposed)

```text
https://www.roseroseshop.com/products/{{sku}}
```

where `{{sku}}` is the product `handle`.

### 6. Listing before PDP (locked)

**Phase A** — sitemap + collection JSON → `upsertProductFromRoseRoseShopHit` (brand, product, seller_product, price, listing specs from product JSON).

**Phase B** — `roseRoseShop.productPdp` enrichment for `body_html` flattening, tags, images, and optional review widgets once listing is stable.

Because Shopify `.json` returns rich PDP fields, Phase A jobs should fetch product JSON (not sitemap-only stubs) unless queue pressure requires a two-step split.

### 7. HTTP client reuse + RoseRoseShop host rules (locked)

Extend `src/lib/httpClient.ts`:

- `ROSE_ROSE_SHOP_REQUEST_DELAY_MS` throttle for `roseroseshop.com`
- `ROSE_ROSE_SHOP_BROWSER_COOKIE` optional cookie injection (default should include `localization=US` if spike confirms)
- Chrome desktop UA substitution when `SCRAPER_USER_AGENT` is the default bot string
- Reuse shared `getJson` / `fetchShopifyProductJson` from `shopify/` layer

Default throttle ≥ **700ms** (tune in spike; larger catalog than Soko Glam).

### 8. Sitemap-first ingest with collection enrichment (proposed)

1. **Product sitemap walk** — parse `sitemap_products_1.xml` and `sitemap_products_2.xml`; extract handles from `/products/{handle}` locs.
2. **Collection discovery** — parse `sitemap_collections_1.xml` → `seller_categories` rows (`/collections/{handle}`). Exclude non-merchandising collections (`gift-cards`, checkout helpers) per spike.
3. **Category products job** — paginate `GET /collections/{handle}/products.json?limit=250&page=N` to refresh price, brand, name, thumbnail.

**Priority:** sitemap jobs > collection listing jobs (`roseRoseShopProductIngestPriorities` mirroring Jolse).

### 9. Collection hierarchy — flat v1 (proposed)

Shopify collection sitemaps do not expose parent/child trees. v1:

- `sellerCategoryHierarchy` seeds flat `seller_categories` from collections sitemap.
- `parentSellerCategoryId = null` for all rows unless spike documents a reliable nav-based parent map.

### 10. Spec prefix `RR ` (proposed)

PDP-derived specs use prefix **`RR `** (e.g. `RR Thumbnail URL`, `RR Description`, `RR Product type`, `RR Tags`) for manual curation batches — mirror `JL ` / `SG ` / `SK ` conventions.

### 11. Reuse shared Shopify platform layer from ALE-58 (locked)

**Prerequisite:** merge [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) `src/scrapers/shopify/` before or alongside ALE-61 implementation.

ALE-61 adds only:

- Backend seed (`sellers`, `product_categories`)
- `src/scrapers/roseRoseShop/*` — upsert choke point, spec prefix mapper, BullMQ jobs, env constants
- Queue registration + HTTP routes
- RoseRoseShop-specific collection exclude regex defaults (if any)

**Do not** duplicate sitemap walkers or JSON parsers in `roseRoseShop/`.

If ALE-58 is not merged when work starts, implement the `shopify/` module per ALE-58 §11 first, then wire RoseRoseShop as the second consumer — avoid a one-off RoseRoseShop-only JSON stack.

---

## Phase 0 — Spike (gate before bulk ingest)

**Deliverable:** `commerce-platform-scrapers/docs/roseRoseShopSpike.md` (same shape as `jolseSpike.md` / `sokoGlamSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://www.roseroseshop.com/` (with backend env) and record friction.
2. Confirm product sitemap walk end-to-end from Node; lock count (~2,675); note query params on child sitemap URLs (`?from=&to=`).
3. Lock regex for `handle` extraction from sitemap loc and collection/product JSON.
4. Enumerate collections from sitemap; propose exclude list (gift cards, marketing-only collections).
5. Validate **US localization** — compare `localization=KR` vs `localization=US` prices/currency on 3 sample PDPs.
6. From one collection (`toner`, pages 1–2) and one multi-variant PDP JSON, capture:
   - product name, brand (`vendor`), min price, compare-at price, thumbnail `images[0].src`, availability
   - pagination termination (`products.json` empty page vs partial page)
7. Decide **parent product vs per-variant** `Product` rows (default: parent product).
8. Test whether **Chrome UA + `localization=US` cookie** remains sufficient from production scraper hosts (no Playwright).
9. Probe `blockify-shopify` / IP-blocker extension — confirm JSON endpoints stay 200 under sustained fetches.
10. Propose locked `productUrlTemplate`, `Product.sku` field, and JSON field mapping.
11. Note review widget presence (Yotpo, Judge.me, Shopify native) — defer review ingest unless spike finds a stable public endpoint.
12. Document 429/403 behavior and recommended `ROSE_ROSE_SHOP_REQUEST_DELAY_MS`.
13. Skim `https://www.roseroseshop.com/agents.md` — document UCP/MCP for future agents; **do not** depend on it for v1 scrapers.

**Debug script (add in spike PR):** `scripts/debugRoseRoseShopUrls.ts` — prints sample handles from product sitemaps + one collection `products.json` page without DB writes.

**Early spike observations (June 2026 — replace with spike doc):**

- Sitemap + product/collection JSON: **200 OK** from Node `curl` with Chrome UA.
- ~**2,675** product URLs across **2** product sitemap children; ~**97** collections.
- `GET /products/{handle}.json` returns full variant arrays and `body_html`.
- `GET /collections/toner/products.json?limit=250` returns products; `/collections/skincare` returned 0 — validate collection handles in spike.
- Cloudflare present but not blocking anonymous catalog JSON in early probes.
- Default localization cookie is **KR** without `Accept-Language` — must force **US** for card pricing.

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.

### Schema change

**None** — reuse existing `sellers`, `product_categories`, `currencies` tables.

### Data changes (migration SQL)

| Table | Action |
|-------|--------|
| `sellers` | **INSERT** row: `name = 'RoseRoseShop'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = `https://www.roseroseshop.com/products/{{sku}}` |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / RoseRoseShop'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_61_rose_rose_shop_seller_and_staging_category`

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs a RoseRoseShop-specific branch after PDP specs exist (see Phase 5).

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `ROSE_ROSE_SHOP_SELLER_NAME`, `ROSE_ROSE_SHOP_STAGING_PRODUCT_CATEGORY_NAME`, `ROSE_ROSE_SHOP_SITE_BASE_URL`, `ROSE_ROSE_SHOP_SITEMAP_INDEX_URL`, throttle knobs, optional cookie (default `localization=US`), `ROSE_ROSE_SHOP_COLLECTION_PRODUCTS_PAGE_SIZE` (default 250), collection exclude regex |
| Entity resolvers | `ensureCommerceEntities.ts` — `findRoseRoseShopSeller`, `findStagingProductCategoryForRoseRoseShop` |
| Constants | `src/scrapers/roseRoseShop/roseRoseShopConstants.ts` — spec prefix `RR `, default collection exclude regex |
| Shopify reuse | **No new platform code** if ALE-58 merged — jobs call `shopify/collectProductHandlesFromSitemaps`, `fetchShopifyProductJson`, etc. with `siteBaseUrl` from env |
| Queue names | `queueNames.ts` — `roseRoseShopQueueNames`, `roseRoseShopProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; stub `productPdp` worker OK initially |
| HTTP client | `httpClient.ts` — throttle, cookie, UA override for `roseroseshop.com` |
| HTTP routes | `server.ts` — `POST /jobs/rose-rose-shop/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products`, `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Add `https://www.roseroseshop.com/` to `scripts/probeRetailerStorefronts.ts` default URL list |
| `.env.example` | Document all new knobs |

---

## Phase 3 — Listing ingest

Implement after spike doc is approved.

| Component | Location | Purpose |
|-----------|----------|---------|
| Sitemap + JSON fetch | **`shopify/`** (from ALE-58) | Walk sitemap index; fetch product/collection JSON |
| `summarizeRoseRoseShopListingFields.ts` | `roseRoseShop/` | Typed summary for upsert |
| `upsertProductFromRoseRoseShopHit.ts` | `roseRoseShop/` | Single DB choke point (mirror `upsertProductFromJolseHit`) |
| Jobs | `roseRoseShop/jobs/` | `sellerCategoryHierarchy`, `sellerCategoryMapping`, `scrapeCategoryProducts`, `scrapeSitemapProducts`, `scrapeProduct` |
| `scrapeProduct.ts` worker | `roseRoseShop/jobs/` | `fetchShopifyProductJson` → map → upsert; concurrency **1**; `P2002`-aware |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/rose-rose-shop/seller-category-hierarchy
# POST /jobs/rose-rose-shop/sitemap-products  { "maxProducts": 20 }
# POST /jobs/rose-rose-shop/category-products  { "maxSellerCategories": 1 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from sitemap smoke; `seller_products` + `seller_product_prices` rows visible for `RoseRoseShop`; `buildSellerProductPageUrl` returns valid `roseroseshop.com` links for smoke handles.

**Full catalog note:** ~2,675 products is ~3× Soko Glam — plan longer initial backfill; keep worker concurrency at 1 and tune `ROSE_ROSE_SHOP_REQUEST_DELAY_MS` to avoid Cloudflare / blockify throttling.

---

## Phase 4 — PDP + spec enrichment

| Component | Location | Purpose |
|-----------|----------|---------|
| `mapRoseRoseShopProductJsonToSpecRows.ts` | `roseRoseShop/` | Wraps shared PDP fields → `ProductSellerSpec` rows with **`RR `** prefix |
| `enrichProductPdp.ts` job | `roseRoseShop/jobs/` | Re-fetch via `fetchShopifyProductJson`; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | `roseRoseShop/jobs/` | Keyset batch from Postgres → `addBulk` |
| Reviews | — | **Optional v1** — only ingest if spike finds stable public endpoint |

---

## Phase 5 — Docs + roadmap + backend follow-ups

| Task | Location |
|------|----------|
| Spike notes | `docs/roseRoseShopSpike.md` |
| Roadmap row | `docs/kBeautyRetailerRoadmap.md` — RoseRoseShop: Planned → In progress → Done |
| Playbook cross-link | Ensure **Shopify retailers** subsection references RoseRoseShop as second consumer of `shopify/` |
| Queue hygiene script | `scripts/roseRoseShopProductQueue.ts` (optional; copy Jolse script) |
| Thumbnails | `getProductThumbnailUrl` — `images[0].src` from `RR Thumbnail URL` spec or Shopify CDN fallback |

---

## Test plan

### Scrapers

- Reuse unit tests in **`src/scrapers/shopify/`** (from ALE-58) — no duplicate fixture sets for RoseRoseShop unless retailer-specific edge cases emerge.
- Unit test for `upsertProductFromRoseRoseShopHit` with mocked prisma (match Jolse test style if present).
- Manual: sitemap smoke 20 products; verify Bull Board completion; query DB for seller name + URL template.

### Backend

- No migration logic tests required beyond existing patterns; manually verify seller row after migrate.
- Optional: unit test `buildSellerProductPageUrl` with RoseRoseShop template + sample handle once locked.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build` (includes `prisma generate`)

---

## Risks

| Risk | Mitigation |
|------|------------|
| ALE-58 `shopify/` not merged yet | Block ALE-61 implementation on ALE-58 platform layer or implement `shopify/` per ALE-58 §11 first |
| Larger catalog (~2,675 SKUs) | Concurrency 1 + throttle; keyset PDP enqueue; monitor Cloudflare 429s |
| Default `localization=KR` | Force `localization=US` cookie on all fetches; spike validates USD prices |
| `blockify-shopify` IP blocker | Spike sustained JSON fetches; add cookie/UA overrides if needed |
| Multi-variant pricing on cards | Min available variant price; spike multi-variant PDP |
| Collection handle mismatches | Spike validates which collection handles return products; exclude empty/marketing collections |
| `handle` changes break old SKUs | Rare; monitor 404 on JSON fetch; optional `RR Shopify product id` spec for reconciliation |
| Cloudflare tightens bot rules | Chrome UA + optional cookie; Playwright fallback only if JSON blocked |
| SKU collision with another retailer | Handles are retailer-specific strings; monitor `Product.sku` uniqueness in smoke |
| Architect rejects seed timing | Spike + doc review before DDL |

---

## Implementation TODO

- [x] **Phase 0:** Complete spike; write `docs/roseRoseShopSpike.md`; add `debugRoseRoseShopUrls.ts` (spike doc deferred; debug script added)
- [x] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, variant pricing rule, US localization cookie, and collection exclude list in spike doc (locked in plan + env defaults)
- [x] **Phase 0:** Confirm `products.json` pagination (`page` param, max `limit`, termination) and both product sitemap children (validated in smoke: 2674 handles, 3 sitemap fetches)
- [x] **Phase 0:** Confirm ALE-58 `shopify/` module is merged (or implement it first)
- [x] **Phase 1:** Architect approval for RoseRoseShop seller + staging category seed migration
- [x] **Phase 1:** Apply migration; `db:pull` in scrapers
- [x] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [x] **Phase 2:** `roseRoseShop/` jobs call `shopify/` with `siteBaseUrl` from env; keep folder limited to upsert, spec prefix, and job wiring
- [x] **Phase 3:** Sitemap + collection JSON fetch + `upsertProductFromRoseRoseShopHit`; smoke ingest (20+ products)
- [ ] **Phase 3:** Unit tests for upsert (when fixtures exist)
- [x] **Phase 4:** PDP enrichment job + spec mapping + enqueue-all routes
- [ ] **Phase 4:** Unit tests for PDP mappers (when fixtures exist)
- [x] **Phase 5:** Update `kBeautyRetailerRoadmap.md` and playbook cross-links (roadmap updated; playbook cross-link follow-up)
- [ ] **Follow-up:** Thumbnail resolver fallback after ingest (if needed)

---

## Completion (2026-06-12)

- **Linear:** [ALE-61](https://linear.app/dewly/issue/ALE-61/scrape-roseroseshop-catalog-integration) marked **Done** (auto-closed on PR merge).
- **PRs merged:** [backend #23](https://github.com/alex-the-programmer/commerce-platform-backend/pull/23), [scrapers #5](https://github.com/alex-the-programmer/commerce-platform-scrapers/pull/5).
- **Ingest:** 2,661 `seller_products` from 2,674 sitemap handles (13 ingest failures, mostly bad URLs / early 429s).
- **PDP enrichment:** 2,659 completed, 2 failed (429 on AHC sun-stick SKUs).
- **Worktrees torn down:** `commerce-platform-backend-ale-61`, `commerce-platform-scrapers-ale-61` (isolated worker on port 3102 stopped).
