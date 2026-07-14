# ALE-106 — Share link and false advice-for-other detection

## Context

[Linear ALE-106](https://linear.app/dewly/issue/ALE-106/share-link-points-to-chat-false-advice-for-other-detection-on-first)

Follow-up to [ALE-10](ALE-10-detection-of-advice-for-other-ppl.md) ([Linear](https://linear.app/dewly/issue/ALE-10/detection-of-advice-for-other-people)).

Four related bugs in the advice-for-other-user share flow (reported Jul 2026 on staging):

1. **Wrong share URL** — Copy link text ends with `https://askdewly.com/chat`; should be the site root (`https://askdewly.com/`).
2. **False positive on first message** — First-person complaints about body parts (e.g. *"after swimming a lot, my hands are super dry"*) incorrectly trigger `adviceForOtherUser: true` and the share nudge UI.
3. **False positive on follow-up** — Product-selection follow-ups (e.g. *"perhaps a good thick hand cream would be best"*) keep setting `adviceForOtherUser: true`, so the share banner reappears on every assistant turn.
4. **Deferral with tools disabled** — When `adviceForOtherUser` is true, `invokeShoppingAgent` sets `toolChoice: "none"` and skips enrichment, but the agent still replies with deferral copy (*"Let me find some fantastic options… Just a moment!"*). `shouldBlockDeferralOnlyDelivery` explicitly **skips** blocking when `adviceForOtherUser` is true, so no completion retry runs and the user never gets cards.

**Branch:** `ALE-106-share-link-and-false-advice-for-other-detection`

**Repos:** `commerce-platform-frontend`, `commerce-platform-backend`

**Database changes:** None.

---

## Root cause

### Issue 1 — `/chat` in share URL

`ShareNudgeCard` in `chatMessageList.tsx` hardcodes:

```ts
const shareUrl = `${window.location.origin}/chat`;
```

The marketing homepage lives at `/`; new users should land there, not in chat.

### Issue 2 — Narrow first-person guard

`isClearlyFirstPersonAdviceRequest` (`detectAdviceForOtherUser.ts`) short-circuits the LLM when it recognizes self-directed skincare language. Current pattern:

```ts
/\bmy\s+(skin|face|routine|acne|dry|oily|sensitive)\b/i
```

**"my hands"** does not match — `hands` is not in the alternation. The message falls through to the LLM classifier (`userMemoryExtractionAgent`), which can false-positive on ambiguous phrasing.

Third-party guards (`friend`, `sister`, `she has`, etc.) remain correct and must not regress.

### Issue 3 — Follow-up product selection falls through to LLM

`detectAdviceForOtherUser` skips the LLM when `expectsProductDelivery(userMessage)` is true — but *"perhaps a good thick hand cream would be best"* does **not** match `expectsProductDelivery` today (has `cream` constraint signal but no budget / recommend intent). The message hits the LLM classifier without first-person signals and can false-positive again, especially with thread context from the prior misclassified turn.

### Issue 4 — Advice-for-other mode disables delivery guardrails

When `adviceForOtherUser` is true (`invokeShoppingAgent.ts`):

- `maxSteps: 1`, `toolChoice: "none"` — catalog tools unavailable
- Structured enrichment skipped entirely
- `shouldBlockDeferralOnlyDelivery({ adviceForOtherUser: true })` returns `false` — deferral copy is allowed
- `deliveryNudge` ("finish with recommendations in this turn") is **not** appended

The agent is told not to recommend for a third party, but on a misclassified self-directed thread it still verbally promises product search — a dead end for the user.

---

## Fix

### 1. Frontend — share URL to site root

**File:** `commerce-platform-frontend/components/chatMessageList.tsx`

- Import `absoluteUrl` from `@/lib/siteUrl` (canonical origin via `NEXT_PUBLIC_SITE_URL`).
- Change `ShareNudgeCard` to:

```ts
const shareUrl = absoluteUrl("/");
```

Using `absoluteUrl` instead of `window.location.origin` keeps staging/preview canonical URLs consistent with SEO metadata.

**Tests:** `commerce-platform-frontend/src/__tests__/components/chatMessageList.test.tsx`

- Update clipboard assertion: expect root URL, assert copied text does **not** contain `/chat`.

**Tests:** `commerce-platform-frontend/src/__tests__/lib/brand.test.ts` — no change needed (`shareMessage` is URL-agnostic).

---

### 2. Backend — broaden first-person body-part detection

**File:** `commerce-platform-backend/src/interactions/chat/detectAdviceForOtherUser.ts`

Expand `isClearlyFirstPersonAdviceRequest` with deterministic patterns (after existing third-party guards):

1. **Body parts** — extend `my (...)` alternation:

```ts
/\bmy\s+(skin|face|routine|acne|dry|oily|sensitive|hands?|feet|body|neck|legs?|arms?|elbows?|lips?|eyes?|scalp|hair|back|chest|shoulders?)\b/i
```

2. **Possessive + condition** — catches *"my hands are super dry"* even if body-part list is incomplete:

```ts
/\bmy\s+\w+\s+(is|are)\s+(super\s+)?(dry|oily|sensitive|irritated|red|flaky|itchy|cracked|peeling|rough)\b/i
```

Third-party names (`friend`, `sister`, …) are already rejected **before** these patterns run, so *"my sister is oily"* still returns `false` from the first-person guard (correct — it should be detected as third-party via `THIRD_PARTY_SIGNAL_RE`).

3. **LLM prompt examples** — add to `DETECTION_INSTRUCTIONS` negatives:

- `"after swimming, my hands are super dry"`
- `"my feet get really dry in winter"`

**Tests:** `commerce-platform-backend/src/__tests__/interactions/chat/detectAdviceForOtherUser.test.ts`

- `isClearlyFirstPersonAdviceRequest("after swimming a lot, my hands are super dry")` → `true`
- `detectAdviceForOtherUser("after swimming a lot, my hands are super dry")` → `false`, LLM not called
- Existing third-party cases unchanged

**Tests:** `commerce-platform-backend/src/__tests__/interactions/chat/invokeShoppingAgent.adviceForOtherUser.test.ts`

- Add case: first-person hands complaint → `adviceForOtherUser: false`

---

### 3. Backend — self-directed product follow-ups skip advice-for-other detection

**File:** `commerce-platform-backend/src/interactions/chat/detectAdviceForOtherUser.ts`

Add `isClearlySelfDirectedProductRequest(userMessage)` (or extend `expectsProductDelivery`) so product-type selection without third-party signals short-circuits **before** the LLM:

```ts
// Product format / category pick in an ongoing self-directed chat
/\b(hand cream|body cream|moisturi[sz]er|lotion|serum|cleanser|sunscreen|toner|essence|balm|treatment)\b/i
  && /\b(would be best|sounds good|that works|let'?s go with|i('d| would) (like|prefer)|show me|find me|recommend)\b/i
```

Also treat bare product-format picks as delivery intent in `expectsProductDelivery` (`shoppingTurnDeliveryExpectations.ts`):

- e.g. `CONSTRAINT_SIGNAL_RE` alone when message also matches affirmative selection (`would be best`, `sounds good`, `go with`, etc.)

**Tests:**

- `detectAdviceForOtherUser("perhaps a good thick hand cream would be best")` → `false`, LLM not called
- `expectsProductDelivery("perhaps a good thick hand cream would be best")` → `true`

---

### 4. Backend — block deferral promises when advice-for-other (misclassified) path is active

**File:** `commerce-platform-backend/src/interactions/chat/shoppingTurnDeliveryExpectations.ts`

Change `shouldBlockDeferralOnlyDelivery` so deferral copy is blocked when the user message expects product delivery **even if** `adviceForOtherUser` is true. Misclassified turns should not leave the user with a "just a moment" dead end.

```ts
// Before: if (params.openingOnly || params.adviceForOtherUser) return false;
// After: only openingOnly skips blocking; adviceForOtherUser no longer exempts deferral
if (params.openingOnly) return false;
```

**File:** `commerce-platform-backend/src/interactions/chat/invokeShoppingAgent.ts`

Strengthen `adviceForOtherUserNudge` — add explicit line:

> Do NOT promise to search the catalog, say "just a moment", or imply product cards are coming on this turn.

When `adviceForOtherUser && expectsProductDelivery(userMessage)`, log a warning — this combination indicates a likely misclassification and should trend toward zero after detection fixes.

**Tests:** `shoppingTurnDeliveryExpectations.test.ts` — deferral blocked when `adviceForOtherUser: true` and user expects delivery.

---

### 5. E2E regression

**Flow doc:** `e2eTestFlows/flows/chat-advice-for-other.md`

Add case:

#### chat-advice-for-other-02: First-person body-part complaint does not show share nudge

- **Steps:**
  1. Fresh signed-in chat
  2. Send `after swimming a lot, my hands are super dry`
- **Assertions:**
  - Share nudge **not** visible
  - `[agent-response-review]`: on-topic skincare empathy; no share-pivot language
  - Agent may ask clarifying question (hand cream vs treatment) — do not assert exact prose

**Spec:** `commerce-platform-frontend/playwright/tests/chat/advice-for-other.spec.ts` (extend existing ALE-10 spec)

#### chat-advice-for-other-03: Follow-up product pick delivers cards, no share nudge

- **Steps:**
  1. Fresh signed-in chat
  2. Send `after swimming a lot, my hands are super dry`
  3. Wait for assistant reply (may ask clarifying question)
  4. Send `perhaps a good thick hand cream would be best`
- **Assertions:**
  - Share nudge **not** visible on any assistant message
  - Product cards appear after step 4 (or agent gives concrete picks without deferral-only copy)
  - No persistent "Just a moment" / "Let me find" without cards
  - `[agent-response-review]`: on-topic; no share-pivot language

Cross-link in `e2eTestFlows/index.md` if not already listed.

---

## Out of scope

- Changing share nudge copy ("Share the app so **they** can get…") — only shown when detection is correct; no copy change needed for this ticket.
- Thread-level conversation classifier (multi-turn LLM over full history) — deterministic per-turn guards + `expectsProductDelivery` expansion should suffice for the reported repro.

---

## Verification

| Scenario | Expected |
| -------- | -------- |
| Copy link on share nudge | Clipboard contains `https://askdewly.com` (or staging canonical), **no** `/chat` |
| "after swimming a lot, my hands are super dry" | No share nudge; normal skincare conversation |
| Follow-up: "perhaps a good thick hand cream would be best" | No share nudge; product cards or non-deferral delivery |
| "My friend has oily skin, what should she use?" | Share nudge visible; no product cards |
| "what would you recommend for my dry skin" | No share nudge (existing ALE-85/ALE-10 guard) |

**Pre-push:**

- Backend: `npm run lint`, `npm run build`, `npm test` in `commerce-platform-backend`
- Frontend: `npm run lint`, `npm run build`, `npm test` in `commerce-platform-frontend`
- E2E: `npx playwright test advice-for-other.spec.ts` (local or staging per run-e2e-automation skill)

---

## TODO

- [x] Fix `ShareNudgeCard` share URL → `absoluteUrl("/")`
- [x] Update `chatMessageList.test.tsx` clipboard assertion
- [x] Broaden `isClearlyFirstPersonAdviceRequest` body-part + condition patterns
- [x] Add self-directed product follow-up guard + expand `expectsProductDelivery`
- [x] Block deferral when user expects delivery even on misclassified `adviceForOtherUser` turns; tighten nudge copy
- [x] Add LLM prompt negative examples
- [x] Add backend unit tests (detect + invokeShoppingAgent + delivery expectations)
- [x] Add E2E cases `chat-advice-for-other-02` and `-03` + extend Playwright spec
- [x] Run affected unit tests and E2E; confirm green
- [x] Open PR(s) for frontend + backend
