# Flow: chat-card-reference

**Priority:** P1  
**Auth:** signed-in  
**Preconditions:** Backend with catalog data; prompt likely to produce a Quick compare table with ≥2 products.

## Cases

### chat-card-reference-01: Follow-up "the first one" references compare card #1 (ALE-97)

- **Steps:**
  1. Fresh chat
  2. `which hand creams would you recommend for very dry hands`
  3. `around $15 — compare your top two picks in the table`
  4. If no compare/cards: `please show a quick compare of two hand cream options`
  5. Read first shown product name (`comparison-product-1-name` or first `product-card-name`)
  6. `is the first one more like Korean eucerin?`
- **Assertions:**
  - Quick compare visible with ≥2 products before follow-up
  - Follow-up assistant text mentions a meaningful token from product #1 name
  - Follow-up does **not** answer primarily about a different shown product or an unrelated SKU when referent name is absent
  - `[agent-response-review]` logged for follow-up turn
- **Notes:** Do not assert exact assistant prose. Post-run: grep `[agent-response-review]` and confirm `chat-card-reference-01-followup` mentions referent tokens.
- **Spec:** `playwright/tests/chat/card-reference-follow-up.spec.ts`
