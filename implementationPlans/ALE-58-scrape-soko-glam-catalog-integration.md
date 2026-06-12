# ALE-58 Scrape Soko Glam catalog integration

## Context

[Linear ALE-58](https://linear.app/dewly/issue/ALE-58/scrape-soko-glam-catalog-integration): add a **full retailer integration** for [Soko Glam](https://sokoglam.com/) (priority **6** on the K-beauty retailer roadmap).

**Goal:** Spike → implement listing ingest, PDP enrichment, and spec persistence following the retailer scraping playbook (same BullMQ + upsert shape as StyleKorean / Jolse).

**Branch:** `ALE-58-scrape-soko-glam-catalog-integration` (backend migration for seller seed + scrapers work; matching branches in each affected repo).

**Related work:**

- `commerce-platform-scrapers/docs/retailerScrapingPlaybook.md` — architecture to copy.
- `commerce-platform-scrapers/docs/kBeautyRetailerRoadmap.md` — Soko Glam row (currently **Planned**).
- [ALE-56](ALE-56-scrape-jolse-catalog-integration.md) — recent full integration (sitemap + category listing + PDP).
- [ALE-57](ALE-57-scrape-stylevana-catalog-integration.md) — parallel planned retailer (Magento + Cloudflare).

**Database changes:** Yes — **seed data only** (new `sellers` row + staging `product_categories` row). **No new columns.** Architect approval required before applying migration.

**Platform note:** Soko Glam is the **first Shopify storefront** in `commerce-platform-scrapers`. Unlike Cafe24/Magento retailers, Shopify exposes **public JSON** endpoints (`/products/{handle}.json`, `/collections/{handle}/products.json`) that are reachable from datacenter `curl` — prefer JSON over HTML parsing for v1.

**Reuse note:** ALE-58 should introduce a **shared Shopify platform layer** under `src/scrapers/shopify/` so the next Shopify retailer (roadmap candidates: **Wishtrend**, **RoseRoseShop**, parts of other K-beauty shops) can plug in with mostly env + upsert + queue wiring — not a second copy of sitemap/JSON logic. See [Shared Shopify platform layer](#shared-shopify-platform-layer) below.

---

## Goals

| Goal | Detail |
|------|--------|
| New seller | `Soko Glam` as its own `sellers` row with US `productUrlTemplate` |
| Listing ingest | Discover SKUs via product sitemap + collection JSON; persist `products`, `seller_products`, `seller_product_prices`, listing facet specs |
| PDP enrichment | Structured specs from Shopify product JSON (`body_html`, `tags`, `product_type`, images) — can share fetch with listing when using `.json` |
| Operations | BullMQ namespace `sokoGlam.*`, HTTP enqueue routes, env knobs, spike/debug scripts |
| Shared Shopify layer | Reusable `src/scrapers/shopify/*` for sitemap walk, JSON fetch, listing/PDP field mapping — parameterized by `siteBaseUrl`, not Soko-Glam-specific |
| Roadmap | Move Soko Glam from **Planned** → **Done** in `kBeautyRetailerRoadmap.md` |

**Out of scope (v1):**

- Cross-retailer product dedupe / `ProductMatchCandidate` merges.
- Frontend changes.
- Non-US Shopify markets / localized storefront paths (`/en-ca/`, etc.) — ingest **US** (`sokoglam.com`, `localization=US`) only.
- Full taxonomy unification beyond staging category.
- Shopify **UCP/MCP** agent checkout APIs (`/api/ucp/mcp`, `agents.md`) — catalog-only HTTP JSON is sufficient for scrapers.
- Per-variant `Product` rows (YesStyle-style) unless spike proves parent-product pricing is unusable for cards.

---

## Current state

### Soko Glam storefront (spike signals — June 2026)

| Signal | Finding |
|--------|---------|
| Stack | **Shopify** (`powered-by: Shopify`, shop id `2491218`, theme id `147741245509`) |
| CDN | `cdn.shopify.com` for product media; storefront assets on `sokoglam.com/cdn/shop/` |
| Bot wall | **Cloudflare** (`cf-ray`, `server: cloudflare`); anonymous GETs return **200** for sitemap, collection pages, and JSON endpoints |
| Canonical host | `www.sokoglam.com` **301** → `https://sokoglam.com/` (`x-redirect-reason: canonical_host_redirection`) |
| Sitemap index | `https://sokoglam.com/sitemap.xml` → `sitemap_products_1.xml`, `sitemap_collections_1.xml`, pages, blogs, `sitemap_agentic_discovery.xml` |
| Product catalog size | ~**803** PDP `<loc>` entries in `sitemap_products_1.xml` (single child urlset today) |
| Collection catalog size | ~**279** collection URLs in `sitemap_collections_1.xml` |
| Product URLs | `/products/{handle}` e.g. `/products/missha-perfect-cover-bb-cream-spf-42-pa-1` |
| Collection URLs | `/collections/{handle}` e.g. `/collections/skincare`, `/collections/pore-care` |
| Product JSON | `GET /products/{handle}.json` → `{ product: { id, title, vendor, product_type, tags, variants[], images[], body_html, … } }` — **200** from Node |
| Collection JSON | `GET /collections/{handle}/products.json?limit=250&page=N` → paginated product summaries — **200**; `limit=250` works |
| Variants | Multi-shade products common (e.g. Missha BB cream: **5** variants with distinct `variant.sku` barcodes); default-title single-variant products also exist |
| Brand field | Shopify `vendor` maps cleanly to our `brands.name` (e.g. `MISSHA`, `IOPE`) |
| Currency | USD (`cart_currency=USD`, `price_currency` on variants) |

**Implication:** Soko Glam is a strong fit for a **Shopify JSON + sitemap** integration — simpler than HTML-only retailers. Reuse the **queue topology** from StyleKorean/Jolse, but replace HTML listing parsers with shared Shopify `.json` fetchers. Treat Soko Glam as the **reference implementation** that proves the shared `shopify/` module; avoid baking `sokoglam.com` into shared helpers.

### Existing retailer integrations (templates)

| Retailer | Namespace | Primary discovery | Upsert choke point |
|----------|-----------|-------------------|-------------------|
| Olive Young Global | `oliveYoung.*` | Ranking API + sitemap | `upsertProductFromOliveYoungHit` |
| Olive Young US | `oliveYoungUs.*` | Category JSON API | `upsertProductFromOliveYoungUsHit` |
| StyleKorean | `styleKorean.*` | Category + product sitemaps | `upsertProductFromStyleKoreanHit` |
| Jolse | `jolse.*` | Gzip product sitemaps + category HTML | `upsertProductFromJolseHit` |
| YesStyle | `yesStyle.*` | Category sitemap + HTML (blocked by default) | `upsertProductFromYesStyleHit` (per variant) |

Soko Glam should follow the **StyleKorean/Jolse queue shape** with **Shopify JSON** as the primary fetch layer (closer to Olive Young US API ergonomics than Cafe24 HTML).

`queueNames.ts` today defines namespaces for `oliveYoung`, `yesStyle`, `styleKorean`, `jolse`, and `oliveYoungUs` only — Soko Glam adds `sokoGlam.*`.

### Backend card links

Soko Glam will be **`linkable = true`** (default). Card PDP URLs use existing `getLowestPriceLinkableOffer` + `buildSellerProductPageUrl(seller.productUrlTemplate, product.sku)`.

---

## Gap analysis

| Area | Today | Soko Glam target (ALE-58) |
|------|-------|---------------------------|
| `sellers` row | None | **`Soko Glam`** + US `productUrlTemplate` |
| Staging category | None | **`Staging taxonomy / Soko Glam`** |
| SKU key | N/A | Shopify product **`handle`** (slug string) — proposed |
| Listing discovery | N/A | Product sitemap + `collections/{handle}/products.json` |
| Fetch layer | No Shopify helpers | Shared **`src/scrapers/shopify/*`** (fetch, parse, map); thin Soko Glam wrappers only where needed |
| Scraper package | N/A | **`src/scrapers/sokoGlam/*`** (jobs, constants, upsert, spec prefix) + **`src/scrapers/shopify/*`** (platform) |
| Queue namespace | N/A | **`sokoGlam.*`** |
| HTTP client | No `sokoglam.com` host rules | Throttle + optional cookie + UA override (Cloudflare) |

---

## Design decisions

### 1. US storefront only, canonical base `https://sokoglam.com` (proposed)

- Standardize env `SOKO_GLAM_SITE_BASE_URL` on **`https://sokoglam.com`** (no `www`).
- Sitemap `<loc>` values already use bare host; collection/product JSON paths are host-relative.

### 2. Queue namespace `sokoGlam.*` (locked)

Mirror StyleKorean/Jolse queue set:

```ts
sokoGlam.sellerCategoryHierarchy
sokoGlam.sellerCategoryMapping
sokoGlam.categoryProducts
sokoGlam.sitemapProducts
sokoGlam.product
sokoGlam.productPdp
```

Worker concurrency: **`sokoGlam.product` and `sokoGlam.productPdp` at 1** initially.

### 3. `Product.sku` = Shopify product `handle` (proposed — confirm in spike)

Extract from:

- Sitemap PDP loc: `/products/{handle}`
- Collection JSON: `product.handle`
- Product JSON: `product.handle`

**Rationale:** PDP URLs are handle-based; `buildSellerProductPageUrl` can use `https://sokoglam.com/products/{{sku}}` without storing numeric Shopify ids. Handles are stable enough for v1 (spike should note rare handle changes).

**Do not** use numeric `product.id` as `Product.sku` unless spike finds handle collisions or churn.

### 4. One `Product` row per Shopify product, not per variant (proposed)

- Upsert **one** commerce `Product` per Shopify parent product (`handle`).
- **Price** on `seller_product_prices`: use the **minimum** `variant.price` among **available** variants (or first variant if availability flags are missing).
- Store variant count / option summary in listing specs if useful (`SG Variant count`, `SG Options`).
- **Defer** YesStyle-style per-variant rows unless product cards show wrong prices for multi-variant SKUs.

### 5. `Seller.productUrlTemplate` (proposed)

```text
https://sokoglam.com/products/{{sku}}
```

where `{{sku}}` is the product `handle`.

### 6. Listing before PDP (locked)

**Phase A** — sitemap + collection JSON → `upsertProductFromSokoGlamHit` (brand, product, seller_product, price, listing specs from product JSON).

**Phase B** — `sokoGlam.productPdp` enrichment for `body_html` flattening, tags, images, and optional review widgets once listing is stable.

Because Shopify `.json` returns rich PDP fields, Phase A jobs should still fetch product JSON (not sitemap-only stubs) unless queue pressure requires a two-step id-only → enrich split.

### 7. HTTP client reuse + Soko Glam host rules (locked)

Extend `src/lib/httpClient.ts`:

- `SOKO_GLAM_REQUEST_DELAY_MS` throttle for `sokoglam.com`
- `SOKO_GLAM_BROWSER_COOKIE` optional cookie injection
- Chrome desktop UA substitution when `SCRAPER_USER_AGENT` is the default bot string (same pattern as StyleKorean)
- `fetchJson` helper usage for `.json` endpoints (may already exist via `postJson` / add `getJson`)

Default throttle ≥ **700ms** (Shopify rate limits are usually generous; tune in spike).

### 8. Sitemap-first ingest with collection enrichment (proposed)

1. **Product sitemap walk** — parse `sitemap_products_1.xml`; filter `<loc>` matching `/products/{handle}`; skip `/` root loc and non-product paths (e.g. gift cards if excluded).
2. **Collection discovery** — parse `sitemap_collections_1.xml` → `seller_categories` rows (`/collections/{handle}`). Optionally filter out non-merchandising collections (`gift-cards`, `checkout-*`) in spike.
3. **Category products job** — paginate `GET /collections/{handle}/products.json?limit=250&page=N` to refresh **price, brand, name, thumbnail** for SKUs in each collection.

**Priority:** sitemap jobs > collection listing jobs (`sokoGlamProductIngestPriorities` mirroring Jolse).

### 9. Collection hierarchy — flat v1 (proposed)

Shopify collection sitemaps do **not** expose parent/child trees. v1:

- `sellerCategoryHierarchy` seeds flat `seller_categories` from collections sitemap.
- `parentSellerCategoryId = null` for all rows unless spike documents a reliable nav-based parent map worth encoding.

### 10. Spec prefix `SG ` (proposed)

PDP-derived specs use prefix **`SG `** (e.g. `SG Thumbnail URL`, `SG Description`, `SG Product type`, `SG Tags`) for manual curation batches — mirror `JL ` / `SK ` / `OY ` conventions in backend scripts.

### 11. Shared Shopify platform layer (locked intent)

Introduce `src/scrapers/shopify/` as the **platform module** for all Shopify retailers. Soko Glam is retailer #1; the module should be written **as if retailer #2 already exists**.

**Principles:**

- **Parameterize by storefront**, not by env global: shared functions take `{ siteBaseUrl, handle, … }` or a small `ShopifyStorefrontConfig` object (`siteBaseUrl`, optional `localePathPrefix` for future `/en-us/` shops, `collectionProductsPageSize`). Do **not** import `getEnv().SOKO_GLAM_*` inside `shopify/`.
- **Shared = protocol + parsing**; **retailer folder = wiring + persistence**: sitemap walk, `.json` HTTP, handle/collection extraction, and generic listing/PDP field structs live in `shopify/`. Each retailer keeps its own `upsertProductFrom*Hit`, spec prefix (`SG `), BullMQ jobs, `ensureCommerceEntities` resolvers, and HTTP routes — same split as StyleKorean vs Jolse today.
- **No premature abstraction of jobs/queues**: do not build a generic `shopify.product` queue in v1. Copy the proven `styleKorean.*` / `jolse.*` job shape per retailer; jobs should be thin and call into `shopify/` helpers.
- **Unit tests on shared code**: fixtures live under `src/scrapers/shopify/__fixtures__/` (product JSON, collection page JSON, sitemap XML snippets) so the next retailer inherits coverage without duplicating fixtures.
- **HTTP throttling stays per-host in `httpClient`**: each retailer adds its own `*_REQUEST_DELAY_MS` / cookie env vars (Shopify shops share patterns but not hostnames). Shared fetchers accept an optional `hostThrottleKey` or rely on existing per-host throttle keyed by URL hostname.
- **Spec prefixes stay retailer-specific**: shared mappers emit neutral field names (`thumbnailUrl`, `descriptionHtml`, `tags`); the retailer PDP mapper adds `SG ` (or `WT ` for Wishtrend later).

**Suggested `shopify/` layout (implement in ALE-58):**

```text
src/scrapers/shopify/
  types.ts                          # ShopifyProductJson, ShopifyCollectionProductsPage, ListingFieldsFromShopify
  parseHandleFromProductLoc.ts      # /products/{handle} from sitemap <loc> or path
  parseCollectionHandleFromLoc.ts   # /collections/{handle}
  collectProductHandlesFromSitemaps.ts   # walk sitemap index → product urlsets → handles
  collectCollectionHandlesFromSitemaps.ts
  fetchShopifyProductJson.ts        # GET {base}/products/{handle}.json
  fetchShopifyCollectionProductsPage.ts  # GET …/collections/{handle}/products.json?limit=&page=
  mapShopifyProductJsonToListingFields.ts  # vendor, title, min variant price, primary image
  mapShopifyProductJsonToPdpFields.ts      # body_html, tags, product_type, images (neutral keys)
  minAvailableVariantPrice.ts       # shared multi-variant price rule
  __fixtures__/                     # JSON/XML from Soko Glam spike (anonymized handles OK)
```

**Stays in `src/scrapers/sokoGlam/` (not shared):**

```text
sokoGlamConstants.ts                # collection exclude regex defaults, spec prefix constant
summarizeSokoGlamListingFields.ts # typed view of listing fields for upsert
upsertProductFromSokoGlamHit.ts   # Prisma choke point
mapSokoGlamProductJsonToSpecRows.ts  # applies SG prefix, retailer curation conventions
jobs/*                            # BullMQ workers; call shopify/ then upsert
```

**Onboarding retailer #2 (future ticket — not ALE-58 scope):**

1. Backend seed: `sellers` + staging `product_categories`.
2. Env block: `{RETAILER}_SITE_BASE_URL`, throttle, optional cookie.
3. `src/scrapers/{retailer}/` jobs + upsert + spec prefix.
4. Reuse `shopify/collectProductHandlesFromSitemaps`, `fetchShopifyProductJson`, etc. unchanged if canonical URL shape matches.
5. Spike only for: bot friction, collection exclude list, locale prefix, review widget — not for reimplementing JSON parsing.

**Playbook follow-up (Phase 5):** add a short **“Shopify retailers”** subsection to `retailerScrapingPlaybook.md` documenting this split and pointing at `shopify/` as the template for Wishtrend / RoseRoseShop.

---

## Phase 0 — Spike (gate before bulk ingest)

**Deliverable:** `commerce-platform-scrapers/docs/sokoGlamSpike.md` (same shape as `jolseSpike.md` / `styleKoreanSpike.md`).

**Checklist:**

1. Run `npm run probe:storefronts -- https://sokoglam.com/` (with backend env) and record friction.
2. Confirm product sitemap walk end-to-end from Node; count product PDP URLs; note whether multiple `sitemap_products_*.xml` children appear over time.
3. Lock regex for `handle` extraction from sitemap loc and collection/product JSON.
4. Enumerate collections from sitemap; propose exclude list (`gift-cards`, marketing-only collections).
5. From one collection (`skincare`, pages 1–2) and one multi-variant PDP JSON, capture:
   - product name, brand (`vendor`), min price, compare-at price, thumbnail `images[0].src`, availability
   - pagination termination (`products.json` empty page vs partial page)
6. Decide **parent product vs per-variant** `Product` rows (default: parent product).
7. Test whether **Chrome UA + optional cookie** remains sufficient from production scraper hosts (no Playwright).
8. Propose locked `productUrlTemplate`, `Product.sku` field, and JSON field mapping.
9. Note review widget presence (Yotpo, Judge.me, Shopify native) — defer review ingest unless spike finds a stable public endpoint.
10. Document 429/403 behavior and recommended `SOKO_GLAM_REQUEST_DELAY_MS`.
11. Skim `https://sokoglam.com/agents.md` — document UCP/MCP for future agents; **do not** depend on it for v1 scrapers.

**Debug script (add in spike PR):** `scripts/debugSokoGlamUrls.ts` — prints sample handles from product sitemap + one collection `products.json` page without DB writes.

**Early spike observations (June 2026 — replace with spike doc):**

- Sitemap + product/collection JSON: **200 OK** from Node `curl` with Chrome UA.
- ~**803** product URLs, ~**279** collections.
- `GET /products/{handle}.json` returns full variant arrays and `body_html`.
- `GET /collections/skincare/products.json?limit=250` returns 250 products (pagination via `page=` to be confirmed in spike).
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
| `sellers` | **INSERT** row: `name = 'Soko Glam'`, `linkable = true`, `sellerCountryId` → US `countries` row (if seeded), `productUrlTemplate` = `https://sokoglam.com/products/{{sku}}` |
| `product_categories` | **INSERT** staging row: `name = 'Staging taxonomy / Soko Glam'`, `categoryKind = STAGING` |
| `currencies` | Reuse existing `USD` row |

**Migration naming:** `ale_58_soko_glam_seller_and_staging_category`

After apply: scrapers run `npm run db:pull:useBackendEnv` + `npm run db:generate`.

**No backend application code changes required for v1** unless thumbnail resolver needs a Soko Glam-specific branch after PDP specs exist (see Phase 5).

---

## Phase 2 — Scrapers scaffolding

**Repo:** `commerce-platform-scrapers`

| Task | Files / notes |
|------|----------------|
| Env schema | `src/config/env.ts` — `SOKO_GLAM_SELLER_NAME`, `SOKO_GLAM_STAGING_PRODUCT_CATEGORY_NAME`, `SOKO_GLAM_SITE_BASE_URL`, `SOKO_GLAM_SITEMAP_INDEX_URL`, throttle knobs, optional cookie, `SOKO_GLAM_COLLECTION_PRODUCTS_PAGE_SIZE` (default 250), collection exclude regex |
| Entity resolvers | `ensureCommerceEntities.ts` — `findSokoGlamSeller`, `findStagingProductCategoryForSokoGlam` |
| Constants | `src/scrapers/sokoGlam/sokoGlamConstants.ts` — spec prefix, default collection exclude regex |
| **Shopify platform** | `src/scrapers/shopify/*` per [§11](#11-shared-shopify-platform-layer-locked-intent); **no** `SOKO_GLAM_*` imports inside this folder |
| Soko Glam adapters | Thin wrappers only if a job needs retailer-specific defaults; prefer jobs calling `shopify/` directly with `siteBaseUrl` from env |
| Queue names | `queueNames.ts` — `sokoGlamQueueNames`, `sokoGlamProductIngestPriorities` |
| Queues + workers | `queues.ts`, `registerWorkers.ts` — wire all queues; stub `productPdp` worker OK initially |
| HTTP client | `httpClient.ts` — throttle, cookie, UA override for `sokoglam.com`; ensure JSON GET helper |
| HTTP routes | `server.ts` — `POST /jobs/soko-glam/seller-category-hierarchy`, `…/seller-category-mapping`, `…/category-products`, `…/sitemap-products`, `…/product-sources`, `…/product-pdp-enrich`, `…/product-pdp-enrich-all` |
| Probe defaults | Add `https://sokoglam.com/` to `scripts/probeRetailerStorefronts.ts` default URL list |
| `.env.example` | Document all new knobs |

---

## Phase 3 — Listing ingest

Implement after spike doc is approved.

| Component | Location | Purpose |
|-----------|----------|---------|
| `collectProductHandlesFromSitemaps.ts` | **`shopify/`** | Walk sitemap index; parse `sitemap_products_*.xml`; extract handles (reusable) |
| `collectCollectionHandlesFromSitemaps.ts` | **`shopify/`** | Parse `sitemap_collections_*.xml` → collection handles (reusable) |
| `fetchShopifyCollectionProductsPage.ts` | **`shopify/`** | Paginated `products.json` for a collection handle |
| `mapShopifyProductJsonToListingFields.ts` | **`shopify/`** | Neutral listing fields (name, vendor, min price, image, handle) |
| `discoverSokoGlamSellerCategoryNodes.ts` | `sokoGlam/` | Job glue: call `shopify/` collectors + apply Soko Glam exclude regex → `seller_categories` |
| `summarizeSokoGlamListingFields.ts` | `sokoGlam/` | Typed summary for upsert |
| `upsertProductFromSokoGlamHit.ts` | `sokoGlam/` | Single DB choke point (mirror `upsertProductFromJolseHit`) |
| Jobs | `sokoGlam/jobs/` | `sellerCategoryHierarchy`, `sellerCategoryMapping`, `scrapeCategoryProducts`, `scrapeSitemapProducts`, `scrapeProduct` — thin; pass `siteBaseUrl` into `shopify/` |
| `scrapeProduct.ts` worker | `sokoGlam/jobs/` | `fetchShopifyProductJson` → map → upsert; concurrency **1**; `P2002`-aware |

**Smoke path:**

```bash
cd commerce-platform-scrapers
npm run dev:useBackendEnv
# POST /jobs/soko-glam/seller-category-hierarchy
# POST /jobs/soko-glam/sitemap-products  { "maxProducts": 20 }
# POST /jobs/soko-glam/category-products  { "maxSellerCategories": 1 }
# Bull Board: /admin/queues
```

**Success criteria:** At least 20 products ingested from sitemap smoke; `seller_products` + `seller_product_prices` rows visible for `Soko Glam`; `buildSellerProductPageUrl` returns valid `sokoglam.com` links for smoke handles.

---

## Phase 4 — PDP + spec enrichment

| Component | Location | Purpose |
|-----------|----------|---------|
| `mapShopifyProductJsonToPdpFields.ts` | **`shopify/`** | Neutral PDP field struct from product JSON |
| `mapSokoGlamProductJsonToSpecRows.ts` | `sokoGlam/` | Wraps shared PDP fields → `ProductSellerSpec` rows with **`SG `** prefix |
| `enrichProductPdp.ts` job | `sokoGlam/jobs/` | Re-fetch via `fetchShopifyProductJson` (or reuse cached fields); concurrency **1** |
| `enqueueAllProductPdpEnrichJobs.ts` + npm script | `sokoGlam/jobs/` | Keyset batch from Postgres → `addBulk` |
| Reviews | — | **Optional v1** — only ingest if spike finds stable Yotpo/Judge.me public API or parseable HTML block |

---

## Phase 5 — Docs + roadmap + backend follow-ups

| Task | Location |
|------|----------|
| Spike notes | `docs/sokoGlamSpike.md` |
| Roadmap row | `docs/kBeautyRetailerRoadmap.md` — Soko Glam: Planned → In progress → Done |
| Playbook cross-link | **Shopify retailers** subsection in `retailerScrapingPlaybook.md` — shared `shopify/` module, what to copy per new retailer |
| Platform doc (optional) | `docs/shopifyRetailerIntegration.md` — one-pager if playbook subsection is too short; link from spike doc |
| Queue hygiene script | `scripts/sokoGlamProductQueue.ts` (optional; copy Jolse script) |
| Thumbnails | `getProductThumbnailUrl` — `images[0].src` from `SG Thumbnail URL` spec or Shopify CDN fallback |

---

## Test plan

### Scrapers

- Unit tests under **`src/scrapers/shopify/`** for handle extraction, listing/PDP mappers, min-variant price, collection pagination — **fixture JSON/XML in `shopify/__fixtures__/`** (reused by future Shopify retailers).
- Soko Glam upsert tests remain under `sokoGlam/` (mock prisma only).
- Unit test for `upsertProductFromSokoGlamHit` with mocked prisma (match Jolse/StyleKorean test style if present).
- Manual: sitemap smoke 20 products; verify Bull Board completion; query DB for seller name + URL template.

### Backend

- No migration logic tests required beyond existing patterns; manually verify seller row after migrate.
- Optional: unit test `buildSellerProductPageUrl` with Soko Glam template + sample handle once locked.

### Pre-push

- **Backend:** `npm run lint`, `npm run build`
- **Scrapers:** `npm run build` (includes `prisma generate`)

---

## Risks

| Risk | Mitigation |
|------|------------|
| First Shopify integration — no prior module | Build `shopify/` platform layer up front; spike doc locks JSON contracts; resist copying logic into `sokoGlam/` |
| Over-abstraction of queues/jobs | Keep per-retailer BullMQ namespaces; only share fetch/parse/map in `shopify/` |
| Second Shopify shop differs (locale prefix, Markets) | `ShopifyStorefrontConfig.localePathPrefix` in types; spike documents Soko Glam as prefix-free |
| Multi-variant pricing on cards | Use min available variant price; spike multi-variant PDP; document in upsert |
| `handle` changes break old SKUs | Rare; monitor 404 on JSON fetch; optional `SG Shopify product id` spec for reconciliation |
| Collection sitemap noise (gift cards, promos) | Exclude regex in env; document in spike |
| Cloudflare tightens bot rules | Chrome UA + optional cookie; Playwright fallback only if JSON blocked |
| Shopify adds rate limits / blocks `.json` | Throttle; respect `robots.txt`; UCP/MCP as future fallback (not v1) |
| Flat categories weaken hierarchy jobs | Accept null parents v1; mapping job still useful for collection-scoped ingest |
| SKU collision with another retailer | Handles are retailer-specific strings; monitor `Product.sku` uniqueness in smoke |
| Architect rejects seed timing | Spike + doc review before DDL |

---

## Implementation TODO

- [x] **Phase 0:** Complete spike; write `docs/sokoGlamSpike.md`; add `debugSokoGlamUrls.ts`
- [x] **Phase 0:** Lock `productUrlTemplate`, `Product.sku` field, variant pricing rule, and collection exclude list in spike doc
- [x] **Phase 0:** Confirm `products.json` pagination (`page` param, max `limit`, termination)
- [x] **Phase 1:** Architect approval for Soko Glam seller + staging category seed migration
- [x] **Phase 1:** Apply migration; `db:pull` in scrapers
- [x] **Phase 2:** Env, queue names, `ensureCommerceEntities`, `httpClient` host rules, workers, HTTP routes
- [x] **Phase 2:** Implement shared `src/scrapers/shopify/` platform layer (types, sitemap collectors, JSON fetch, listing/PDP mappers, fixtures) — **no `SOKO_GLAM_*` imports in this folder**
- [x] **Phase 2:** Soko Glam jobs call `shopify/` with `siteBaseUrl` from env; keep `sokoGlam/` limited to upsert, spec prefix, and job wiring
- [x] **Phase 3:** Sitemap + collection JSON fetch + `upsertProductFromSokoGlamHit`; smoke ingest (803/803 products locally)
- [ ] **Phase 3:** Unit tests for mappers/upsert (when fixtures exist)
- [x] **Phase 4:** PDP enrichment job + spec mapping + enqueue-all routes (803/803 enriched locally)
- [ ] **Phase 4:** Unit tests for PDP mappers (when fixtures exist)
- [ ] **Phase 5:** Update `kBeautyRetailerRoadmap.md` and playbook **Shopify retailers** subsection (document `shopify/` reuse for Wishtrend / RoseRoseShop)
- [ ] **Follow-up:** Thumbnail resolver fallback after ingest (if needed)
