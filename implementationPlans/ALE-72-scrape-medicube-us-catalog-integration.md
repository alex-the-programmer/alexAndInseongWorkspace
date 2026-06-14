# ALE-72 Scrape Medicube US catalog integration

## Context

[Linear ALE-72](https://linear.app/dewly/issue/ALE-72/scrape-medicube-us-catalog-integration): add a **full seller integration** for [Medicube US](https://medicube.us/) — the **official US brand storefront** for Medicube (single-brand; smaller catalog than multi-brand retailers).

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook (same BullMQ + upsert shape as Jolse / StyleKorean).

**Branch:** `ALE-72-scrape-medicube-us-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) — **first Shopify integration**; introduces shared `src/scrapers/shopify/*`. Medicube US should **reuse that platform layer**, not reimplement JSON/sitemap logic.
- [ALE-56](ALE-56-scrape-jolse-catalog-integration.md) — recent full integration reference (queues, upsert choke point, enqueue-all PDP).

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

**Platform note:** Medicube US is **Shopify** (`cdn.shopify.com`, `shopify-complexity-score` headers). Public JSON endpoints (`/products/{handle}.json`, `/collections/{handle}/products.json`) return **200** from datacenter `curl` — same integration shape as Soko Glam (ALE-58).

**Roadmap note:** Medicube US is a **single-brand official storefront**, not a multi-brand marketplace. It is **not** on `kBeautyRetailerRoadmap.md` today. After shipping, add a **Brand storefronts** subsection (or a dedicated row) so future official-brand shops (e.g. other K-beauty DTC sites) follow the same pattern.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `Medicube US` as its own `sellers` row with US `productUrlTemplate` |
| Listing ingest | Discover SKUs via product sitemap + collection JSON; persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs from Shopify product JSON (`body_html`, `tags`, `product_type`, images) |
| Brand correctness | Map all products to brand **`Medicube`** (official store); do not trust Shopify `vendor` sentinel (`SHOPIFY_ME`) |
| Operations | BullMQ namespace `medicubeUs.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Shared Shopify layer | Reuse `src/scrapers/shopify/*` from ALE-58 — thin `medicubeUs/` wiring only |
| Roadmap / docs | Document Medicube US in scrapers docs after ingest is stable |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges.
- Frontend changes.
- Non-US Shopify markets / localized storefront paths — ingest **US** (`medicube.us`, `localization=US`) only.
- Full taxonomy unification beyond staging category.
- Per-variant `Product` rows unless spike proves parent-product pricing is unusable for cards.
- Review ingest (Yotpo / Judge.me / Shopify native) unless spike finds a stable public endpoint.

---

## Current state

### Medicube US storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **Shopify** (`cdn.shopify.com`, `shopify-complexity-score`, theme assets on `medicube.us/cdn/shop/`) |
| CDN / edge | **Cloudflare** (`cf-ray`, `cf-cache-status`); anonymous GETs return **200** for sitemap and JSON |
| Canonical host | `medicube.us` (no `www` redirect observed in probes) |
| Sitemap index | `https://medicube.us/sitemap.xml` → `sitemap_products_1.xml`, `sitemap_collections_1.xml`, pages, blogs, `sitemap_agentic_discovery.xml` |
| Product catalog size | ~**318** PDP `<loc>` entries in `sitemap_products_1.xml` (single child urlset; excludes root `/` loc) |
| Collection catalog size | ~**67** collection URLs in `sitemap_collections_1.xml` |
| Product URLs | `/products/{handle}` e.g. `/products/red-cream` |
| Collection URLs | `/collections/{handle}` e.g. `/collections/red-line`, `/collections/best-sellers` |
| Product JSON | `GET /products/{handle}.json` → full Shopify product object — **200** |
| Collection JSON | `GET /collections/red-line/products.json?limit=250&page=N` → paginated summaries — **200** |
| Variants | Mix of single-variant and multi-variant products (confirm in spike) |
| Shopify `vendor` | Often **`SHOPIFY_ME`** (Shopify Markets sentinel), **not** `Medicube` — brand must be overridden in upsert |
| `product_type` | Product-line labels e.g. `RED LINE - Acne Care` — useful for listing specs |
| Currency | USD (`cart_currency=USD`, `localization=US` cookie) |

**Implication:** Medicube US is an ideal **second Shopify retailer** after Soko Glam — smaller catalog (~318 vs ~803), same JSON + sitemap protocol. Implementation should be mostly **env + upsert + queue wiring** atop `shopify/`, with one retailer-specific rule: **fixed brand name `Medicube`**.

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| Jolse | `jolse.*` | Gzip product sitemaps + category HTML | `upsertProductFromJolseHit` |
| Soko Glam (ALE-58) | `sokoGlam.*` | Shopify sitemap + collection JSON | `upsertProductFromSokoGlamHit` |

Medicube US follows the **Soko Glam / Shopify** shape with a thinner retailer folder because the catalog is single-brand and smaller.

`queueNames.ts` today defines namespaces for `oliveYoung`, `yesStyle`, `styleKorean`, `jolse`, and `oliveYoungUs` — Medicube US adds `medicubeUs.*` (and assumes `sokoGlam.*` + `shopify/` land from ALE-58 first).

### Backend card links

Medicube US will be **`linkable = true`** (default). Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | Medicube US target (ALE-72) |
|------|-------|---------------------------|
| `sellers` row | None | **`Medicube US`** + US `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / Medicube US`** |
| SKU key | N/A | Shopify product **`handle`** (slug string) |
| Listing discovery | N/A | Product sitemap + `collections/{handle}/products.json` |
| Fetch layer | No `shopify/` in `main` yet (ALE-58) | Reuse **`src/scrapers/shopify/*`** |
| Scraper package | N/A | **`src/scrapers/medicubeUs/*`** (jobs, constants, upsert, spec prefix) |
| Queue namespace | N/A | **`medicubeUs.*`** |
| HTTP client | No `medicube.us` host rules | Throttle + optional cookie + UA override |
| Brand mapping | N/A | Always **`Medicube`** regardless of `vendor` |

---

## Design decisions

### 1. US storefront only, canonical base `https://medicube.us` (proposed)

- Standardize env `MEDICUBE_US_SITE_BASE_URL` on **`https://medicube.us`**.
- Sitemap `<loc>` values and JSON paths use bare host.

### 2. Queue namespace `medicubeUs.*` (locked)

Mirror Jolse / Soko Glam queue set:

```ts
medicubeUs.sellerCategoryHierarchy
medicubeUs.sellerCategoryMapping
medicubeUs.categoryProducts
medicubeUs.sitemapProducts
medicubeUs.product
medicubeUs.productPdp
```

Worker concurrency: **`medicubeUs.product` and `medicubeUs.productPdp` at 1** initially.

### 3. `Product.sku` = Shopify product `handle` (proposed)

Extract from sitemap PDP loc, collection JSON, and product JSON. PDP template: `https://medicube.us/products/{{sku}}`.

### 4. One `Product` row per Shopify product, not per variant (proposed)

Same rule as Soko Glam: upsert one commerce `Product` per parent `handle`; price = **minimum** available variant price.

### 5. `Seller.productUrlTemplate` (proposed)

```text
https://medicube.us/products/{{sku}}
```

### 6. Brand name override — always `Medicube` (locked)

Official single-brand storefront. Shopify `vendor` is **`SHOPIFY_ME`** on sampled PDPs — **do not** create a `SHOPIFY_ME` brand row.

In `upsertProductFromMedicubeUsHit`:

- `brandName = "Medicube"` (constant or env `MEDICUBE_US_BRAND_NAME` defaulting to `Medicube`).
- Optionally store raw Shopify `vendor` in a listing spec (`MC Shopify vendor`) for debugging.

### 7. Listing before PDP (locked)

**Phase A** — sitemap + collection JSON → `upsertProductFromMedicubeUsHit` (fetch product JSON for listing fields).

**Phase B** — `medicubeUs.productPdp` for `body_html` flattening, tags, images, `product_type`.

Because Shopify `.json` is rich, Phase A jobs should fetch product JSON (not sitemap-only stubs).

### 8. HTTP client — Medicube US host rules (locked)

Extend `src/lib/httpClient.ts`:

- `MEDICUBE_US_REQUEST_DELAY_MS` throttle for `medicube.us`
- `MEDICUBE_US_BROWSER_COOKIE` optional cookie injection
- Chrome desktop UA when `SCRAPER_USER_AGENT` is the default bot string

Default throttle ≥ **700ms** (tune in spike).

### 9. Sitemap-first ingest with collection enrichment (proposed)

1. **Product sitemap walk** — parse `sitemap_products_1.xml`; filter `/products/{handle}`; skip root `/` loc.
2. **Collection discovery** — parse `sitemap_collections_1.xml` → `seller_categories` rows.
3. **Category products job** — paginate `GET /collections/{handle}/products.json?limit=250&page=N`.

Exclude non-merchandising collections in spike (`gift-cards`, bundles-only marketing pages if any).

### 10. Collection hierarchy — flat v1 (proposed)

Shopify collection sitemaps have no parent/child tree. v1: `parentSellerCategoryId = null` for all rows.

### 11. Spec prefix `MC ` (proposed)

PDP-derived specs use prefix **`MC `** (e.g. `MC Thumbnail URL`, `MC Description`, `MC Product type`, `MC Tags`, `MC Product line`) — mirror `JL ` / `SG ` conventions.

### 12. Dependency on ALE-58 `shopify/` module (locked)

**Prerequisite:** Merge or cherry-pick ALE-58 shared `src/scrapers/shopify/*` before Medicube US bulk ingest.

If ALE-58 is not on `main` when work starts:

1. Land `shopify/` from ALE-58 first (minimal shared module + fixtures).
2. Implement Medicube US as retailer #2 to **prove** the abstraction — avoid duplicating JSON parsers in `medicubeUs/`.

Medicube US jobs call `shopify/` with `siteBaseUrl` from env; **no** `MEDICUBE_US_*` imports inside `shopify/`.

---

## Phase 0 — Spike (gate before bulk ingest)

**Deliverable:** `commerce-platform-scrapers/docs/medicubeUsSpike.md` (same shape as `jolseSpike.md` / `sokoGlamSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://medicube.us/` and record friction.
2. Confirm product sitemap walk from Node; count PDP URLs (~318 expected); note if multiple `sitemap_products_*.xml` children appear.
3. Lock regex for `handle` extraction from sitemap loc and collection/product JSON.
4. Enumerate collections from sitemap; propose exclude list (gift cards, empty `products.json` collections).
5. From one collection (`red-line`, pages 1–2) and one multi-variant PDP JSON, capture name, min price, compare-at, thumbnail, availability.
6. Confirm `products.json` pagination (`page` param, max `limit`, termination).
7. Document **`vendor` = `SHOPIFY_ME`** behavior; lock brand override to `Medicube`.
8. Test Chrome UA + optional cookie from scraper hosts.
9. Propose locked `productUrlTemplate`, `Product.sku` field, and JSON field mapping.
10. Note review widget presence — defer unless stable public API found.
11. Document 429/403 behavior and recommended `MEDICUBE_US_REQUEST_DELAY_MS`.

**Debug script (add in spike PR):** `scripts/debugMedicubeUsUrls.ts` — sample handles from product sitemap + one collection `products.json` page without DB writes.

**Early spike observations (June 2026 — replace with spike doc):**

- Sitemap + product/collection JSON: **200 OK** from Node `curl`.
- ~**318** product URLs, ~**67** collections.
- `GET /products/red-cream.json` returns full variant + `body_html`; price USD **22.00**.
- `GET /collections/red-line/products.json?limit=3` returns products.
- Cloudflare present but not blocking anonymous catalog JSON in early probes.

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.

### Schema change

**None** — reuse existing `sellers`, `product_categories`, `currencies` tables.

### Data changes (migration SQL)

| Table | Action |
|-------|--------|
| `sellers` | **INSERT** row: `name = 'Medicube US'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = `https://medicube.us/products/{{sku}}` |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / Medicube US'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_72_medicube_us_seller_and_staging_category`

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs a Medicube-specific branch after PDP specs exist.

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`  
**Depends on:** ALE-58 `shopify/` module present on branch.

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `MEDICUBE_US_SELLER_NAME`, `MEDICUBE_US_STAGING_PRODUCT_CATEGORY_NAME`, `MEDICUBE_US_SITE_BASE_URL`, `MEDICUBE_US_BRAND_NAME` (default `Medicube`), sitemap/throttle/cookie knobs, collection exclude regex |
| Entity resolvers | `ensureCommerceEntities.ts` — `findMedicubeUsSeller`, `findStagingProductCategoryForMedicubeUs` |
| Constants | `src/scrapers/medicubeUs/medicubeUsConstants.ts` — spec prefix `MC `, collection exclude regex |
| Retailer folder | `src/scrapers/medicubeUs/*` — upsert, spec mappers, summarize listing fields; jobs under `src/jobs/medicubeUs/` |
| Queue names | `queueNames.ts` — `medicubeUsQueueNames`, `medicubeUsProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` |
| HTTP client | `httpClient.ts` — throttle, cookie, UA for `medicube.us` |
| HTTP routes | `server.ts` — `POST /jobs/medicube-us/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products`, `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Add `https://medicube.us/` to `scripts/probeRetailerStorefronts.ts` default URL list |
| `.env.example` | Document all new knobs |

---

## Phase 3 — Listing ingest

| Component | Location | Purpose |
|-----------|----------|---------|
| Sitemap / JSON collectors | **`shopify/`** (from ALE-58) | Reuse unchanged |
| `discoverMedicubeUsSellerCategoryNodes.ts` | `medicubeUs/` | Job glue + collection exclude regex → `seller_categories` |
| `summarizeMedicubeUsListingFields.ts` | `medicubeUs/` | Typed summary; forces `brandName: Medicube` |
| `upsertProductFromMedicubeUsHit.ts` | `medicubeUs/` | Single DB choke point |
| Jobs | `medicubeUs/jobs/` | hierarchy, mapping, category products, sitemap products, scrape product |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/medicube-us/seller-category-hierarchy
# POST /jobs/medicube-us/sitemap-products  { "maxProducts": 20 }
# POST /jobs/medicube-us/category-products  { "maxSellerCategories": 1 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from sitemap smoke; all smoke products have brand **`Medicube`**; `seller_products` + `seller_product_prices` rows visible; `buildSellerProductPageUrl` returns valid `medicube.us` links.

---

## Phase 4 — PDP + spec enrichment

| Component | Location | Purpose |
|-----------|----------|---------|
| `mapShopifyProductJsonToPdpFields.ts` | **`shopify/`** | Neutral PDP struct (reuse) |
| `mapMedicubeUsProductJsonToSpecRows.ts` | `medicubeUs/` | Wraps shared fields → `ProductSellerSpec` rows with **`MC `** prefix |
| `enrichProductPdp.ts` job | `medicubeUs/jobs/` | Re-fetch product JSON; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | `medicubeUs/jobs/` | Keyset batch → `addBulk` |

Full catalog ingest (~318 SKUs) should complete quickly after smoke passes.

---

## Phase 5 — Docs + roadmap

| Task | Location |
|------|----------|
| Spike notes | `docs/medicubeUsSpike.md` |
| Roadmap / brand storefronts | `docs/kBeautyRetailerRoadmap.md` — add **Brand storefronts** row for Medicube US → Done |
| Playbook | Cross-link in Shopify retailers subsection (from ALE-58) — Medicube US as retailer #2 example |
| Queue hygiene script | `scripts/medicubeUsProductQueue.ts` (optional) |
| Thumbnails | `getProductThumbnailUrl` — `images[0].src` from `MC Thumbnail URL` or Shopify CDN fallback |

---

## Test plan

### Scrapers

- Reuse **`shopify/`** unit tests from ALE-58; add Medicube-specific fixtures only if JSON shape differs (unlikely).
- Unit test `upsertProductFromMedicubeUsHit` asserts brand is always **`Medicube`** when Shopify `vendor` is `SHOPIFY_ME`.
- Manual: sitemap smoke 20 products; full ingest ~318; verify Bull Board + DB.

### Backend

- Manually verify seller row after migrate.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build`

---

## Risks

| Risk | Mitigation |
|------|------------|
| ALE-58 `shopify/` not merged | Land shared module first; do not fork JSON parsers |
| `SHOPIFY_ME` vendor breaks brand cards | Hardcode `Medicube` brand in upsert; spike documents sentinel |
| Small catalog masks pagination bugs | Still unit-test pagination helpers via `shopify/` fixtures |
| Collection exclude list wrong | Spike enumerates empty `products.json` collections |
| Cloudflare tightens rules | Chrome UA + optional cookie; same mitigations as Soko Glam |
| Handle churn | Rare; optional `MC Shopify product id` spec for reconciliation |
| Architect rejects seed timing | Spike + doc review before DDL |

---

## Implementation TODO

- [x] **Phase 0:** Complete spike; add `debugMedicubeUsUrls.ts` (spike doc deferred)
- [x] **Phase 0:** Lock `productUrlTemplate`, `Product.sku`, brand override, variant pricing, collection exclude list
- [x] **Phase 0:** Confirm ALE-58 `shopify/` module is available on implementation branch
- [x] **Phase 1:** Architect approval for Medicube US seller + staging category seed migration
- [x] **Phase 1:** Apply migration; `db:pull` in scrapers
- [x] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [x] **Phase 2:** `medicubeUs/` upsert + spec prefix + thin jobs calling `shopify/`
- [x] **Phase 3:** Sitemap + collection JSON ingest + smoke (5 products ingested; brand = Medicube verified)
- [ ] **Phase 3:** Unit tests for upsert brand override
- [x] **Phase 4:** PDP enrichment job + enqueue-all routes (smoke: 1 enrich)
- [ ] **Phase 4:** Unit tests for PDP spec mapper (when fixtures exist)
- [ ] **Phase 5:** Update roadmap (brand storefronts) and playbook cross-link
- [ ] **Follow-up:** Thumbnail resolver fallback after ingest (if needed)
