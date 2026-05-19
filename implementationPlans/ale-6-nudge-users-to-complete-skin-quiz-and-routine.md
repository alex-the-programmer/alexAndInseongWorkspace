# ALE-6 — Nudge users to complete skin quiz & routine in opening chat message

## Context

The shopping agent greets users with a warm opening message and asks a discovery question. However, the agent's recommendations are far more useful when it knows the user's skin profile (from the quiz) and existing routine. Currently, users who skipped those flows get the same generic greeting as users who completed them.

The fix: when the opening message is being generated, check whether the user has completed the skin quiz and/or set up a routine. If either is missing, the agent's greeting should **strongly suggest** completing those flows first, with a natural but direct nudge. If both are present, behaviour is unchanged.

This is a **backend-only change** — no DB migrations, no new interactions, no schema changes, no frontend changes.

---

## What already exists (no new code needed for data access)

- **`getShoppingUserContext`** (`src/interactions/chat/getShoppingUserContext.ts`) — already fetches both and returns:
  - `skinQuiz: { status: "present", answers: [...] } | { status: "missing" }`
  - `routine: { status: "present", items: [...] } | { status: "missing" }`
- This result is already available in `invokeShoppingAgent` at line 251–254, **before** `systemWithTurn` is built.

---

## Implementation

**Single file to change:** `src/interactions/chat/invokeShoppingAgent.ts`

### Step 1 — Derive missing-state booleans (add after line 266)

```typescript
const quizMissing = shoppingUserContext.skinQuiz.status === "missing";
const routineEmpty =
  shoppingUserContext.routine.status === "missing" ||
  (shoppingUserContext.routine.status === "present" &&
    shoppingUserContext.routine.items.length === 0);
```

### Step 2 — Add a `buildOpeningNudge` helper (add as a module-level function)

```typescript
function buildOpeningNudge(quizMissing: boolean, routineEmpty: boolean): string {
  if (quizMissing && routineEmpty) {
    return `Important: This is the first moment of the chat. Do not call tools. Do not name specific products, brands, prices, or deals.
The user has NOT completed their Skin Quiz and has NOT set up their Skincare Routine. These two steps are essential for personalised recommendations.
Greet them warmly, then strongly encourage them to complete the Skin Quiz first (available at /quiz/skin-quiz) and then set up their Skincare Routine (/skincare-routine) before shopping. Make clear this will let you give them far better, personalised advice. Keep it warm and motivating, not scolding.`;
  }
  if (quizMissing) {
    return `Important: This is the first moment of the chat. Do not call tools. Do not name specific products, brands, prices, or deals.
The user has NOT completed their Skin Quiz. Greet them warmly, then strongly encourage them to complete the Skin Quiz (/quiz/skin-quiz) first — it lets you give personalised, skin-type-matched recommendations. Keep it brief and encouraging.`;
  }
  if (routineEmpty) {
    return `Important: This is the first moment of the chat. Do not call tools. Do not name specific products, brands, prices, or deals.
The user has completed their Skin Quiz but has NOT set up their Skincare Routine. Greet them warmly, acknowledge their quiz completion, then strongly encourage them to set up their routine (/skincare-routine) — it lets you identify gaps and make targeted swaps. Keep it brief and encouraging.`;
  }
  return `Important: This is the first moment of the chat. Do not call tools. Do not name specific products, brands, prices, or deals. Reply with a short greeting and exactly ONE discovery question only.`;
}
```

### Step 3 — Replace `systemWithTurn` opening branch (lines 293–297)

```typescript
// Before:
const systemWithTurn = openingOnly
  ? `${systemWithCheckoutNudge}

Important: This is the first moment of the chat. Do not call tools. Do not name specific products, brands, prices, or deals. Reply with a short greeting and exactly ONE discovery question only.`
  : systemWithCheckoutNudge;

// After:
const systemWithTurn = openingOnly
  ? `${systemWithCheckoutNudge}\n\n${buildOpeningNudge(quizMissing, routineEmpty)}`
  : systemWithCheckoutNudge;
```

---

## Critical files

| File | Change |
|---|---|
| `src/interactions/chat/invokeShoppingAgent.ts` | Add `quizMissing`/`routineEmpty` booleans + `buildOpeningNudge` helper + update `systemWithTurn` |

No changes to:
- `shoppingOpeningTurn.ts` (synthetic user message stays the same)
- `getShoppingUserContext.ts` (already returns everything needed)
- GraphQL schema / resolvers
- Frontend
- Prisma schema / migrations

---

## Verification

1. **Manual test — both missing:** Create a fresh test user with no quiz responses and no routine items. Start a new chat. The opening message should warmly suggest completing the quiz first, mention the routine, and **not** ask a product discovery question.
2. **Manual test — quiz missing only:** User has routine items but no completed quiz response. Opening message should only nudge toward the quiz.
3. **Manual test — routine empty only:** User has a completed quiz but no routine items. Opening should acknowledge the quiz and nudge toward setting up a routine.
4. **Manual test — both present:** Existing users with quiz + routine. Opening message should be the normal warm greeting + ONE discovery question (no change from current behaviour).
5. **Run existing tests:** `npm test` in `commerce-platform-backend` — no test changes required; the existing GraphQL resolver test for `startShoppingConversation` mocks `invokeShoppingAgent` at the interaction level, so it is unaffected.

---

## TODO

- [ ] Add `quizMissing` / `routineEmpty` booleans in `invokeShoppingAgent.ts`
- [ ] Add `buildOpeningNudge` helper function
- [ ] Replace `systemWithTurn` opening branch to use `buildOpeningNudge`
- [ ] Run `npm test` and confirm all tests pass
- [ ] Manual test all four cases
- [ ] Commit and push on branch `ALE-6-...`
