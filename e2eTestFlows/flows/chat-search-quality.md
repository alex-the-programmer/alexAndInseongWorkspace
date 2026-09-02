# Flow: chat-search-quality

**Ticket:** [ALE-109](https://linear.app/dewly/issue/ALE-109/fixing-miscellaneous-bugs)  
**Priority:** P1  
**Auth:** signed-in  
**Preconditions:** Backend + agent; local/staging catalog with **Moisturizers & creams** (`canonicalCategoryId` subtree) populated. Pair with backend live probe `searchProducts.liveCatalog.test.ts` — this flow does **not** prove search SQL by itself.

**Problem:** Production chat asked for a moisturizer for a sunburned dry nose. Search used `categoryId: 1` as an exact match, returned nothing, then global fuzzy ranked a foot cream and a sun cream.

## Assertion policy

- Assert **structure and card titles**, not exact LLM copy
- Log **`[agent-response-review]`** JSON per agent turn
- Playwright cannot see `searchStage` or tool args — those are the backend live probe

## Cases

### chat-search-quality-01: Sunburned-nose moisturizer is not a foot/sun/lip product (ALE-109)

- **Steps:**
  1. Fresh chat (`startFreshChat`)
  2. Send `what would you recommend to moisturize my sunburned dry nose`
  3. If that turn has no product cards, send `cream is fine, whichever works better`
- **Assertions:**
  - No off-topic redirect (`hasOffTopicRedirect: false`)
  - Latest assistant text length > 20
  - If product cards render: names must **not** match `\bfoot (cream|mask)\b`, `moisturizing sun cream`, `\bsunscreen\b`, `\blip (mask|balm|cream)\b`
- **Skip when:** still no product cards after both turns (clarifying loop or empty catalog). That is **not** a Phase B search failure — re-check the live catalog probe.
- **Notes:** `test.slow()`; timeout ≥ 180s. Post-run: `grep '[agent-response-review]'`. Implemented in `playwright/tests/chat/search-quality.spec.ts`. Local run 2026-09-02 (backend `main` with #58): first turn delivered a **face moisturizer** card (`La Roche-Posay Toleriane Double Repair Face Moisturizer`); no foot/sun/lip titles. Agent prose may still be a deferral stub while cards render — wait on `shown-product-*-name` test ids.
