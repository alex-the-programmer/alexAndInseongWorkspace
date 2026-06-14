# ALE-73 Scrape Innisfree US catalog integration

## Context

[Linear ALE-73](https://linear.app/dewly/issue/ALE-73/scrape-innisfree-us-catalog-integration): add a **full seller integration** for [Innisfree US](https://us.innisfree.com/) — the **official US brand storefront** for Innisfree / Amorepacific.

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook (same BullMQ + upsert shape as other retailers).

**Branch:** `ALE-73-scrape-innisfree-us-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) — **first Shopify retailer**; introduces shared `src/scrapers/shopify/*`. Innisfree US should be retailer **#2** on that platform layer (thin wiring only if ALE-58 lands first).
- [ALE-56](ALE-56-scrape-jolse-catalog-integration.md) — recent non-Shopify full integration reference (queues, upsert choke point, enqueue-all PDP).

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

**Catalog shape:** **Single-brand** official store (~**126** PDPs, ~**76** collections in June 2026 probes). Every product `vendor` is `Innisfree`. Smaller than multi-brand marketplaces; good second Shopify integration to validate the shared module.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `Innisfree US` as its own `sellers` row with US `productUrlTemplate` |
| Listing ingest | Discover SKUs via product sitemap + collection JSON; persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs from Shopify product JSON (`body_html`, `tags`, `product_type`, images) |
| Operations | BullMQ namespace `innisfreeUs.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Shopify reuse | **Reuse** `src/scrapers/shopify/*` from ALE-58 — do not duplicate sitemap/JSON logic |
| Roadmap | Add Innisfree US to retailer docs (brand-storefront track) and mark **Done** when shipped |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges (including deduping Innisfree US SKUs vs Jolse/Soko Glam listings of the same product).
- Frontend changes.
- Non-US Innisfree storefronts (`innisfree.com` KR, other regional shops).
- Full taxonomy unification beyond staging category.
- Shopify **UCP/MCP** agent checkout APIs — catalog-only HTTP JSON is sufficient.
- Per-variant `Product` rows unless spike proves parent-product pricing is unusable for cards.

---

## Current state

### Innisfree US storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **Shopify** (`cdn.shopify.com` preconnect, `_shopify_*` cookies, `shopify-complexity-score` header) |
| CDN / edge | **Cloudflare** (`cf-cache-status: DYNAMIC`, `cf-ray`); anonymous GETs return **200** for homepage, sitemaps, and JSON |
| Canonical host | **`https://us.innisfree.com`** (US localization cookie `localization=US`, `cart_currency=USD`) |
| Sitemap index | `https://us.innisfree.com/sitemap.xml` → `sitemap_products_1.xml`, `sitemap_collections_1.xml`, pages, blogs, `sitemap_agentic_discovery.xml` |
| Sitemap child URLs | Child locs include **query params** (`?from=…&to=…`) — walker must fetch the full `<loc>` verbatim |
| Product catalog size | ~**127** `<loc>` entries in product sitemap (**~126** PDPs after excluding homepage `/` root loc) |
| Collection catalog size | ~**76** collection URLs in `sitemap_collections_1.xml` |
| Product URLs | `/products/{handle}` e.g. `/products/green-tea-seed-hyaluronic-serum` |
| Collection URLs | `/collections/{handle}` e.g. `/collections/green-tea`, `/collections/serum` |
| Product JSON | `GET /products/{handle}.json` → **200**; `vendor: Innisfree`, multi-variant products common |
| Collection JSON | `GET /collections/{handle}/products.json?limit=250&page=N` → **200** (verified on `green-tea`) |
| Brand field | Shopify `vendor` is always **`Innisfree`** (single-brand store) |
| `robots.txt` | Standard Shopify agent/UCP boilerplate; public product/collection JSON crawlable |

**Implication:** Innisfree US is a **straightforward Shopify JSON + sitemap** integration — same protocol as Soko Glam (ALE-58) with a **much smaller catalog** and **no multi-brand vendor diversity**. Prefer landing after ALE-58's `shopify/` module exists; otherwise extract the shared layer once and use it for both retailers.

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| Jolse | `jolse.*` | Gzip product sitemaps + category HTML | `upsertProductFromJolseHit` |
| Soko Glam (ALE-58) | `sokoGlam.*` | Product sitemap + collection JSON | `upsertProductFromSokoGlamHit` |

Innisfree US adds `innisfreeUs.*` and follows the **Soko Glam / Shopify** shape.

`queueNames.ts` today has no `innisfreeUs` namespace — add alongside other retailers.

### Backend card links

Innisfree US will be **`linkable = true`** (default). Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | Innisfree US target (ALE-73) |
|------|-------|------------------------------|
| `sellers` row | None | **`Innisfree US`** + US `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / Innisfree US`** |
| SKU key | N/A | Shopify product **`handle`** (slug string) — proposed |
| Listing discovery | N/A | Product sitemap + `collections/{handle}/products.json` |
| Fetch layer | No Innisfree helpers; **`shopify/` may not exist yet** | Reuse **`src/scrapers/shopify/*`** (from ALE-58) |
| Scraper package | N/A | **`src/scrapers/innisfreeUs/*`** (jobs, constants, upsert, spec prefix) |
| Queue namespace | N/A | **`innisfreeUs.*`** |
| HTTP client | No `us.innisfree.com` host rules | Throttle + optional cookie + UA override (Cloudflare) |
| Roadmap | Not listed | Add **brand storefront** row in `kBeautyRetailerRoadmap.md` |

---

## Dependency on ALE-58 (Shopify platform layer)

**Preferred sequencing:**

1. **ALE-58** lands `src/scrapers/shopify/*` with Soko Glam as reference retailer.
2. **ALE-73** adds only `innisfreeUs/` wiring (env, queues, upsert, spec prefix `IFU `, HTTP routes) and calls shared `shopify/` helpers with `siteBaseUrl: https://us.innisfree.com`.

**If ALE-73 starts before ALE-58 merges:**

- Do **not** fork duplicate sitemap/JSON parsers into `innisfreeUs/`.
- Extract `shopify/` as part of whichever ticket lands first; the second ticket becomes mostly retailer-specific glue.
- Spike doc for Innisfree can still proceed in parallel (HTTP probes are independent).

---

## Design decisions

### 1. US storefront only, canonical base `https://us.innisfree.com` (proposed)

- Standardize env `INNISFREE_US_SITE_BASE_URL` on **`https://us.innisfree.com`**.
- Do not ingest KR or other regional Innisfree domains in v1.

### 2. Queue namespace `innisfreeUs.*` (locked)

Mirror Soko Glam / Jolse queue set:

```ts
innisfreeUs.sellerCategoryHierarchy
innisfreeUs.sellerCategoryMapping
innisfreeUs.categoryProducts
innisfreeUs.sitemapProducts
innisfreeUs.product
innisfreeUs.productPdp
```

Worker concurrency: **`innisfreeUs.product` and `innisfreeUs.productPdp` at 1** initially.

### 3. `Product.sku` = Shopify product `handle` (proposed — confirm in spike)

Extract from:

- Sitemap PDP loc: `/products/{handle}` (skip root `/` loc)
- Collection JSON: `product.handle`
- Product JSON: `product.handle`

**Rationale:** PDP URLs are handle-based; `buildSellerProductPageUrl` can use `https://us.innisfree.com/products/{{sku}}`.

### 4. One `Product` row per Shopify product, not per variant (proposed)

- Upsert **one** commerce `Product` per Shopify parent product (`handle`).
- **Price** on `seller_product_prices`: **minimum** `variant.price` among **available** variants.
- Store variant count / option summary in listing specs if useful (`IFU Variant count`, `IFU Options`).
- **Defer** per-variant rows unless cards show wrong prices for multi-variant SKUs.

### 5. `Seller.productUrlTemplate` (proposed)

```text
https://us.innisfree.com/products/{{sku}}
```

where `{{sku}}` is the product `handle`.

### 6. Brand = `Innisfree` always (proposed)

- Map Shopify `vendor` → `brands.name` (`Innisfree`).
- Spike should confirm no third-party marketplace SKUs appear in the US catalog.
- No special “force brand” bypass needed if `vendor` is consistently `Innisfree`.

### 7. Listing before PDP (locked)

**Phase A** — sitemap + collection JSON → `upsertProductFromInnisfreeUsHit` (brand, product, seller_product, price, listing specs from product JSON).

**Phase B** — `innisfreeUs.productPdp` enrichment for `body_html`, tags, images once listing is stable.

Because Shopify `.json` returns rich PDP fields, Phase A jobs should fetch product JSON (not sitemap-only stubs) unless queue pressure requires a two-step split.

### 8. HTTP client reuse + Innisfree host rules (locked)

Extend `src/lib/httpClient.ts`:

- `INNISFREE_US_REQUEST_DELAY_MS` throttle for `us.innisfree.com`
- `INNISFREE_US_BROWSER_COOKIE` optional cookie injection
- Chrome desktop UA substitution when `SCRAPER_USER_AGENT` is the default bot string
- JSON GET via shared `fetchJson` / `shopify/` fetch helpers

Default throttle ≥ **700ms** (tune in spike).

### 9. Sitemap-first ingest with collection enrichment (proposed)

1. **Product sitemap walk** — parse `sitemap_products_1.xml` (follow full loc including `?from=&to=`); filter `/products/{handle}`; skip homepage `/`.
2. **Collection discovery** — parse `sitemap_collections_1.xml` → `seller_categories` rows.
3. **Category products job** — paginate `GET /collections/{handle}/products.json?limit=250&page=N`.

**Priority:** sitemap jobs > collection listing jobs (`innisfreeUsProductIngestPriorities` mirroring Soko Glam).

### 10. Collection hierarchy — flat v1 (proposed)

Shopify collection sitemaps do not expose parent/child trees. v1: flat `seller_categories` with `parentSellerCategoryId = null` unless spike documents a reliable nav-based parent map.

### 11. Spec prefix `IFU ` (proposed)

PDP-derived specs use prefix **`IFU `** (e.g. `IFU Thumbnail URL`, `IFU Description`, `IFU Product type`, `IFU Tags`) — mirror `SG ` / `JL ` conventions.

### 12. Collection exclude list (proposed — confirm in spike)

Likely exclude non-merchandising collections (gift cards, checkout helpers, empty marketing shells). Env knob `INNISFREE_US_COLLECTION_EXCLUDE_REGEX` with defaults documented in spike.

---

## Phase 0 — Spike (gate before bulk ingest)

**Deliverable:** `commerce-platform-scrapers/docs/innisfreeUsSpike.md` (same shape as `sokoGlamSpike.md` / `jolseSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://us.innisfree.com/` and record friction.
2. Confirm product sitemap walk from Node; count PDP URLs; verify child sitemap URLs with query params fetch correctly.
3. Lock regex for `handle` extraction from sitemap loc and collection/product JSON.
4. Enumerate collections from sitemap; propose exclude list.
5. From one collection (`green-tea`, pages 1–2) and one multi-variant PDP JSON, capture name, brand, min price, compare-at, thumbnail, availability, pagination termination.
6. Confirm **single-brand** assumption (`vendor` always `Innisfree`).
7. Test Chrome UA + optional cookie from production scraper hosts.
8. Lock `productUrlTemplate`, `Product.sku` field, variant pricing rule, JSON field mapping.
9. Note review widget presence — defer review ingest unless spike finds stable public endpoint.
10. Document 429/403 behavior and recommended `INNISFREE_US_REQUEST_DELAY_MS`.

**Debug script (add in spike PR):** `scripts/debugInnisfreeUsUrls.ts` — sample handles from product sitemap + one collection `products.json` page without DB writes.

**Early spike observations (June 2026 — replace with spike doc):**

- Sitemap + product/collection JSON: **200 OK** from Node `curl` with Chrome UA.
- ~**126** product PDPs, ~**76** collections.
- `GET /products/green-tea-seed-hyaluronic-serum.json` returns **3** variants, `vendor: Innisfree`.
- `GET /collections/green-tea/products.json?limit=5` returns products.
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
| `sellers` | **INSERT** row: `name = 'Innisfree US'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = `https://us.innisfree.com/products/{{sku}}` |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / Innisfree US'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_73_innisfree_us_seller_and_staging_category`

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs an Innisfree-specific branch after PDP specs exist.

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `INNISFREE_US_SELLER_NAME`, `INNISFREE_US_STAGING_PRODUCT_CATEGORY_NAME`, `INNISFREE_US_SITE_BASE_URL`, `INNISFREE_US_SITEMAP_INDEX_URL`, throttle knobs, optional cookie, collection page size, collection exclude regex |
| Entity resolvers | `ensureCommerceEntities.ts` — `findInnisfreeUsSeller`, `findStagingProductCategoryForInnisfreeUs` |
| Constants | `src/scrapers/innisfreeUs/innisfreeUsConstants.ts` — spec prefix `IFU `, default collection exclude regex |
| **Shopify platform** | Reuse `src/scrapers/shopify/*` from ALE-58 — **no** `INNISFREE_US_*` imports inside `shopify/` |
| Innisfree adapters | `src/scrapers/innisfreeUs/*` — upsert, spec mapping, thin job glue |
| Queue names | `queueNames.ts` — `innisfreeUsQueueNames`, `innisfreeUsProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; stub `productPdp` worker OK initially |
| HTTP client | `httpClient.ts` — throttle, cookie, UA override for `us.innisfree.com` |
| HTTP routes | `server.ts` — `POST /jobs/innisfree-us/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products`, `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Add `https://us.innisfree.com/` to `scripts/probeRetailerStorefronts.ts` default URL list |
| `.env.example` | Document all new knobs |

---

## Phase 3 — Listing ingest

Implement after spike doc is approved and `shopify/` module is available.

| Component | Location | Purpose |
|-----------|----------|---------|
| Sitemap / JSON collectors | **`shopify/`** (reuse) | Walk sitemap; fetch product/collection JSON |
| `discoverInnisfreeUsSellerCategoryNodes.ts` | `innisfreeUs/` | Job glue + collection exclude regex → `seller_categories` |
| `summarizeInnisfreeUsListingFields.ts` | `innisfreeUs/` | Typed summary for upsert |
| `upsertProductFromInnisfreeUsHit.ts` | `innisfreeUs/` | Single DB choke point |
| Jobs | `innisfreeUs/jobs/` | hierarchy, mapping, categoryProducts, sitemapProducts, product — thin; pass `siteBaseUrl` into `shopify/` |
| `scrapeProduct.ts` worker | `innisfreeUs/jobs/` | concurrency **1**; `P2002`-aware |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/innisfree-us/seller-category-hierarchy
# POST /jobs/innisfree-us/sitemap-products  { "maxProducts": 20 }
# POST /jobs/innisfree-us/category-products  { "maxSellerCategories": 1 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from sitemap smoke; `seller_products` + `seller_product_prices` rows visible for `Innisfree US`; `buildSellerProductPageUrl` returns valid `us.innisfree.com` links.

---

## Phase 4 — PDP + spec enrichment

| Component | Location | Purpose |
|-----------|----------|---------|
| `mapShopifyProductJsonToPdpFields.ts` | **`shopify/`** (reuse) | Neutral PDP field struct |
| `mapInnisfreeUsProductJsonToSpecRows.ts` | `innisfreeUs/` | Wraps shared PDP fields → `ProductSellerSpec` rows with **`IFU `** prefix |
| `enrichProductPdp.ts` job | `innisfreeUs/jobs/` | Re-fetch product JSON; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | `innisfreeUs/jobs/` | Keyset batch → `addBulk` |
| Reviews | — | **Optional v1** |

---

## Phase 5 — Docs + roadmap + backend follow-ups

| Task | Location |
|------|----------|
| Spike notes | `docs/innisfreeUsSpike.md` |
| Roadmap | `docs/kBeautyRetailerRoadmap.md` — add **Brand storefronts** subsection or row for Innisfree US |
| Playbook | Cross-link from `retailerScrapingPlaybook.md` Shopify subsection (from ALE-58) |
| Queue hygiene script | `scripts/innisfreeUsProductQueue.ts` (optional) |
| Thumbnails | `getProductThumbnailUrl` — `images[0].src` from `IFU Thumbnail URL` spec or Shopify CDN fallback |

---

## Test plan

### Scrapers

- Reuse / extend unit tests under **`src/scrapers/shopify/`** (fixtures from Soko Glam or Innisfree spike).
- Unit test for `upsertProductFromInnisfreeUsHit` with mocked prisma.
- Manual: sitemap smoke 20 products; verify Bull Board; query DB for seller name + URL template.
- Full-catalog smoke is cheap (~126 SKUs) — optional end-to-end ingest in dev.

### Backend

- Manually verify seller row after migrate.
- Optional: unit test `buildSellerProductPageUrl` with Innisfree US template + sample handle.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build`

---

## Risks

| Risk | Mitigation |
|------|------------|
| ALE-58 `shopify/` not landed yet | Sequence work; extract shared module once; avoid duplicate parsers |
| Cloudflare tightens bot rules | Chrome UA + optional cookie; Playwright only if JSON blocked |
| Sitemap child URLs with query params | Fetch full `<loc>` verbatim in shared sitemap walker |
| Multi-variant pricing on cards | Min available variant price; spike multi-variant PDP |
| `handle` changes break old SKUs | Rare; monitor 404 on JSON fetch; optional `IFU Shopify product id` spec |
| Collection sitemap noise | Exclude regex in env |
| SKU collision with another retailer | Handles are retailer-specific; monitor uniqueness in smoke |
| Single-brand assumption breaks | Spike scans vendor field across catalog |
| Architect rejects seed timing | Spike + doc review before DDL |

---

## Implementation TODO

- [x] **Phase 0:** Complete spike; write `docs/innisfreeUsSpike.md`; add `debugInnisfreeUsUrls.ts`
- [x] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, variant pricing rule, collection exclude list
- [x] **Prerequisite:** ALE-58 `src/scrapers/shopify/` platform layer available (on `origin/main`)
- [x] **Phase 1:** Apply migration; `db:pull` in scrapers
- [x] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [x] **Phase 2:** `innisfreeUs/` upsert + constants + job wiring calling `shopify/`
- [x] **Phase 3:** Sitemap + collection JSON ingest + `upsertProductFromInnisfreeUsHit`; smoke ingest (5 products in isolated worktree)
- [ ] **Phase 3:** Unit tests for upsert (when fixtures exist)
- [ ] **Phase 4:** PDP enrichment job + spec mapping + enqueue-all routes
- [ ] **Phase 4:** Unit tests for PDP mappers (when fixtures exist)
- [ ] **Phase 5:** Update `kBeautyRetailerRoadmap.md` and playbook cross-link
- [ ] **Follow-up:** Thumbnail resolver fallback after ingest (if needed)
