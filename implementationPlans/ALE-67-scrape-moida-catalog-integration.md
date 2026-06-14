# ALE-67 Scrape Moida catalog integration

## Context

[Linear ALE-67](https://linear.app/dewly/issue/ALE-67/scrape-moida-catalog-integration): add a **full retailer integration** for **Moida** (formerly **Blooming Koco**), a US-based K-beauty specialist and sister brand to StyleKorean.

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook (same BullMQ + upsert shape as other retailers).

**Branch:** `ALE-67-scrape-moida-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — Moida not yet listed; add when work starts.
- [ALE-58](ALE-58-scrape-soko-glam-catalog-integration.md) — **first Shopify retailer**; defines shared `src/scrapers/shopify/*` platform layer. ALE-67 should reuse that layer when merged; if ALE-58 is not yet shipped, implement `shopify/` as part of ALE-67 (Moida becomes reference impl) or land ALE-58 first.
- StyleKorean (`styleKorean.*`) — business sister site, but **not** the same storefront stack (StyleKorean is Gnuboard HTML; Moida is Shopify JSON).

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

**Critical spike correction (June 2026):** The Linear ticket originally cited `https://www.moida.co/`. That domain is a **Squarespace photography/media site** (sports, portfolio) — **not** the K-beauty store. The US commerce storefront is **`https://moidaus.com/`** (Shopify). `bloomingkoco.com` and `www.bloomingkoco.com` **301** to `moidaus.com`. Lock all scraper env and `productUrlTemplate` on **`moidaus.com`**.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `Moida` as its own `sellers` row with US `productUrlTemplate` on `moidaus.com` |
| Listing ingest | Discover SKUs via product sitemaps + collection JSON; persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs from Shopify product JSON (`body_html`, `tags`, `product_type`, images) |
| Operations | BullMQ namespace `moida.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Shopify reuse | Prefer shared `src/scrapers/shopify/*` from ALE-58; thin `src/scrapers/moida/*` for jobs, upsert, spec prefix |
| Roadmap | Add Moida row to `kBeautyRetailerRoadmap.md`; move Planned → In progress → Done |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges.
- Frontend changes.
- Non-US Shopify markets (`/es/` locale sitemaps, `moida.co.uk`) — ingest **US** (`moidaus.com`, `localization=US`) only.
- Full taxonomy unification beyond staging category.
- Shopify **UCP/MCP** agent checkout APIs (`/api/ucp/mcp`, `agents.md`) — catalog-only HTTP JSON is sufficient for scrapers.
- Per-variant `Product` rows unless spike proves parent-product pricing is unusable for cards.
- Scraping `www.moida.co` (wrong domain).

---

## Current state

### Moida US storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **Shopify** (`shopify-complexity-score`, `cdn.shopify.com`, theme assets on `moidaus.com/cdn/shop/`) |
| CDN / edge | **Cloudflare** (`cf-ray`, `cf-cache-status`); anonymous GETs return **200** for sitemap and JSON |
| Legacy domain | `bloomingkoco.com` → **301** `https://moidaus.com/` (`primary_domain_redirection`) |
| Wrong domain | `www.moida.co` → **Squarespace** (`server: Squarespace`); ~71 sitemap URLs, no `/products/` — **do not scrape** |
| Canonical host | **`https://moidaus.com`** (no `www` redirect observed on apex) |
| Sitemap index | `https://moidaus.com/sitemap.xml` → `sitemap_products_1.xml`, `sitemap_products_2.xml`, `sitemap_collections_1.xml`, pages, blogs, `sitemap_agentic_discovery.xml` |
| Product catalog size | ~**2,674** PDP `<loc>` entries (`sitemap_products_1`: ~2,616 + `sitemap_products_2`: ~58) |
| Collection catalog size | ~**797** collection URLs in `sitemap_collections_1.xml` |
| Locale sitemaps | `/es/sitemap_products_*.xml` present — **ignore for US v1** |
| Product URLs | `/products/{handle}` e.g. `/products/banila-co-clean-it-zero-cleansing-balm-original` |
| Collection URLs | `/collections/{handle}` e.g. `/collections/benton`, `/collections/cream` |
| Product JSON | `GET /products/{handle}.json` → `{ product: { id, title, vendor, product_type, tags, variants[], images[], body_html, … } }` — **200** from Node |
| Collection JSON | `GET /collections/all/products.json?limit=5` — **200**; `limit=250` expected to work (confirm in spike) |
| Variants | Mix of single-variant and multi-variant products; `vendor` maps to brand (e.g. `Banila co`, `COSRX`) |
| Currency | USD (`cart_currency=USD`, `localization=US` cookies on homepage) |
| Bot policy | `robots.txt` allows `/`; documents UCP/MCP — scrapers use public JSON only |

**Implication:** Moida is a **Shopify JSON + sitemap** integration — same shape as [ALE-58 Soko Glam](ALE-58-scrape-soko-glam-catalog-integration.md), not StyleKorean. Catalog is **~3× larger** than Soko Glam (~2,674 vs ~803 SKUs); plan for longer backfill and conservative worker concurrency.

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| Jolse | `jolse.*` | Gzip product sitemaps + category HTML | `upsertProductFromJolseHit` |
| YesStyle | `yesStyle.*` | Category sitemap + HTML (blocked by default) | `upsertProductFromYesStyleHit` |
| Soko Glam (planned ALE-58) | `sokoGlam.*` | Product sitemap + collection JSON | `upsertProductFromSokoGlamHit` |

Moida should follow the **Soko Glam / Shopify** queue topology with Moida-specific env, upsert, and spec prefix.

`queueNames.ts` today has no `moida.*` or `shopify/` helpers yet.

### Backend card links

Moida will be **`linkable = true`** (default). Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | Moida target (ALE-67) |
|------|-------|------------------------|
| `sellers` row | None | **`Moida`** + US `productUrlTemplate` on `moidaus.com` |
| Staging category | None | **`Staging taxonomy / Moida`** |
| SKU key | N/A | Shopify product **`handle`** (slug string) — proposed |
| Listing discovery | N/A | Product sitemaps (2 children) + `collections/{handle}/products.json` |
| Fetch layer | No Shopify helpers (unless ALE-58 merged) | Shared **`src/scrapers/shopify/*`** + thin **`src/scrapers/moida/*`** |
| Queue namespace | N/A | **`moida.*`** |
| HTTP client | No `moidaus.com` host rules | Throttle + optional cookie + UA override (Cloudflare) |

---

## Design decisions

### 1. US storefront only, canonical base `https://moidaus.com` (locked in spike)

- Standardize env `MOIDA_SITE_BASE_URL` on **`https://moidaus.com`**.
- Do **not** use `www.moida.co` or `moida.co.uk` for US ingest.
- `bloomingkoco.com` redirects are informational only; cards and scrapers use `moidaus.com` template.

### 2. Queue namespace `moida.*` (locked)

Mirror Soko Glam / StyleKorean queue set:

```ts
moida.sellerCategoryHierarchy
moida.sellerCategoryMapping
moida.categoryProducts
moida.sitemapProducts
moida.product
moida.productPdp
```

Worker concurrency: **`moida.product` and `moida.productPdp` at 1** initially (large catalog).

### 3. `Product.sku` = Shopify product `handle` (proposed — confirm in spike)

Extract from:

- Sitemap PDP loc: `/products/{handle}`
- Collection JSON: `product.handle`
- Product JSON: `product.handle`

**Rationale:** PDP URLs are handle-based; `buildSellerProductPageUrl` can use `https://moidaus.com/products/{{sku}}` without storing numeric Shopify ids.

**Do not** use numeric `product.id` as `Product.sku` unless spike finds handle collisions or churn.

### 4. One `Product` row per Shopify product, not per variant (proposed)

- Upsert **one** commerce `Product` per Shopify parent product (`handle`).
- **Price** on `seller_product_prices`: use the **minimum** `variant.price` among **available** variants.
- Store variant count / option summary in listing specs if useful (`MO Variant count`, `MO Options`).
- **Defer** YesStyle-style per-variant rows unless product cards show wrong prices for multi-variant SKUs.

### 5. `Seller.productUrlTemplate` (proposed)

```text
https://moidaus.com/products/{{sku}}
```

where `{{sku}}` is the product `handle`.

### 6. Listing before PDP (locked)

**Phase A** — sitemap + collection JSON → `upsertProductFromMoidaHit` (brand, product, seller_product, price, listing specs from product JSON).

**Phase B** — `moida.productPdp` enrichment for `body_html` flattening, tags, images once listing is stable.

Because Shopify `.json` returns rich PDP fields, Phase A jobs should fetch product JSON (not sitemap-only stubs) unless queue pressure requires id-only → enrich split.

### 7. HTTP client + Moida host rules (locked)

Extend `src/lib/httpClient.ts`:

- `MOIDA_REQUEST_DELAY_MS` throttle for `*.moidaus.com`
- `MOIDA_BROWSER_COOKIE` optional cookie injection
- Chrome desktop UA substitution when `SCRAPER_USER_AGENT` is the default bot string
- JSON GET helper for `.json` endpoints

Default throttle ≥ **700ms** (tune in spike; large catalog favors polite pacing).

### 8. Sitemap-first ingest with collection enrichment (proposed)

1. **Product sitemap walk** — parse `sitemap.xml` index; fetch **both** `sitemap_products_1.xml` and `sitemap_products_2.xml` (query params required); filter `<loc>` matching `/products/{handle}`; skip root `/` loc and gift-card paths if excluded.
2. **Collection discovery** — parse `sitemap_collections_1.xml` → `seller_categories` rows. Filter non-merchandising collections (`gift-cards`, checkout helpers) via spike exclude regex.
3. **Category products job** — paginate `GET /collections/{handle}/products.json?limit=250&page=N` to refresh price, brand, name, thumbnail.

**Priority:** sitemap jobs ≥ collection listing jobs (`moidaProductIngestPriorities` mirroring Soko Glam).

### 9. Collection hierarchy — flat v1 (proposed)

Shopify collection sitemaps do not expose parent/child trees. v1:

- `sellerCategoryHierarchy` seeds flat `seller_categories` from collections sitemap.
- `parentSellerCategoryId = null` unless spike documents a reliable nav-based parent map.

### 10. Spec prefix `MO ` (proposed)

PDP-derived specs use prefix **`MO `** (e.g. `MO Thumbnail URL`, `MO Description`, `MO Product type`, `MO Tags`) for manual curation batches — mirror `SG ` / `JL ` / `SK ` conventions.

### 11. Shared Shopify platform layer (dependency on ALE-58)

Reuse `src/scrapers/shopify/*` as defined in [ALE-58 §11](ALE-58-scrape-soko-glam-catalog-integration.md#11-shared-shopify-platform-layer-locked-intent):

- **If ALE-58 merged:** Moida adds only `src/scrapers/moida/*` jobs, upsert, constants, routes.
- **If ALE-58 not merged:** Implement `shopify/` in ALE-67 (or coordinate landing ALE-58 first) — **do not** duplicate JSON/sitemap parsers in `moida/` only.

**Stays in `src/scrapers/moida/` (not shared):**

```text
moidaConstants.ts
summarizeMoidaListingFields.ts
upsertProductFromMoidaHit.ts
mapMoidaProductJsonToSpecRows.ts   # applies MO prefix
jobs/*
```

---

## Phase 0 — Spike (gate before bulk ingest)

**Deliverable:** `commerce-platform-scrapers/docs/moidaSpike.md` (same shape as `jolseSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://moidaus.com/` (with backend env) and record friction.
2. Confirm product sitemap walk end-to-end from Node for **both** `sitemap_products_*.xml` children; lock product count (~2,674).
3. Lock regex for `handle` extraction from sitemap loc and collection/product JSON.
4. Enumerate collections from sitemap (~797); propose exclude list (`gift-cards`, marketing-only, empty collections).
5. From one collection (`collections/all` or `cream`, pages 1–2) and one multi-variant PDP JSON, capture:
   - product name, brand (`vendor`), min price, compare-at price, thumbnail, availability
   - pagination termination (`products.json` empty page vs partial page); confirm `limit=250`
6. Decide parent product vs per-variant `Product` rows (default: parent product).
7. Test Chrome UA + optional cookie from production scraper hosts (no Playwright).
8. Lock `productUrlTemplate`, `Product.sku` field, and JSON field mapping.
9. Note review widget presence — defer review ingest unless spike finds stable public endpoint.
10. Document 429/403 behavior and recommended `MOIDA_REQUEST_DELAY_MS`.
11. Confirm `www.moida.co` is out of scope; document redirect chain from `bloomingkoco.com`.
12. Skim `https://moidaus.com/agents.md` — document UCP/MCP for future; **do not** depend on it for v1 scrapers.

**Debug script (add in spike PR):** `scripts/debugMoidaUrls.ts` — prints sample handles from product sitemaps + one collection `products.json` page without DB writes.

**Early spike observations (June 2026 — replace with spike doc):**

- `moidaus.com` sitemap + product/collection JSON: **200 OK** from Node curl with Chrome UA.
- ~**2,674** product URLs across 2 product sitemaps; ~**797** collections.
- `GET /products/banila-co-clean-it-zero-cleansing-balm-original.json` returns vendor, price, variants — **200 OK**.
- `GET /collections/all/products.json?limit=5` — **200 OK**.
- `www.moida.co`: Squarespace, no product catalog — **wrong storefront**.
- `bloomingkoco.com` → **301** `moidaus.com`.

---

## Phase 1 — Backend migration + seed data

**Repo:** `commerce-platform-backend`  
**Requires architect approval** before `prisma migrate dev`.

### Schema change

**None** — reuse existing `sellers`, `product_categories`, `currencies` tables.

### Data changes (migration SQL)

| Table | Action |
|-------|--------|
| `sellers` | **INSERT** row: `name = 'Moida'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = `https://moidaus.com/products/{{sku}}` |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / Moida'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_67_moida_seller_and_staging_category`

Pattern: mirror [ALE-56 Jolse migration](commerce-platform-backend/prisma/migrations/20260611220000_ale_56_jolse_seller_and_staging_category/migration.sql) — `setval` on sequences, `INSERT … WHERE NOT EXISTS` for seller + staging category.

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs a Moida-specific branch after PDP specs exist (see Phase 5).

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `MOIDA_SELLER_NAME`, `MOIDA_STAGING_PRODUCT_CATEGORY_NAME`, `MOIDA_SITE_BASE_URL`, `MOIDA_SITEMAP_INDEX_URL`, throttle knobs, optional cookie, `MOIDA_COLLECTION_PRODUCTS_PAGE_SIZE` (default 250), collection exclude regex |
| Entity resolvers | `ensureCommerceEntities.ts` — `findMoidaSeller`, `findStagingProductCategoryForMoida` |
| Constants | `src/scrapers/moida/moidaConstants.ts` — spec prefix `MO `, default collection exclude regex |
| **Shopify platform** | `src/scrapers/shopify/*` per ALE-58 — reuse or implement once |
| Moida adapters | `src/scrapers/moida/*` — jobs, upsert, spec mapping |
| Queue names | `queueNames.ts` — `moidaQueueNames`, `moidaProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; stub `productPdp` worker OK initially |
| HTTP client | `httpClient.ts` — throttle, cookie, UA override for `moidaus.com` |
| HTTP routes | `server.ts` — `POST /jobs/moida/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products`, `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Add `https://moidaus.com/` to `scripts/probeRetailerStorefronts.ts` default URL list |
| `.env.example` | Document all new knobs |

---

## Phase 3 — Listing ingest

Implement after spike doc is approved.

| Component | Location | Purpose |
|-----------|----------|---------|
| `collectProductHandlesFromSitemaps.ts` | **`shopify/`** | Walk sitemap index; parse all `sitemap_products_*.xml`; extract handles |
| `collectCollectionHandlesFromSitemaps.ts` | **`shopify/`** | Parse `sitemap_collections_*.xml` → collection handles |
| `fetchShopifyCollectionProductsPage.ts` | **`shopify/`** | Paginated `products.json` for a collection handle |
| `mapShopifyProductJsonToListingFields.ts` | **`shopify/`** | Neutral listing fields (name, vendor, min price, image, handle) |
| `discoverMoidaSellerCategoryNodes.ts` | `moida/` | Job glue: `shopify/` collectors + Moida exclude regex → `seller_categories` |
| `summarizeMoidaListingFields.ts` | `moida/` | Typed summary for upsert |
| `upsertProductFromMoidaHit.ts` | `moida/` | Single DB choke point (mirror `upsertProductFromSokoGlamHit`) |
| Jobs | `moida/jobs/` | `sellerCategoryHierarchy`, `sellerCategoryMapping`, `scrapeCategoryProducts`, `scrapeSitemapProducts`, `scrapeProduct` |
| `scrapeProduct.ts` worker | `moida/jobs/` | `fetchShopifyProductJson` → map → upsert; concurrency **1** |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/moida/seller-category-hierarchy
# POST /jobs/moida/sitemap-products  { "maxProducts": 20 }
# POST /jobs/moida/category-products  { "maxSellerCategories": 1 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from sitemap smoke; `seller_products` + `seller_product_prices` rows visible for `Moida`; `buildSellerProductPageUrl` returns valid `moidaus.com` links for smoke handles.

**Full catalog note:** ~2,674 SKUs — full backfill will take hours at concurrency 1; use `SCRAPE_MAX_SITEMAP_PRODUCTS` / env caps during dev.

---

## Phase 4 — PDP + spec enrichment

| Component | Location | Purpose |
|-----------|----------|---------|
| `mapShopifyProductJsonToPdpFields.ts` | **`shopify/`** | Neutral PDP fields (`body_html`, tags, images) |
| `mapMoidaProductJsonToSpecRows.ts` | `moida/` | `ProductSellerSpec` rows; prefix **`MO `** |
| `enrichProductPdp.ts` job | `moida/jobs/` | One job per handle; concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | `moida/jobs/` | Keyset batch from Postgres → `addBulk` |
| Reviews | — | **Optional v1** — only if spike finds stable widget/API |

---

## Phase 5 — Docs + roadmap + backend follow-ups

| Task | Location |
|------|----------|
| Spike notes | `docs/moidaSpike.md` |
| Roadmap row | `docs/kBeautyRetailerRoadmap.md` — add Moida (priority TBD); Planned → In progress → Done |
| Playbook cross-link | Note Moida as second Shopify example if `shopify/` layer exists |
| Queue hygiene script | `scripts/moidaProductQueue.ts` (optional; copy Soko Glam / Jolse script) |
| Thumbnails | `getProductThumbnailUrl` — `images[0].src` / `MO Thumbnail URL` fallback after PDP ingest |
| Linear ticket | Correct storefront URL to `moidaus.com` (done in ticket description) |

---

## Test plan

### Scrapers

- Unit tests for handle extraction and listing field mappers with **fixture JSON/XML** from spike.
- Unit tests on shared `shopify/` parsers (if introduced in this ticket).
- Unit test for `upsertProductFromMoidaHit` with mocked prisma (match Jolse/Soko Glam test style if present).
- Manual: sitemap smoke 20+ products; verify Bull Board completion; query DB for seller name + URL template.

### Backend

- No migration logic tests required beyond existing patterns; manually verify seller row after migrate.
- Optional: unit test `buildSellerProductPageUrl` with Moida template + sample handle.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build` (includes `prisma generate`)

---

## Risks

| Risk | Mitigation |
|------|------------|
| Wrong storefront URL (`moida.co`) | Locked on `moidaus.com` in spike + plan; ticket description updated |
| ALE-58 `shopify/` not merged | Coordinate with ALE-58 or implement shared layer once in ALE-67 |
| Large catalog (~2,674 SKUs) | Concurrency 1; env caps; bulk PDP enqueue with keyset pagination |
| Cloudflare blocks datacenter JSON | Chrome UA + optional cookie; probe from prod-like host in spike |
| Multi-variant price on cards | Min available variant price; spike multi-variant PDP |
| `/es/` locale pollution | Filter sitemap locs to host `moidaus.com` paths without `/es/` prefix |
| Handle changes break links | Handles are stable on Shopify; monitor in smoke |
| SKU collision with another retailer | Handles are retailer-specific strings; monitor uniqueness in smoke |
| Architect rejects seed timing | Spike + doc review before DDL |
| StyleKorean confusion | Document business vs technical stack difference in spike doc |

---

## Implementation TODO

- [x] **Phase 0:** Complete spike; write `docs/moidaSpike.md`; add `debugMoidaUrls.ts` *(spike doc pending; debug script done)*
- [x] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, collection exclude list, and JSON field mapping in spike doc *(locked in plan + code)*
- [x] **Phase 0:** Confirm ALE-58 `shopify/` layer availability; reuse from main (`shopify/` + Soko Glam/Wishtrend)*
- [ ] **Phase 0:** Paginate `collections/all/products.json` to estimate unique handle count vs sitemap
- [x] **Phase 1:** Apply migration locally (`20260612120000_ale_67_moida_seller_and_staging_category`); architect approval still required for prod
- [ ] **Phase 1:** `db:pull` in scrapers worktree (optional if schema unchanged)
- [x] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [x] **Phase 2:** `moida/` jobs wired; probe script updated
- [x] **Phase 3:** Sitemap + `upsertProductFromMoidaHit`; smoke ingest (5 products verified on port 3197)
- [ ] **Phase 3:** Unit tests for mappers/upsert
- [x] **Phase 4:** PDP enrichment job + spec mapping + enqueue-all routes
- [ ] **Phase 4:** Unit tests for PDP mappers
- [ ] **Phase 5:** Update `kBeautyRetailerRoadmap.md` and playbook cross-links
- [ ] **Follow-up:** Thumbnail fallback in `getProductThumbnailUrl` after ingest (if needed)
