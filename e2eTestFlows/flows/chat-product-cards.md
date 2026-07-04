# Flow: chat-product-cards

**Priority:** P2  
**Auth:** signed-in  
**Preconditions:** Backend with catalog data; prompt likely to trigger product recommendations.

## Cases

### chat-product-cards-01: Product cards render on recommendation turn (ALE-41)

- **Steps:**
  1. Fresh chat
  2. `Recommend moisturizers for dry skin around $30 — show me catalog picks`
  3. If deferral/no cards: `were you able to find anything`
- **Assertions:**
  - `hasDeferralStub: false`; product cards when catalog available
  - `[agent-response-review]` logged
- **Spec:** `playwright/tests/chat/product-cards.spec.ts`

### chat-prose-dedup-01: No markdown SKU lists when cards render (ALE-14)

- **Steps:** Multi-turn moisturizer recommend + budget (see `chat-product-delivery.md`)
- **Assertions:** `hasMarkdownSkuList: false` when cards present
- **Spec:** `playwright/tests/chat/prose-dedup.spec.ts`

### chat-discount-cards-01: Discount strip does not duplicate compare (ALE-18)

- **Spec:** `playwright/tests/chat/discount-cards.spec.ts`
- **Notes:** Skips structural check when compare+discount UI not shown

### chat-product-cards-02: CTA navigates to quiz or routine

- **Steps:**
  1. If assistant message includes CTA (e.g. **Take the Skin Quiz**), click it
- **Assertions:**
  - Navigates to `/quizzes/skin-quiz` or `/skincare-routine`
- **Notes:** Data-dependent; may need seeded conversation or new-user state.
