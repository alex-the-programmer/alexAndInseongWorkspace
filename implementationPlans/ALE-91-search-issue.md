# ALE-91 — Search issue (agent pivots to face masks unprompted)

## Context

[Linear ALE-91](https://linear.app/dewly/issue/ALE-91/search-issue)

**Reported:**

1. Quiz prompt showed up when no one asked for it.
2. **Response is for face masks when no one asked for face masks.**

**Repro (screenshot):** User sends the **sensitive-skin landing starter**:

> My skin is dry and reacts to almost everything. Can you recommend gentle, fragrance-free Korean products?

Assistant replies:

- *“I'm so excited to help you find the perfect **face mask**!”* and asks what skin concern they want to address **with the mask**.
- Follow-up: *“I couldn't find specific gentle, fragrance-free **face masks**…”* then offers a tangential product card (e.g. Haruharu cleanser) under “Want to try something close with a discount?”

User asked for **general gentle, fragrance-free products** — not masks.

**Out of scope for this plan:** Quiz / routine CTA buttons on assistant turns. Current behavior matches ALE-6 (`getChatMessages` attaches CTAs to the first assistant message). Product (Inseong) is clarifying desired CTA rules separately.

**Follow-up:** [ALE-95](https://linear.app/dewly/issue/ALE-95/show-quizroutine-ctas-only-on-greeting-opening-turn) — implementation plan `implementationPlans/ALE-95-chat-cta-buttons-opening-only.md`. CTAs should only appear on the greeting opening turn, not when the user starts chat with a real message (homepage flow).

**Repos:** `commerce-platform-backend` (primary), `commerce-platform-frontend` (E2E repro).

**Database changes:** None.

**Branch (Linear):** `alexmtruecar/ale-91-search-issue`

---

## Investigation summary

### User message (actual repro)

From `commerce-platform-frontend/lib/landingStarters.ts` (`id: "sensitive"`):

```
My skin is dry and reacts to almost everything. Can you recommend gentle, fragrance-free Korean products?
```

No mention of masks, sheet masks, or a single product type.

### What catalog search returns

Probed local DB with `searchProducts`:

| Query | Hits | Notes |
| ----- | ---- | ----- |
| Full user message | **0** | Too long for substring; no trgm (under 12 chars threshold on… actually full message is long enough — still 0) |
| `gentle fragrance-free Korean products` | 1 | trgm fuzzy → cleanser |
| `gentle fragrance-free` | 2 | trgm fuzzy |
| `face mask gentle fragrance-free` | 2 | Same cleansers — **not masks** |

Catalog does not force a mask pivot; the agent is **choosing** mask framing and likely **searching** with mask-oriented queries.

### UI / turn structure (screenshot)

Two assistant bubbles after one user message suggests a **race** on landing → chat:

1. `sendShoppingMessage` with pending starter text
2. `startShoppingConversation` opening turn on the same new chat (`chatPage.tsx` seeds when `messages.length === 0`)

Both can invoke `invokeShoppingAgent` on the same `mastraThreadId` before messages hydrate, producing multiple assistant turns and confusing thread order.

**CTAs on first assistant:** `getChatMessages.ts` always attaches quiz/routine buttons to the **first assistant message** in the thread (not only opening turns) — explains buttons on a mask reply without implying that turn was the synthetic opening.

### Agent pressure toward tool use

For this message, `expectsProductDelivery()` is **true** (`recommend` + `dry` constraint signal). `invokeShoppingAgent` injects a delivery nudge (“call catalog tools… finish with a short wrap-up”). That is appropriate — but there is **no guard** that tool queries and recommendations must stay within the **product types the user actually asked for**.

---

## Root cause

| Layer | Location | Problem |
| ----- | -------- | ------- |
| Agent instructions | `shoppingAgent.ts` | No explicit rule: **do not infer a product category** (e.g. masks) when the user asked broadly (“products”, “routine”, “gentle picks”) |
| Turn nudges | `invokeShoppingAgent.ts` | Delivery nudge pushes tools but not **scope fidelity** — agent may search/recommend masks anyway |
| Search usage | Agent tool calls | Full user query often returns 0 rows; agent may invent a narrower category (masks) instead of constraint-based search (gentle, fragrance-free) across types |
| Structured enrichment | `invokeShoppingAgent.ts` | No validation that product cards match user-stated product type / concerns |
| Frontend race (secondary) | `chatPage.tsx` | Pending landing message + `startShoppingConversation` on empty chat can double-invoke agent on one thread |

**Not the issue:** Missing Haruharu / Biodance in catalog, or brand-search plumbing (separate concern).

---

## Expected behavior

- Broad requests (“gentle, fragrance-free Korean products” for dry sensitive skin) → empathize, optionally ask **one** clarifying question (cleanser vs moisturizer vs sunscreen), or search with **user constraints** across relevant categories — **not** default to face masks.
- Prose must not say “face mask(s)” unless the user mentioned masks or chose that category.
- Product cards (if any) should match stated constraints and product type; no mask SKUs when masks were not requested.
- If catalog search is thin, say so honestly — do not reframe the request as a failed mask search.

---

## Implementation plan

### 1. Agent instructions — product-type scope

**File:** `commerce-platform-backend/src/agents/shoppingAgent.ts`

Add a **Validate product-type scope** block:

- If the user asks for “products”, “recommendations”, or routine help **without** naming a form (mask, serum, cleanser, etc.), do **not** narrow to one category (especially masks).
- Only discuss masks when the user said mask/sheet mask/pack, or explicitly picked that type after your clarifying question.
- When search returns `widerSearchNote` or weak matches, do not recast the user’s goal (e.g. “gentle products” → “face masks”).

### 2. Broad-request detection + turn nudge

**New file:** `isBroadProductRequest.ts`

Heuristic: recommend intent + skin/concern constraints but **no** product-form token (reuse `PRODUCT_FORM_TOKENS` from `searchQueryTokens.ts` or share a small constant).

**File:** `invokeShoppingAgent.ts`

When `isBroadProductRequest(userMessage)`:

- Inject nudge: search with user constraints (`gentle`, `fragrance-free`, `sensitive`) — **do not** add `mask` to queries; prefer `find_products_by_specs` / multi-type search or one clarifying question before picking a category.
- Forbid mask-specific framing in the reply unless user asked for masks.

**Tests:** unit tests for heuristic (sensitive starter → true; “popular face masks” → false).

### 3. Post-enrichment product-type guard (deterministic)

**File:** `invokeShoppingAgent.ts` (after structured enrichment)

When user message has **no** mask intent (simple regex: `\bmask(s)?\b`, `sheet mask`, etc.):

- Drop product cards whose category or name clearly indicates masks/packs (category name or title contains `mask`, `pack` in mask context).
- If assistant `content` mentions face masks but user didn’t, log warning and optionally strip mask-centric sentences via existing text normalization (minimal: log + metric first; sentence rewrite only if needed for E2E).

**Tests:** enrichment guard unit test — sensitive-skin message + mask SKU in tool digest → card dropped.

### 4. Improve default search query shaping (optional, smaller)

**File:** `searchProducts.ts` or agent tool description

When query is a long natural-language sentence, extract **meaningfulTokens** for an automatic retry before wider fallbacks (today full-string substring often returns 0). Helps agent get real hits for “gentle fragrance-free” without inventing “face mask”.

**Tests:** `searchProducts.test.ts` — long NL query retries with token AND and returns matches.

### 5. Skip opening seed when pending landing message (frontend)

**File:** `commerce-platform-frontend/components/chatPage.tsx`

In the `startShoppingConversation` effect: if `getPendingChatMessage()` is set (or pending handled flag), **do not** seed opening — the user’s first real message is already in flight.

Reduces double assistant turns; does not alone fix mask pivot but improves landing → chat UX.

**Tests:** `chatPage.test.tsx` — pending message present → `startShoppingConversation` not called.

### 6. E2E repro (TDD)

**Flow:** `e2eTestFlows/flows/chat-product-scope.md` — case `chat-product-scope-01`

**Spec:** `commerce-platform-frontend/playwright/tests/chat/product-scope.spec.ts`

1. Signed-in user, fresh chat
2. Send sensitive-skin starter verbatim
3. `captureAgentResponseReview` with:
   - `forbiddenPhrases`: `face mask`, `face masks`, `perfect face mask`
   - `minLength` > 0
4. If product cards appear: none should have `mask` in name (heuristic)
5. Grep `[agent-response-review]` post-run

Cross-link in `e2eTestFlows/index.md`.

---

## Verification checklist

- [ ] Sensitive-skin starter → assistant prose does not mention face masks
- [ ] Tool calls (from logs) do not use mask-only queries unless user asked
- [ ] Product cards (if any) are not mask SKUs for this case
- [ ] Landing pending-message flow does not double-seed opening
- [ ] Backend unit tests + E2E `chat-product-scope-01` green

---

## Risks / notes

- **LLM variance:** Instructions + nudge + deterministic card guard are layered; E2E uses heuristics + `[agent-response-review]`, not exact prose.
- **Legitimate mask requests:** “popular face masks” starter (`landingStarters.ts` `id: "masks"`) must still work — guard only applies when user did not mention masks.
- **CTA buttons:** tracked separately per product decision.

---

## TODO

- [x] E2E repro `chat-product-scope-01`
- [x] Agent instructions — product-type scope
- [x] `isBroadProductRequest` + invoke nudge
- [x] Post-enrichment mask guard on cards / logging
- [ ] (Optional) NL query token retry in `searchProducts`
- [x] Skip opening seed when pending landing message
- [x] Unit tests (`productRequestScope.test.ts`, `chatPage.test.tsx`)
- [x] E2E green (run locally with dev servers)
- [ ] PRs: `commerce-platform-backend`, `commerce-platform-frontend`
