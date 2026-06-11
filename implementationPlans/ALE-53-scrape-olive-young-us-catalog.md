# ALE-53 Scrape Olive Young US catalog (us.oliveyoung.com)

## Context

[Linear ALE-53](https://linear.app/dewly/issue/ALE-53/scrape-olive-young-us-catalog-usoliveyoungcom): add a **full retailer integration** for the Olive Young **US storefront** (`https://us.oliveyoung.com/`), separate from the existing **Olive Young Global** scrape (`global.oliveyoung.com`).

US shoppers should land on `us.oliveyoung.com` PDPs, not Global — see related [ALE-44](https://linear.app/dewly/issue/ALE-44/oliveyong-links-send-users-to-the-global-instead-of-the-us-store). Product cards today resolve URLs from `sellers.productUrlTemplate` + `products.sku` via the **cheapest** `seller_products` offer (`getLowestPriceOffer`). Without US catalog rows, cards only link to Global.

**ALE-44 fix (bundled with backend work):** add `sellers.linkable` (`boolean`). Global Olive Young stays in the DB for **product info** (specs, reviews, agent search) but is **`linkable = false`** — shopper-facing cards must not use non-linkable sellers for PDP URL / retailer name. Olive Young US is **`linkable = true`**. No geo-based “US preference” logic.

**Branch:** `ALE-53-scrape-olive-young-us-catalog` (backend + scrapers; matching branches in each repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — Olive Young Global case study (architecture to copy).
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — add US row once spike is done.
- [ALE-44](https://linear.app/dewly/issue/ALE-44/oliveyong-links-send-users-to-the-global-instead-of-the-us-store) — **`sellers.linkable`** + filter card offer selection (backend). Schema/migration can ship before US ingest is complete; cards for Global-only products disappear until US `seller_products` exist.

**Database changes:** Yes — `sellers.linkable` column, seed updates, new US `sellers` row, staging `product_categories` row (see below). **Architect approval required** before applying migrations.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `Olive Young US` as its own `sellers` row (not an alias of Global) |
| Listing ingest | Discover US SKUs + persist `products`, `seller_products`, `seller_product_prices`, facet specs |
| PDP enrichment | Structured specs (and optionally reviews) from US APIs — phase after listing is stable |
| Operations | BullMQ namespace `oliveYoungUs.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Unblock ALE-44 | `linkable = false` on Global + card paths ignore non-linkable sellers; US ingest supplies linkable offers |

**Out of scope (v1):**

- Cross-retailer product dedupe / merge with Global `prdtNo` (existing `ProductMatchCandidate` pipeline).
- Frontend changes.
- Replacing or disabling Global ingest.
- Full taxonomy unification beyond staging category (same as other retailers).

---

## Current state

### Olive Young Global (done — template to copy)

| Layer | Location | Behavior |
|-------|----------|----------|
| Seller resolution | `ensureCommerceEntities.findOliveYoungSeller` | `OLIVE_YOUNG_SELLER_NAME` → `"Olive Young Global"` |
| Listing sources | Ranking API (`product-ranking-service.oliveyoung.com`) + `global.oliveyoung.com` sitemap (`prdtNo` in `/product/detail?prdtNo=`) |
| Upsert choke point | `upsertProductFromOliveYoungHit` | `Product.sku` = `prdtNo` |
| Queues | `oliveYoung.*` in `queueNames.ts` | hierarchy → mapping → categoryProducts / sitemapProducts → product → productPdp |
| HTTP triggers | `POST /jobs/olive-young/*` in `server.ts` | Enqueue only |
| PDP | `global.oliveyoung.com` JSON POSTs + `product-review-service` | `ProductSpec`, `ProductReview*` |

### Product card URL resolution (backend — why ALE-44 hurts today)

```text
listSellerOffersForProduct(productId)
  → buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)
getLowestPriceOffer → cheapest price wins (all sellers)
resolveShoppingProductCardPdpUrls / getShoppingProductCard / getShoppingProductCardsBatch
```

Global seller `productUrlTemplate` points at `global.oliveyoung.com`. US seller row does not exist. Today the **cheapest** offer is often Global, so cards link there.

**Target behavior:** card resolution considers only sellers where `linkable = true`. Global data (`ProductSellerSpec`, reviews, search corpus) is unchanged. Products with **only** non-linkable offers produce **no card** (same as missing `productUrl` today).

### Olive Young US storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | Remix/React SPA; assets on `us-dist.oliveyoung.com` |
| Bot wall | Cloudflare present; anonymous `GET /` returns **200** (unlike YesStyle) |
| Sitemap | `robots.txt` → `sitemap-index.xml` → **`sitemap-static.xml` only** (home, `/best-sellers`, `/categories/D01`…, legal pages). **No product PDP URLs** in sitemap (unlike Global). |
| Categories | Top nav uses `/categories/D01` … `/categories/D07` (not Global’s `ctgrNo` query API) |
| BFF host | `commerce-bff.oliveyoung.com` — cart/checkout APIs (`/v1/carts/…`); CORS `access-control-allow-origin: https://us.oliveyoung.com` |
| Listing HTML | Category / best-seller pages are **client-rendered** — raw `curl` does not expose product links; ingest must use **JSON APIs** (spike) or Playwright as fallback |

**Implication:** Cannot port Global’s sitemap + ranking-service paths verbatim. Phase 0 spike must document US listing + PDP API contracts before large fan-out.

---

## Gap analysis

| Area | Global today | US target (ALE-53) |
|------|--------------|-------------------|
| `sellers` row | `Olive Young Global` | **`Olive Young US`** + US `productUrlTemplate` |
| Staging category | `Staging taxonomy / Olive Young Global` | **`Staging taxonomy / Olive Young US`** |
| SKU key | `prdtNo` (alphanumeric) | **TBD in spike** (likely numeric or slug id from US BFF) |
| Listing discovery | Ranking + sitemap | **Category/listing API and/or curated routes** (`/best-sellers`, `/categories/D*`) |
| Scraper package | `src/scrapers/oliveYoung/*` | **`src/scrapers/oliveYoungUs/*`** (do not overload Global constants) |
| Queue namespace | `oliveYoung.*` | **`oliveYoungUs.*`** |
| Image specs | Relative paths → `image.globaloliveyoungshop.com` in backend | US may emit **absolute CDN URLs** — verify in spike; may need `OY US` spec prefix or seller-based origin in `getProductThumbnailUrl` |
| Thumbnail resolver | `isOliveYoungSpecName` → Global CDN | May need US branch when seller is Olive Young US |
| Card link eligibility | All sellers used for cheapest offer | Only **`sellers.linkable = true`** for card PDP / retailer name |
| `sellers.linkable` | Column does not exist | **`boolean NOT NULL DEFAULT true`**; Global → `false` |

---

## Design decisions

### 1. Separate integration, not a flag on Global (locked)

US is a different domain, catalog, and API surface. Mirror the **StyleKorean** pattern (parallel namespace + upsert module) rather than branching inside `src/scrapers/oliveYoung/*`.

### 2. Queue namespace `oliveYoungUs.*` (locked)

```ts
oliveYoungUs.sellerCategoryHierarchy
oliveYoungUs.sellerCategoryMapping
oliveYoungUs.categoryProducts   // or listingProducts — name after spike
oliveYoungUs.sitemapProducts    // only if spike finds product URLs; else omit or no-op
oliveYoungUs.product
oliveYoungUs.productPdp
```

Worker concurrency: **`product` and `productPdp` at 1** initially (same race-safety rationale as Global).

### 3. `Product.sku` = US stable product id (locked)

Use the retailer’s canonical id from spike (e.g. BFF `productId`, commerce sku code, or slug token). **Do not** reuse Global `prdtNo` unless spike proves 1:1 identity (unlikely).

Optional: prefix `us:` in sku if collision risk with Global alphanumeric ids — decide in spike doc.

### 4. `Seller.productUrlTemplate` (spike → then lock)

Template must contain `{{sku}}` per `buildSellerProductPageUrl`. Candidate shapes to validate:

- `https://us.oliveyoung.com/products/{{sku}}`
- Slug-based PDP if API returns slug separate from sku — then store slug in `sku` or add spec for slug and use redirect-friendly template

Record exact template in spike doc before migration.

### 5. Listing before PDP (locked)

Follow playbook phase split:

1. **Phase A** — listing ingest → `upsertProductFromOliveYoungUsHit` (brand, product, seller_product, price, listing specs).
2. **Phase B** — `oliveYoungUs.productPdp` enrichment once listing queue is stable.

### 6. HTTP client reuse (locked)

All outbound calls through `src/lib/httpClient.ts` with new env `OLIVE_YOUNG_US_REQUEST_DELAY_MS` (per-host throttle on `us.oliveyoung.com`, `commerce-bff.oliveyoung.com`, and any image CDN host).

### 7. `sellers.linkable` instead of US preference (locked)

Add a boolean on **`sellers`** (Prisma `Seller.linkable`, DB column `linkable`):

| Seller | `linkable` | Role |
|--------|------------|------|
| Olive Young Global | **`false`** | Rich catalog source (specs, reviews, agent tools); **not** a card PDP target |
| Olive Young US | **`true`** | Shopper-facing PDP links |
| All other existing sellers | **`true`** (migration default) | Unchanged behavior |

**Product info vs card links:** scraping, specs, thumbnails, and agent search continue to use Global (and other) seller data. Only **shopper-facing card enrichment** filters offers by `linkable`.

**Where to filter (card paths only — do not narrow agent tools by default):**

| Interaction | Change |
|-------------|--------|
| `getLowestPriceOffer` | Add optional `linkableOnly?: boolean` **or** new `getLowestPriceLinkableOffer` used by cards |
| `resolveShoppingProductCardPdpUrls` | Pick cheapest offer among linkable sellers with a valid `productUrl` |
| `getShoppingProductCard` | Same |
| `getShoppingProductCardsBatch` | When building `flatOffers`, skip `seller_products` whose `seller.linkable` is false |
| `listSellerOffersForProduct` | **No change** — agent `listSellerOffersForProduct` / `getLowestPriceOffer` tools keep full offer list for cross-retailer context |

If a product has no linkable offer with a resolvable URL, the card is omitted (`null` / skipped in batch), even when Global specs and reviews exist.

---

## Phase 0 — Spike (gate before bulk ingest)

**Deliverable:** `commerce-platform-scrapers/docs/oliveYoungUsSpike.md` (same shape as `styleKoreanSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://us.oliveyoung.com/` and record friction.
2. In browser DevTools (or Playwright script), capture network calls for:
   - `/categories/D01` (or one category)
   - `/best-sellers`
   - One PDP
3. Document for each endpoint:
   - URL, method, required headers (`Origin`, `Referer`, cookies)
   - Pagination model
   - Stable **product id** field for `Product.sku`
   - Price, brand, name, thumbnail fields for listing upsert
   - PDP detail fields for Phase B
4. Confirm whether `commerce-bff.oliveyoung.com` exposes **catalog** routes (not only cart) or a separate host (e.g. product/catalog service).
5. Confirm **product sitemap** absent vs delayed — if absent, category/listing API is primary ingest.
6. Propose `productUrlTemplate` and example PDP URLs.
7. Note 403/429 behavior and whether `OLIVE_YOUNG_US_BROWSER_COOKIE` is needed.

**Debug script (add in spike PR):** `scripts/debugOliveYoungUsUrls.ts` — prints sample ids from one listing source without DB writes.

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.

### Schema change

| Table | Column | Type | Notes |
|-------|--------|------|-------|
| `sellers` | `linkable` | `BOOLEAN NOT NULL DEFAULT true` | Prisma: `linkable Boolean @default(true) @map("linkable")` on `Seller` |

### Data changes (same migration or follow-up seed SQL)

| Table | Action |
|-------|--------|
| `sellers` | **UPDATE** `name = 'Olive Young Global'` → `linkable = false` |
| `sellers` | **INSERT** row: `name = 'Olive Young US'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = *from spike* |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / Olive Young US'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row (no schema change) |

**Migration naming:** `ale_53_sellers_linkable_and_olive_young_us` (or split: `ale_44_sellers_linkable` + `ale_53_olive_young_us_seller` if ALE-44 lands first).

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

### Phase 1b — Card offer filtering (ALE-44, can ship before US ingest)

**Repo:** `commerce-platform-backend`

1. Include `seller.linkable` in Prisma selects where offers are loaded for cards.
2. Filter to `linkable === true` in `resolveShoppingProductCardPdpUrls`, `getShoppingProductCard`, `getShoppingProductCardsBatch`.
3. Unit tests: Global-only product → no card; US + Global offers → card uses US URL; linkable-only cheapest wins.

Ship Phase 1b as soon as `linkable` column exists — Global cards stop immediately; US cards appear as ingest adds `seller_products`.

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `OLIVE_YOUNG_US_SELLER_NAME`, `OLIVE_YOUNG_US_STAGING_PRODUCT_CATEGORY_NAME`, `OLIVE_YOUNG_US_SITE_BASE_URL`, throttle knobs, optional cookie |
| Entity resolvers | `ensureCommerceEntities.ts` — `findOliveYoungUsSeller`, `findStagingProductCategoryForOliveYoungUs` |
| Constants | `src/scrapers/oliveYoungUs/oliveYoungUsConstants.ts` |
| Queue names | `queueNames.ts` — `oliveYoungUsQueueNames`, ingest priorities |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; stub `productPdp` worker OK initially |
| HTTP routes | `server.ts` — `POST /jobs/olive-young-us/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products` (if applicable), `…/product-sources`, `…/product-pdp-enrich` |
| `.env.example` | Document all new knobs |

---

## Phase 3 — Listing ingest

Implement after spike doc is approved.

| Component | Purpose |
|-----------|---------|
| `discoverOliveYoungUsSellerCategoryNodes.ts` | Seed `seller_categories` from US nav (`/categories/D*`) or API category tree |
| `fetchOliveYoungUsCategoryListing.ts` (name TBD) | Paginated product rows for one category / best-sellers |
| `listingHitToListingFields.ts` | Normalize API row → upsert payload |
| `upsertProductFromOliveYoungUsHit.ts` | Single DB choke point (mirror `upsertProductFromOliveYoungHit` / StyleKorean) |
| Jobs | `sellerCategoryHierarchy`, `sellerCategoryMapping` (staging mapping), `scrapeCategoryProducts`, optional `scrapeSitemapProducts` |
| `scrapeProduct.ts` worker | Concurrency **1**; `P2002`-aware upserts |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/olive-young-us/seller-category-hierarchy
# POST /jobs/olive-young-us/category-products  { "maxSellerCategories": 1 }
# Bull Board: /admin/queues
```

**Success criteria:** At least one US category ingested; `seller_products` + `seller_product_prices` rows visible for `Olive Young US`; `buildSellerProductPageUrl` returns valid `us.oliveyoung.com` links for smoke SKUs.

---

## Phase 4 — PDP + spec enrichment

| Component | Purpose |
|-----------|---------|
| `fetchOliveYoungUsProductDetail.ts` | PDP API client(s) from spike |
| `mapOliveYoungUsDetailToSpecRows.ts` | `ProductSellerSpec` rows; prefix specs `OY US ` (parallel to Global `OY `) for thumbnail resolver |
| `enrichProductPdp.ts` job | One job per sku; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + script | Keyset batch from Postgres → `addBulk` |
| Reviews | **Optional v1** — only if US exposes review API without auth; else defer |

---

## Phase 5 — Docs + roadmap

| Task | Location |
|------|----------|
| Spike notes | `docs/oliveYoungUsSpike.md` |
| Roadmap row | `docs/kBeautyRetailerRoadmap.md` — Olive Young US: Spike → In progress → Done |
| Playbook cross-link | One paragraph in `retailerScrapingPlaybook.md` pointing at US differences (no product sitemap) |
| Queue hygiene script | `scripts/oliveYoungUsProductQueue.ts` (optional; copy OY Global script) |

---

## Backend follow-ups (after US ingest)

| Change | Rationale |
|--------|-----------|
| `getProductThumbnailUrl` — US image origin or absolute URL handling | If US listing specs use `us-dist.oliveyoung.com` paths |
| Thumbnail resolution in batch cards | May still use Global spec paths when US has no image spec yet |

---

## Test plan

### Scrapers

- Unit tests for parsers mappers (`listingHitToListingFields`, category id extraction) with **fixture JSON** from spike.
- Unit test for `upsertProductFromOliveYoungUsHit` with jest-prisma or mocked prisma (match existing scrapers test style if present).
- Manual: smoke ingest 1 category; verify Bull Board job completion; query DB for seller name + URL template.

### Backend

- Unit tests for **linkable filtering**: Global-only → no card; mixed sellers → linkable cheapest wins; all non-linkable → no card.
- Unit test `buildSellerProductPageUrl` with US template + sample sku.
- After migration: confirm `Olive Young Global.linkable = false`, US seller row exists with `linkable = true`.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build` (includes `prisma generate`)

---

## Risks

| Risk | Mitigation |
|------|------------|
| No public product sitemap | Category/listing API ingest; spike first |
| BFF requires session / geo | Document cookie env; Playwright last resort |
| SKU ≠ Global `prdtNo` | Separate products until dedupe; do not force shared sku |
| Cloudflare escalation | `probe:storefronts` in CI optional; throttle + concurrency 1 |
| Architect rejects migration timing | Spike + doc review before DDL |
| Global `linkable = false` before US ingest | Expected: many products temporarily have no card until US `seller_products` exist |
| Agent still sees Global offers via tools | By design; only card enrichment filters `linkable` |

---

## Shipped (2026-06-11)

| Repo | PR |
|------|-----|
| `commerce-platform-backend` | https://github.com/alex-the-programmer/commerce-platform-backend/pull/19 |
| `commerce-platform-scrapers` | https://github.com/alex-the-programmer/commerce-platform-scrapers/pull/1 |

**Outcomes:**

- `sellers.linkable` migration + Olive Young US seller / staging category seed
- Card PDP URLs use linkable offers only (`getLowestPriceLinkableOffer`, `pickLowestPricedSellerOffer`)
- US listing ingest via `use-storefront-api-gw.oliveyoung.com` category APIs (D01–D07) — **2,791** products
- US PDP enrichment (`oliveYoungUs.productPdp`) — **2,765** products enriched (~**145** specs/product avg); **26** delisted SKUs 404'd
- `getProductThumbnailUrl` / batch cards recognize `OY US Thumbnail URL` specs
- Preview migration fix: seller id sequence bump before seed INSERTs (`cecf277`)

**Locked values from spike:**

- `Product.sku` = US `product_id` (e.g. `UA79297712`)
- `productUrlTemplate` = `https://us.oliveyoung.com/products/{{sku}}`
- Listing API = `GET /api/v1/q/categories/{D01-D07}/products`
- PDP API = `GET /api/v1/q/display/pages/pdp/{productUsId}`

---

## Implementation TODO

- [x] **Phase 0:** Complete spike; write `docs/oliveYoungUsSpike.md`; add `debugOliveYoungUsUrls.ts` (spike doc shipped; debug script deferred)
- [x] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, and primary listing API in spike doc
- [x] **Phase 1:** Architect approval for `sellers.linkable` column + seed updates + US seller/category rows
- [x] **Phase 1:** Apply migration; `db:pull` in scrapers
- [x] **Phase 1b (ALE-44):** Filter card offer selection to `seller.linkable = true`; unit tests
- [x] **Phase 2:** Env, queue names, `ensureCommerceEntities`, workers, HTTP routes
- [x] **Phase 3:** Category listing fetch + `upsertProductFromOliveYoungUsHit`; smoke + full catalog ingest
- [ ] **Phase 3:** Unit tests for mappers/upsert (deferred — no scrapers test harness yet)
- [x] **Phase 4:** PDP enrichment job + spec mapping + enqueue-all routes
- [ ] **Phase 4:** Unit tests for PDP mappers (deferred)
- [ ] **Phase 5:** Update `kBeautyRetailerRoadmap.md` and playbook cross-link (deferred)
- [x] **Follow-up:** US thumbnail CDN handling in `getProductThumbnailUrl` after ingest
