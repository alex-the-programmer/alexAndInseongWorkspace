# Flow: dev-retailer-card-audit

**Priority:** P2  
**Auth:** none (local gate only)  
**Preconditions:** `NODE_ENV !== 'production'`, not on Vercel; backend running with multi-seller catalog.

## Cases

### dev-retailer-audit-01: Page renders locally

- **Steps:**
  1. Go to `http://localhost:3020/dev/retailer-card-audit`
- **Assertions:**
  - Page title/heading **Retailer card audit** (or equivalent) visible
  - At least one seller section with product cards
- **Notes:** No Clerk auth required.

### dev-retailer-audit-02: Production gate returns 404

- **Steps:**
  1. Simulate production (`VERCEL=1` or production build) — manual only
- **Assertions:**
  - `notFound()` / 404
- **Notes:** Not automated in v1 local Playwright; document for manual QA.
