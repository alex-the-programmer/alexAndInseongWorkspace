# ALE-25 — Improve test coverage to 90%+ (backend + frontend + scrapers)

## Context

[Linear ALE-25](https://linear.app/dewly/issue/ALE-25/improve-test-coverage-backend-interactions-frontend-components)

Follows [ALE-23](ALE-23-commerce-backend-test-framework-setup.md) (Jest + jest-prisma + fabbrica). Significant progress landed since the original plan was written, but we are still far from the **90%+ line coverage** target in all three commerce-platform code repos.

**Repos (matching `ALE-25-*` branches in each):**

- `commerce-platform-backend`
- `commerce-platform-frontend`
- `commerce-platform-scrapers`

**Related (different layer — do not conflate):**

- [ALE-86](ALE-86-backfill-llm-regression-e2e-tests.md) — Playwright agent regression tests
- [ALE-78](ALE-78-ingest-time-catalog-deduplication.md) — `catalog-dedup` package (already ≥90% gated); scrapers consume `ingest/*`
- `.cursor/rules/e2e-automation.mdc` — E2E policy; this ticket is **unit/integration (Jest)** only

**Database changes:** None. Scrapers tests use mocked Prisma (no migrations in scrapers repo).

---

## Current baseline (measured 2026-07-03)

| Repo | Suites | Tests | Stmt | Branch | Func | **Lines** |
| ---- | ------ | ----- | ---- | ------ | ---- | --------- |
| **Backend** | 113 pass | 479 pass | 54.0% | 41.1% | 55.6% | **56.5%** |
| **Frontend** | 69 pass | 401 pass | 53.0% | 43.5% | 53.3% | **55.2%** |
| **Scrapers** | 5 (4 pass) | 11 pass / **1 fail** | n/a | n/a | n/a | **~5% est.** |
| **catalog-dedup** (shared package) | — | — | — | — | — | **≥90%** (already gated) |

**Scrapers detail:**

- **318** production `.ts` files under `src/`; only **5** co-located `*.test.ts` files (no `test:coverage` script yet).
- Test runner today: `node --import tsx --test 'src/**/*.test.ts'` (Node built-in runner, not Jest).
- **Broken:** `upsertProductFromCosrxUsHit.test.ts` — Prisma mock missing `sellerProduct.findFirst` required by `catalog-dedup/ingest/findOrCreateProduct` (post–ALE-78 ingest path).
- `npm test` also invokes `catalog-dedup` via `npm run test --prefix ../packages/catalog-dedup` — same missing-local-jest issue as backend unless `packages/catalog-dedup` is installed.

**Backend coverage by area (lines):**

| Area | Lines | Gap vs 90% |
| ---- | ----- | ---------- |
| `interactions/catalog` | 52% | 27 files &lt;90% |
| `interactions/chat` | 61% | 17 files &lt;90% |
| `interactions/userMemory` | 26% | 10 files &lt;90% |
| `interactions/routines` | 39% | 4 files &lt;90% |
| `src/tools` | 28% | all 19 tool files &lt;90% |

**Files under 90% line coverage:** backend **91**, frontend **28**, scrapers **~313** (effectively untested).

---

## Goal

1. **≥90% global line coverage** in **backend, frontend, and scrapers** (statements within ~2 pts of lines).
2. **Enforce in CI** via Jest `coverageThreshold` (fail PR if coverage drops).
3. **Cursor rule** so agents maintain coverage when touching covered code.
4. **Repair broken / fragile tests** before raising thresholds.
5. **Documented backfill inventory** (this plan) executed in priority order.

Branches: **≥85%** (harder to hit uniformly). Phase in after line coverage is stable at 90%.

---

## Part 0 — Fix broken tests & measurement hygiene

Do this first. Do not raise `coverageThreshold` until green.

### 0.1 `catalog-dedup` sub-package test runner (backend + scrapers)

**Symptom:** Root `npm test` in backend/scrapers fails after main suites:

```
Cannot find module '.../packages/catalog-dedup/node_modules/jest/bin/jest.js'
```

**Fix:** Same as backend — `postinstall` at repo root or point catalog-dedup `test` script at parent `node_modules/jest`. Apply in **both** `commerce-platform-backend` and `commerce-platform-scrapers` (scrapers depends on `file:../packages/catalog-dedup`).

### 0.2 `signUpWall` React `act()` warnings (frontend)

Wrap OAuth click flows in `await act` / `waitFor` in `signUpWall.test.tsx`.

### 0.3 Co-located `*.test.ts` inside `src/` (backend)

Move `src/**/*.test.ts` → `src/__tests__/…`; exclude `!src/**/*.test.ts` from coverage.

### 0.4 Broken scrapers upsert test

**File:** `src/db/upserts/upsertProductFromCosrxUsHit.test.ts`

**Root cause:** After ALE-78, `upsertCatalogListing` calls `findOrCreateProduct` / `findOrCreateSellerProduct` from `catalog-dedup/ingest`. The hand-rolled Prisma mock predates that and lacks `sellerProduct.findFirst`.

**Fix (preferred):** Mock ingest at the boundary:

```ts
// jest.unstable_mockModule or node:test mock of @commerce-platform/catalog-dedup/ingest
// Assert upsertCatalogListing receives correct retailerSku, brandId, price
```

**Alternative:** Extend `createMockPrisma()` with full `sellerProduct.findFirst`, `product.findFirst`, etc. matching `findOrCreateProduct` contract — heavier, duplicates package integration tests.

Also mock `resolveBrandByName` (thin `catalog-dedup` wrapper) to return a fixed `{ id: brandId }`.

### 0.5 CI gaps

`.github/workflows/ci.yml` today only runs **backend** tests. Add jobs for **frontend** and **scrapers** (scrapers job needs no Postgres — unit tests use mocks).

```yaml
commerce-platform-scrapers:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: git submodule update --init commerce-platform-scrapers
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: npm
        cache-dependency-path: commerce-platform-scrapers/package-lock.json
    - working-directory: commerce-platform-scrapers
      run: npm ci
    - working-directory: commerce-platform-scrapers
      run: npm run build
    - working-directory: commerce-platform-scrapers
      run: npm test
```

Switch all three jobs to `npm run test:coverage` once thresholds are configured (Part 1).

---

## Part 1 — Coverage measurement & enforcement

### 1.1 Commands

| Command | Backend | Frontend | Scrapers |
| ------- | ------- | -------- | -------- |
| Run tests | `npm test` | `npm test` | `npm test` |
| Coverage | `npm run test:coverage` | `npm run test:coverage` | `npm run test:coverage` *(new)* |
| HTML / LCOV | `coverage/` | `coverage/` | `coverage/` |

Workspace convenience script (optional):

```bash
# scripts/test-coverage.sh
for repo in commerce-platform-backend commerce-platform-frontend commerce-platform-scrapers; do
  (cd "$repo" && npm run test:coverage) || exit 1
done
```

### 1.2 Scrapers — migrate to Jest + Istanbul (new)

Scrapers use Node's built-in test runner today. **Migrate to Jest** for parity with backend/frontend (`coverageThreshold`, `lcov`, CI gates).

**Add devDependencies:** `jest`, `ts-jest`, `@types/jest` (mirror backend ESM setup).

**Create `jest.config.cjs`:**

```js
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", { useESM: true }],
  },
  testMatch: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.test.ts",
  ],
  coverageReporters: ["text", "lcov", "html"],
  coverageDirectory: "coverage",
};
```

**Update `package.json` scripts:**

```json
"test": "node --experimental-vm-modules node_modules/.bin/jest --config jest.config.cjs && npm run test --prefix ../packages/catalog-dedup",
"test:coverage": "node --experimental-vm-modules node_modules/.bin/jest --config jest.config.cjs --coverage"
```

**Migrate existing 5 test files** from `node:test` (`describe`/`it`/`assert`) to Jest (`expect`) — API is nearly identical. Co-located `src/**/*.test.ts` is fine for scrapers (pure parsers); optionally move to `src/__tests__/` later for consistency.

**Do not use jest-prisma** in scrapers by default — Prisma is mocked. Reserve real-DB integration smokes for optional `scripts/smoke*` (out of coverage gate).

### 1.3 Jest `coverageThreshold` — phased ramp (all three repos)

Lock **current baseline** first, then ratchet toward 90%.

| Repo | M0 lines (lock) | M4 goal |
| ---- | --------------- | ------- |
| Backend | 56 | 90 |
| Frontend | 55 | 90 |
| Scrapers | **5** (or first measured post-Jest) | 90 |

**Milestone schedule (all repos bump together):**

| Milestone | Lines target | Trigger |
| --------- | ------------ | ------- |
| M0 | baseline lock | Part 0 complete |
| M1 | 65 | P0 backfill |
| M2 | 75 | P1 backfill |
| M3 | 85 | P2 backfill |
| M4 | **90** | P3 backfill |

### 1.4 Coverage exclusions (narrow, documented)

**Backend:** `!src/index.ts`, `!src/loadEnv.ts`, `!src/agents/*.ts`, `!src/**/*.test.ts`

**Frontend:** `!app/layout.tsx`

**Scrapers:**

```js
"!src/server.ts",            // Express + Bull Board bootstrap
"!src/loadEnv.ts",
"!src/queues/registerWorkers.ts",  // worker registration glue
"!src/jobs/retailers.ts",    // retailer registry table only
```

Re-evaluate at M4. Job files that are thin `queue.add` wrappers may stay excluded if the enqueue helper and scraper/parser are tested.

### 1.5 CI coverage gate

All three submodule jobs run `npm run test:coverage` after M0.

### 1.6 Pre-push

Update `.cursor/rules/development-workflow.mdc`: when changing behavior in backend, frontend, or scrapers `src/`, run `npm run test:coverage` on affected repo before push.

---

## Part 2 — Cursor rule: maintain ≥90% coverage

Create `.cursor/rules/test-coverage.mdc`:

```yaml
---
description: Jest coverage expectations for commerce-platform backend, frontend, and scrapers
globs: commerce-platform-backend/**,commerce-platform-frontend/**,commerce-platform-scrapers/**
alwaysApply: false
---
```

**Rule content:**

1. Target **≥90% line coverage** globally in each repo (`npm run test:coverage`).
2. **New or changed production code** must include or update tests in the same PR.
3. **Backend:** interactions → real DB + fabbrica; GraphQL → mock interactions.
4. **Frontend:** RTL + mock `@/lib/graphql` hooks.
5. **Scrapers:** pure parsers → fixture HTML/JSON on disk; upserts → mock `catalog-dedup/ingest` + Prisma; no live retailer HTTP in unit tests.
6. Do **not** lower `coverageThreshold` without plan approval.
7. `catalog-dedup` matching logic stays in the package (≥90% there); scrapers/backend only test wiring.

Cross-link from `backend-guidelines.mdc` and scrapers `CLAUDE.md`.

---

## Part 3 — Backfill inventory

### 3.1 Backend — P0 (0% line coverage)

| File | Planned test |
| ---- | ------------ |
| `catalog/computeShoppingProductDiscountLabels.ts` | pure label logic |
| `catalog/getProductThumbnailImageId.ts` | spec resolution |
| `catalog/resolveSellerProductPageUrl.ts` | URL template + sku |
| `chat/extractMessageText.ts` | pure parser |
| `chat/normalizeComparisonHeroActives.ts` | pure normalizer |
| `dev/assertLocalDevToolsEnabled.ts` | throws when disabled |
| `index.ts` / `loadEnv.ts` / `agents/*` | exclude (§1.4) |

### 3.2 Backend — P1 (still missing from original plan)

| Source | Test file | Blockers |
| ------ | --------- | -------- |
| `findProductsBySpecs.ts` | `findProductsBySpecs.test.ts` | `SellerSpec*` factories |
| `getShoppingProductCardsBatch.ts` | `getShoppingProductCardsBatch.test.ts` | factories + URL template |
| `buildUserMemorySummary.ts` | `buildUserMemorySummary.test.ts` | `UserMemoryFactFactory` |
| `findProductsBySpecsTool.ts` | `findProductsBySpecsTool.test.ts` | export `normalizeFilterInput` |
| All 19 `src/tools/*` | `src/__tests__/tools/*.test.ts` | shared `toolTestHarness.ts` |

Factory exports still missing: `SellerSpecFactory`, `SellerSpecMappingFactory`, `ProductSellerSpecFactory`, `UserMemoryFactFactory`.

### 3.3 Backend — P2 / P3

See prior sections: low-coverage interactions (`generateSkincareRoutine`, `getChatMessages`, userMemory extractors, catalog hydration) then 50–89% tail (~30 files). Grep `lcov.info` after each milestone.

### 3.4 Frontend — P0 (0% line coverage, 10 files)

`chatPage`, `quizRunner`, `retailerCardAuditPage`, `routineOnboardingProductFields`, `routineOnboardingRunner`, `tooltip`, `app/sign-in`, `app/sign-up`, `app/sso-callback`; `app/layout` excluded.

### 3.5 Frontend — P1 (1–89% tail, 18 files)

`clerkOAuth` (45%), `productLookupInput` (56%), through `chatMessageList` (89%) — close branch gaps per file.

---

### 3.6 Scrapers — testing strategy

Follow `docs/retailerScrapingPlaybook.md` layering:

| Layer | What to test | How |
| ----- | ------------ | --- |
| **Pure parsers** | `summarize*`, `map*`, `extract*`, `parse*` | Fixture files in `__fixtures__/`; no network |
| **Platform modules** | `scrapers/shopify/*`, `scrapers/shared/*` | JSON/XML fixtures; Shopify listing + PDP mappers |
| **DB choke points** | `upsertCatalogListing`, `upsertProductSpecStringRows` | Mock `catalog-dedup/ingest`; assert params |
| **Retailer upserts** | 19× `upsertProductFrom*Hit.ts` | One parametrized suite per **platform** (not 19 copy-paste files) |
| **Jobs / queues** | `src/jobs/**/scrape*.ts`, workers | Exclude thin glue or smoke enqueue with mocked BullMQ |

**Do not re-test** `catalog-dedup/core` normalize/blocking in scrapers — package owns that.

### 3.7 Scrapers — P0 (fix + foundation)

| Item | Action |
| ---- | ------ |
| Fix `upsertProductFromCosrxUsHit.test.ts` | §0.4 |
| Jest + `test:coverage` | §1.2 |
| `scrapers/shared/extractSectionFromHtml.ts` | port tests from jolse usage patterns |
| `db/upserts/upsertCatalogListing.ts` | mock ingest; assert `normalizeProductTitle` + listing params |
| `db/resolveBrandByName.ts` | thin — mock `findOrCreateBrand` or one integration-style test |

### 3.8 Scrapers — P1 (platform layers — highest ROI)

**`scrapers/shopify/` (13 files, 0% today)** — used by cosrx, sokoGlam, ohLolly, laneige, etc.:

| File | Tests |
| ---- | ----- |
| `mapShopifyProductJsonToListingFields.ts` | listing JSON fixtures |
| `mapShopifyProductJsonToPdpFields.ts` | PDP JSON fixtures |
| `buildShopifyPdpSpecRows.ts` | spec row shape |
| `minAvailableVariantPrice.ts` | variant edge cases |
| `parseHandleFromProductLoc.ts` / `parseCollectionHandleFromLoc.ts` | URL parsing |
| `sitemapLocExclusions.ts` / `sitemapXml.ts` | XML fixtures |
| `collectProductHandlesFromSitemaps.ts` | mock fetch, assert handle set |

**`scrapers/jolse/` (7 files)** — HTML listing + PDP parsers (pattern for beautyNetKorea, moida, testerKorea).

**`scrapers/oliveYoung/` (14 files)** — ranking + sitemap + API response mappers (reference implementation per playbook).

**Parametrized upsert suite** (`src/__tests__/db/upserts/upsertCatalogListingRetailers.test.ts`):

- Shopify retailers: cosrxUs (already started), sokoGlam, ohLolly — shared listing field shape
- HTML listing retailers: jolse, styleKorean — shared `summarize*ListingFields` contract
- One row per platform validates `retailerSku`, `brandName`, `price` reach `upsertCatalogListing`

### 3.9 Scrapers — P2 (per-retailer parsers)

~20 retailer packages under `src/scrapers/{retailer}/`. For each, test **pure functions only** (no `fetch*` in unit tests — mock HTTP at job layer).

| Retailer dir | Key untested modules (representative) |
| ------------ | ------------------------------------- |
| `yesStyle` | listing summarizers, category mapping |
| `styleKorean` | sitemap + listing HTML extractors |
| `wishtrend` | WooCommerce-style mappers |
| `roseRoseShop` | Cafe24 listing fields |
| `beautyNetKorea` | HTML listing extraction |
| `medicubeUs`, `innisfreeUs`, `beautyOfJoseonUs`, `laneigeUs`, `skinglowHaven`, `peachAndLily` | Shopify thin wrappers — covered by P1 platform tests + 1 smoke case each |
| `oliveYoungUs` | US storefront variant |
| `testerKorea`, `moida` | sitemap + listing parsers |

**`src/db/` (29 files):** `resolveCanonicalProductRow`, `resolveCanonicalProductId`, spec upsert helpers — mock Prisma, assert canonical resolution chain.

**`src/lib/` (6 files):** `httpClient` throttling, `probeStorefrontBotProtection` — mock timers/fetch.

### 3.10 Scrapers — P3 (jobs tail + threshold bump)

- `src/jobs/**/enrichProductPdp.ts` — mock fetch + DB; one test per platform
- `src/jobs/**/scrapeCategoryProducts.ts` — mock queue + parser delegation
- Close any file still &lt;90% per `lcov.info`
- Raise scrapers `coverageThreshold` to **90**

### 3.11 Explicitly out of scope

| Item | Reason |
| ---- | ------ |
| Playwright E2E (product UI) | ALE-86 / ALE-82 |
| Live retailer HTTP in CI | use fixtures; optional manual `debug:*` scripts |
| Re-testing `catalog-dedup/core` | package already ≥90% |
| 100% coverage | 90% global is the target |

---

## Part 4 — Execution order

1. **Part 0** — catalog-dedup runner (backend + scrapers), broken upsert test, act warnings, co-located backend tests, CI jobs for all three repos
2. **Part 1 M0** — Jest migration for scrapers; `coverageThreshold` baseline in all three repos; CI `test:coverage`
3. **Part 2** — `.cursor/rules/test-coverage.mdc`
4. **Part 3 P0** — backend 0% pure functions + frontend 0% components + scrapers foundation (§3.7)
5. **Part 3 P1** — backend tools + missing interactions + scrapers shopify/shared/upsert (§3.8)
6. **Part 3 P2** — backend interactions + scrapers per-retailer parsers (§3.9)
7. **Part 3 P3** — all repos: 50–89% tail → **90%** threshold (§3.10)
8. PRs in **all three repos** against `main`

After each test file: `npm test -- <pattern>` then `npm run test:coverage`.

---

## Verification

```bash
cd commerce-platform-backend && npm test && npm run test:coverage
cd commerce-platform-frontend && npm test && npm run test:coverage
cd commerce-platform-scrapers && npm test && npm run test:coverage
```

**Success criteria:**

- [ ] All three repos: tests pass, scrapers upsert test fixed, catalog-dedup included
- [ ] CI runs `test:coverage` for backend + frontend + scrapers
- [ ] `coverageThreshold.global.lines ≥ 90` in all three jest configs
- [ ] `.cursor/rules/test-coverage.mdc` covers all three repos
- [ ] Backfill P0–P3 complete or deferred with issue links

---

## TODO

### Part 0 — Repair & infra
- [ ] Fix `catalog-dedup` jest runner (backend + scrapers)
- [ ] Fix `upsertProductFromCosrxUsHit.test.ts` (scrapers)
- [ ] Fix `signUpWall` act() warnings (frontend)
- [ ] Move co-located backend `src/**/*.test.ts` → `src/__tests__/`
- [ ] Add CI jobs for frontend + scrapers

### Part 1 — Measurement
- [ ] Migrate scrapers to Jest + `test:coverage`
- [ ] Add `coverageThreshold` M0 to all three `jest.config.cjs`
- [ ] Switch CI to `npm run test:coverage` (all three repos)
- [ ] Document `collectCoverageFrom` exclusions per repo
- [ ] Optional: workspace `scripts/test-coverage.sh`

### Part 2 — Cursor rule
- [ ] Create `.cursor/rules/test-coverage.mdc` (backend + frontend + scrapers)
- [ ] Cross-link from `backend-guidelines.mdc`, `development-workflow.mdc`, scrapers `CLAUDE.md`

### Part 3 — Backfill P0
- [ ] Backend: factories + 0% pure functions
- [ ] Frontend: 0% components + auth pages
- [ ] Scrapers: `extractSectionFromHtml`, `upsertCatalogListing` tests

### Part 3 — Backfill P1
- [ ] Backend: `findProductsBySpecs`, `getShoppingProductCardsBatch`, `buildUserMemorySummary`, all tools
- [ ] Scrapers: full `shopify/` suite + parametrized upsert platform tests

### Part 3 — Backfill P2
- [ ] Backend: chat/catalog/userMemory/routines low coverage
- [ ] Scrapers: per-retailer pure parsers + `src/db` helpers

### Part 3 — Backfill P3 / M4
- [ ] Close 50–89% tails in all three repos
- [ ] Raise all `coverageThreshold` to **90** lines
- [ ] Create PRs for backend, frontend, and scrapers
