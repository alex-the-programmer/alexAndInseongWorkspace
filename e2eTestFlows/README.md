# E2E test flows (commerce-platform-frontend)

This folder is the **source of truth for Playwright user flows and test cases**. It lives in the workspace repo, sibling to `implementationPlans/`.

Implementation plan: [`implementationPlans/ALE-82-introduce-playwright-e2e-frontend.md`](../implementationPlans/ALE-82-introduce-playwright-e2e-frontend.md)

## Contents

| File | Purpose |
|------|---------|
| [`index.md`](index.md) | Flow catalog with P0/P1/P2 priorities |
| [`pages-graph.md`](pages-graph.md) | Reachability graph — routes, overlays, auth zones |
| [`SETUP.md`](SETUP.md) | Local stack + Clerk E2E user setup |
| [`flows/*.md`](flows/) | One file per user flow with test cases |

Playwright test code lives in `commerce-platform-frontend/playwright/` (Phase 2). Each test should reference its flow case id from this folder.

## Local test user

See [`SETUP.md`](SETUP.md). Quick start:

```bash
cd commerce-platform-frontend
node scripts/createE2eTestUser.mjs
```

## Running tests

Requires backend (`:4020`) and frontend (`:3020`) running locally. Playwright runner added in Phase 2 — see implementation plan.
