# ALE-95 — Show quiz/routine CTAs only on greeting opening turn

## Context

[Linear ALE-95](https://linear.app/dewly/issue/ALE-95/show-quizroutine-ctas-only-on-greeting-opening-turn)

**Reported in** [ALE-91](https://linear.app/dewly/issue/ALE-91/search-issue) (quiz buttons mid-chat) and clarified by product (Inseong):

> Take the quiz and set up my routine should only come up when the user is starting a new chat and the quiz was not filled out. Not randomly sprinkled in until the user answers.

**Original feature:** [ALE-6](https://linear.app/dewly/issue/ALE-6/open-ended-questions-tell-me-about-your-skin-and-about-the-routine) — opening greeting nudge + CTA buttons for incomplete quiz/routine.

**Repos:** `commerce-platform-backend` (primary), `commerce-platform-frontend` (E2E).

**Database changes:** None.

**Branch:** `ALE-95-show-quizroutine-ctas-only-on-greeting-opening-turn`

---

## Product rules

| Scenario | Greeting? | Quiz/routine incomplete? | Show CTAs? |
| -------- | --------- | ------------------------ | ---------- |
| Sign in / sign up → new chat | Yes (synthetic opening turn) | Yes | **Yes** on greeting assistant message |
| User clicks **New chat** (empty thread) | Yes | Yes | **Yes** |
| Homepage text area / starter chip → auth → chat | **No** (first message is real user text) | Yes | **No** |
| Ongoing conversation (2nd+ assistant turn) | N/A | Yes | **No** |
| Any path where quiz + routine are complete | N/A | No | **No** |

CTAs are **Take the Skin Quiz** and **Set up my routine** (URLs unchanged — see ALE-92).

---

## Current behavior (bug)

| Layer | File | Behavior |
| ----- | ---- | -------- |
| Live agent turn | `invokeShoppingAgent.ts` → `buildCtaButtons(openingOnly, …)` | ✅ Returns CTAs only when `openingOnly` (synthetic `[The chat just opened…]` user turn) |
| History hydration | `getChatMessages.ts` L104–118 | ❌ Attaches CTAs to **first assistant message** whenever quiz/routine missing — **ignores opening turn** |
| Opening mutation cache hit | `startShoppingConversation.ts` → `buildCtaButtons(userContext)` | ❌ Recomputes CTAs on cached assistant without opening-turn check |

This explains the ALE-91 screenshot: user sends a real skincare question from the homepage; the first assistant reply is about face masks; `getChatMessages` (or the live path after hydration) still decorates that bubble with quiz/routine buttons.

Synthetic opening turn detection already exists:

```typescript
// shoppingOpeningTurn.ts
isShoppingOpeningUserMessage(content, role) // role === "user" && content starts with "[The chat just opened"
```

Opening user messages are **filtered out** of the UI list in `getChatMessages`, but they remain in Mastra memory and can be detected before filtering.

---

## Implementation

### 1. Shared helper — thread had opening turn

Add to `shoppingOpeningTurn.ts` (or a tiny `chatOpeningCta.ts` colocated with chat CTA URLs):

```typescript
export function threadHadOpeningTurn(
  messages: Array<{ role?: string; content?: unknown }>,
  extractText: (content: unknown) => string
): boolean {
  return messages.some((m) =>
    isShoppingOpeningUserMessage(extractText(m.content), m.role ?? "user")
  );
}
```

### 2. Consolidate CTA button building

Today there are two `buildCtaButtons` implementations:

| Location | Signature |
| -------- | --------- |
| `invokeShoppingAgent.ts` | `(openingOnly, quizMissing, routineEmpty)` |
| `startShoppingConversation.ts` | `(userContext)` — no opening gate |

**Change:** Keep the gated function in `invokeShoppingAgent.ts` as the single source of truth. Add a thin wrapper if needed:

```typescript
export function buildCtaButtonsForUserContext(
  openingOnly: boolean,
  userContext: ShoppingUserContext
): ChatMessageCta[] {
  const quizMissing = userContext.skinQuiz.status === "missing";
  const routineEmpty =
    userContext.routine.status === "missing" ||
    (userContext.routine.status === "present" && userContext.routine.items.length === 0);
  return buildCtaButtons(openingOnly, quizMissing, routineEmpty);
}
```

Remove or re-export `startShoppingConversation.buildCtaButtons` to call the shared helper (update `startShoppingConversation.helpers.test.ts` imports).

### 3. Fix `getChatMessages.ts`

After building `rows` (and before hydrating product cards):

```typescript
const hadOpeningTurn = threadHadOpeningTurn(messages, extractText);

const firstAssistant = rows.find((r) => r.role === "assistant");
if (firstAssistant && hadOpeningTurn) {
  const userContext = await getShoppingUserContext(chat.userId, clerkUserId);
  firstAssistant.ctaButtons = buildCtaButtonsForUserContext(true, userContext);
}
```

If `hadOpeningTurn` is false → leave `ctaButtons` as `[]` on all messages.

### 4. Fix `startShoppingConversation.ts` cache-hit path

When returning a cached last assistant (memory already has messages), only attach CTAs if the thread had an opening turn:

```typescript
const hadOpening = threadHadOpeningTurn(messages, extractText);
const ctaButtons = buildCtaButtonsForUserContext(hadOpening, userContext);
```

The fresh-invoke path already gets `ctaButtons` from `invokeShoppingAgent` with correct `openingOnly` — no change needed there.

### 5. Frontend

No UI changes expected — `chatMessageList.tsx` already renders `ctaButtons` from GraphQL. Verify no client-side CTA injection.

---

## Tests

### Backend interaction tests

| File | Case |
| ---- | ---- |
| `getChatMessages.test.ts` | **Update** existing test: real user message first → `ctaButtons` empty on assistant |
| `getChatMessages.test.ts` | **Add**: opening turn + assistant greeting → CTAs present when quiz missing |
| `getChatMessages.test.ts` | **Add**: opening turn filtered from rows but CTAs still on first visible assistant |
| `startShoppingConversation.helpers.test.ts` | Point at shared helper; add opening-gate cases |
| `invokeShoppingAgent.helpers.test.ts` | Unchanged (already covers `openingOnly` gate) |

### E2E (Playwright)

| Case id | Flow file | Spec |
| ------- | --------- | ---- |
| `chat-opening-nudge-01` | `chat-opening-nudge.md` | **Keep** — fresh chat via sign-in path still shows CTAs (ALE-6) |
| `chat-cta-no-opening-01` | `chat-cta-opening-only.md` (new) | **Add** — homepage starter → auth → chat: assert CTAs **not** visible on first assistant reply |

Document in `e2eTestFlows/index.md`.

**Note:** Reuse sensitive-skin landing starter from ALE-91 (`landingStarters.ts` `id: "sensitive"`) for the negative case.

---

## Verification (manual)

1. **Fresh user, sign in** → new chat → greeting + **Take the Skin Quiz** / **Set up my routine** visible.
2. **Fresh user, homepage question** → sign in → first bubble is user's question; assistant reply has **no** CTA buttons.
3. **User with quiz complete** → new chat greeting → only **Set up my routine** (if routine empty).
4. **Reload chat page** on (2) — buttons still absent after hydration.
5. **Second message** in any chat — no CTAs on new assistant turns.

---

## Out of scope

- Changing opening greeting copy (ALE-6 nudge text).
- Hiding CTAs when opening turn races with homepage `sendShoppingMessage` (ALE-90 / ALE-89) — separate tickets; this ticket only fixes CTA attachment rules.
- Routine-page quiz entry points (hero, empty state) — unchanged.

---

## TODO

- [x] Add `threadHadOpeningTurn` helper
- [x] Consolidate `buildCtaButtons` / `buildCtaButtonsForUserContext`
- [x] Fix `getChatMessages.ts` CTA attachment
- [x] Fix `startShoppingConversation.ts` cache-hit CTA recompute
- [x] Update backend interaction tests
- [x] Add E2E negative case `chat-cta-no-opening-01`
- [x] Run `npm test` in backend; run affected Playwright spec
- [ ] Commit on `ALE-95-…` branch
