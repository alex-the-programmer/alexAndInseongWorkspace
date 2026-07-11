# Flow: chat-recommendation-boxes

**Priority:** P1  
**Auth:** signed-in  
**Preconditions:** Backend with catalog data; agent can return product cards on recommendation turns.

## Problem (ALE-104)

When structured enrichment has `productCards` but **no** `comparison` metadata, the UI must not show primary picks only under **“Want to try something close with a discount?”**. Users should see Quick compare, Top pick, or a plain product-card group.

## Cases

### chat-recommendation-boxes-01: Primary recommendations are not discount-only (ALE-104)

- **Steps:**
  1. Fresh chat
  2. `Recommend moisturizers for dry skin around $30 — show me catalog picks in cards`
  3. If deferral / no cards: `were you able to find anything`
- **Assertions:**
  - `productCardCount > 0` when catalog available
  - **Forbidden:** discount header visible without Quick compare or Top pick
  - **Allowed:** Quick compare, Top pick, plain cards (no discount header), or compare/top pick plus discount strip
  - `[agent-response-review]` logged per turn
- **Spec:** `playwright/tests/chat/recommendation-boxes.spec.ts`
- **Skip when:** no product cards after follow-up (catalog/agent variability) — log skip reason

## Notes

- Complements `chat-card-reference-04` (referent resolution on plain cards) by asserting correct **box labeling**, not follow-up semantics.
- Deterministic repro lives in `chatMessageList.test.tsx` (unit).
