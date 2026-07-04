# Flow: chat-product-delivery

**Priority:** P1  
**Auth:** signed-in  
**Ticket:** ALE-40

## Cases

### chat-product-delivery-01: No deferral stub after budget constraints

- **Steps:**
  1. Fresh chat
  2. `which moisturizers would you recommend`
  3. `dry skin, around $30`
  4. If deferral or no cards: `were you able to find anything`
- **Assertions:**
  - Final turn: `hasDeferralStub: false`
  - Product cards when catalog available (warn if missing in dev)
- **Spec:** `playwright/tests/chat/product-delivery.spec.ts`
