# ALE-92 Delay when switching to Your Skincare Routine

## Context

**Linear:** [ALE-92](https://linear.app/dewly/issue/ALE-92/delay-when-switching-to-your-skincare-routine)

**Reported by Inseong (2026-07-04):** “I go to *Your Skincare Routine* and I see the routine page flash before the quiz page pops up.”

**Branch:** `alexmtruecar/ale-92-delay-when-switching-to-your-skincare-routine` (per Linear)

**Repos:** `commerce-platform-frontend` only (no backend / DB changes expected)

**Related:** [ALE-34](implementationPlans/ALE-34-your-skin-routine-new-user.md) (new-user empty state + modals + `?openSetup` / `?openQuiz` deep links), [ALE-6](e2eTestFlows/flows/chat-opening-nudge.md) (chat opening CTAs)

---

## Reproduction analysis

### Inseong’s suspected path (mostly correct)

A **fresh signed-in user** (no skin quiz, no routine items) who starts a new chat will see two CTA buttons on the **first assistant message**:

| CTA label | Backend URL | Built in |
|-----------|-------------|----------|
| Take the Skin Quiz | `/quizzes/skin-quiz` | `invokeShoppingAgent.buildCtaButtons`, `getChatMessages`, `startShoppingConversation.buildCtaButtons` |
| Set up my routine | `/skincare-routine` | same |

Conditions: `skinQuiz.status === "missing"` and routine empty (`missing` or `present` with `items.length === 0`). Covered by E2E `chat-opening-nudge-01` (quiz CTA only; routine CTA appears when both are missing).

### What actually happens on click **today**

| User action | Navigation | What opens |
|-------------|------------|------------|
| **Take the Skin Quiz** (chat CTA) | `router.push("/quizzes/skin-quiz")` in `chatMessageList.tsx` | **Full-page** skin quiz (`QuizRunner` `variant="page"`). Floating nav hidden on `/quizzes/*`. Does **not** visit `/skincare-routine` first. |
| **Set up my routine** (chat CTA) | `router.push("/skincare-routine")` | **Full page** routine route. After GraphQL load, **new-user empty state** (“Let’s build *your* routine.”). **No modal auto-opens** — user must click **Set up my routine** again on the empty state to open `RoutineSetupModal`. |
| **Your Skincare Routine** (floating nav / account menu) | `Link` → `/skincare-routine` | Same as above. |
| **I don't have one — recommend me one** (empty state) | stays on page | **`RoutineOnboardingModal`** (`routine-onboarding` quiz, chat-style product capture). **Not** the skin quiz. |
| **Take the skin quiz** (hero, after manual setup) | stays on page | **`QuizModal`** (embedded skin quiz). Only shown when user is **past** new-user empty state. |

### Two different “quizzes” (naming trap)

| Quiz | URL / entry | UI | Purpose |
|------|-------------|-----|---------|
| **Skin quiz** | `/quizzes/skin-quiz` or `QuizModal` on routine page | `QuizRunner` | Skin profile (type, concerns, budget, …) |
| **Routine onboarding** | `RoutineOnboardingModal` or `?openQuiz=1` | `RoutineOnboardingRunner` | “What products do you use?” (9 slots) → recommendations |

When Inseong says “quiz page pops up,” it may mean either the **skin quiz full page**, the **skin quiz modal**, or the **routine onboarding modal**. The code paths differ.

---

## Root cause of the “routine page flash”

`shouldShowNewUserRoutineState` in `lib/skincareRoutine.ts` returns **`false` while `myRoutine` is loading**:

```typescript
if (!authReady || loading || error) return false;
return itemCount === 0;
```

While loading, `SkincareRoutinePage` renders the **established-user branch** (`commerceRoutinePage`): hero (“Hi {name} — *what you use, daily*”), AM/PM chrome, and a “Loading routine…” card — **not** the new-user empty state.

Once the query resolves with zero items, React re-renders to `NewUserRoutineEmptyState`. That one-frame-or-more swap is the visible **flash of the wrong routine UI** for every new user hitting `/skincare-routine`.

### Compounding: deep-link modal delay

ALE-34 added `?openSetup=1` and `?openQuiz=1` on `/skincare-routine`. The effect only runs when `showNewUserState === true`:

```typescript
useEffect(() => {
  if (!showNewUserState) return;
  // openSetup → RoutineSetupModal
  // openQuiz → RoutineOnboardingModal
}, [searchParams, showNewUserState]);
```

If the user lands on `/skincare-routine?openQuiz=1` (or `openSetup=1`):

1. **While loading:** full established routine page (flash).
2. **After load:** empty state appears, then modal opens (`queueMicrotask`).

This sequence matches the ticket literally: **routine page flash → then quiz/modal pops up**. Chat CTAs do **not** currently append these params (ALE-34 left that optional), but nav testing with query params or a future CTA wiring would reproduce it.

---

## Likely reproduction scenarios (ranked)

| # | Steps | Flash? | Quiz/modal? |
|---|--------|--------|-------------|
| **A** | Fresh user → floating nav **Your Skincare Routine** | Yes (loading → empty state) | No auto quiz; user must click empty-state CTA |
| **B** | Fresh user → chat **Set up my routine** | Yes (same) | No auto modal (plain URL) |
| **C** | Fresh user → `/skincare-routine?openQuiz=1` (manual / future CTA) | Yes | **Routine onboarding modal** after load |
| **D** | Fresh user → chat **Take the Skin Quiz** | No routine flash | **Full-page** `/quizzes/skin-quiz` (direct) |
| **E** | User with manual routine, no skin quiz → routine page | Maybe brief load flash | Banner **Take the skin quiz** → **skin quiz modal** (manual click) |

**Best match for the ticket text:** **A** or **C** (routine flash + something “popping up”). Confirm with Inseong whether the quiz was automatic or after a second click, and whether it was the **skin quiz** or **onboarding** flow.

---

## Product decisions (confirmed 2026-07-04)

- **All skin quiz entry points** → modal on `/skincare-routine` (no full-page legacy for signed-in users).
- **Chat “Set up my routine”** → `/skincare-routine?openSetup=1`
- **Chat “Take the Skin Quiz”** → `/skincare-routine?openSkinQuiz=1`
- Signed-in `/quizzes/skin-quiz` redirects to `openSkinQuiz=1`.

---

## Open questions for Inseong / Alex

~~Resolved — see product decisions above.~~

---

## TODO

- [x] Confirm reproduction scenario (A–E) with Inseong — flash = loading gate; modal = deep links
- [x] Decide skin-quiz CTA target — modal via `openSkinQuiz=1`
- [x] Fix new-user loading flash (`shouldShowNewUserRoutineState` / render gating)
- [x] Wire chat CTA URLs (`openSetup=1`, `openSkinQuiz=1`)
- [x] Early modal open when deep-link params present
- [x] Unit tests (frontend + backend)
- [x] E2E flow + Playwright spec updates
- [ ] Manual QA checklist
- [ ] PR(s) against `main`

## Implementation (done)

### 1. Eliminate new-user loading flash

Treat “auth ready + loading + no cached routine items” as new-user shell, not established routine chrome.

**Approach (preferred):** extend `shouldShowNewUserRoutineState` (or add a sibling helper) to accept optional `hasCachedItems` / `previousItemCount` and return `true` when loading **and** Apollo has no evidence of existing items (empty cache or explicit zero). While in that state, render:

- new-user empty state skeleton **or** a single “Loading your routine…” placeholder inside the empty-state layout — **not** the hero + AM/PM columns.

**Alternative:** gate the established branch on `!loading && itemCount > 0` instead of `!showNewUserState`.

**Tests:** extend `skincareRoutine.test.ts` + `skincareRoutinePage.test.tsx` — loading with zero items must not render “Morning routine” / hero trailing quiz buttons.

### 2. Wire chat CTAs to deep links (recommended)

**Backend** (`buildCtaButtons` in `invokeShoppingAgent.ts`, `startShoppingConversation.ts`, `getChatMessages.ts`):

| Label | Current URL | Proposed URL |
|-------|-------------|--------------|
| Set up my routine | `/skincare-routine` | `/skincare-routine?openSetup=1` |
| Take the Skin Quiz | `/quizzes/skin-quiz` | TBD per product decision (see above) |

Update backend unit tests (`invokeShoppingAgent.openingTurn.test.ts`, `getChatMessages.test.ts`, `startShoppingConversation.test.ts`).

**Frontend:** `chatMessageList.test.tsx` — assert new URLs.

### 3. Add `openSkinQuiz` deep link (if Option A)

Mirror `openSetup` / `openQuiz` effect in `skincareRoutinePage.tsx`:

- `?openSkinQuiz=1` → `setSkinQuizModalOpen(true)` once `showNewUserState` (or always, if we want retake from empty state).

Document in `e2eTestFlows/pages-graph.md`.

### 4. Open modals without waiting for full routine query (if deep links used)

When `openSetup`, `openQuiz`, or `openSkinQuiz` is present in URL:

- Open the target modal **immediately** (or show modal + spinner inside modal).
- Do **not** wait for `showNewUserState` to flip after loading.

This removes the second half of the flash-then-popup delay.

### 5. E2E coverage

New flow file `e2eTestFlows/flows/chat-cta-routine-navigation.md`:

| Case | Steps | Assert |
|------|-------|--------|
| `chat-cta-routine-01` | `resetE2eUserData` → fresh chat → **Set up my routine** | No “Morning routine” flash; setup dialog visible ≤ N s |
| `chat-cta-routine-02` | same → **Take the Skin Quiz** | Per product decision (full page vs modal) |

Spec: `playwright/tests/chat/cta-routine-navigation.spec.ts`. Cross-link in `e2eTestFlows/index.md`.

---

## Files (expected touch list)

| File | Change |
|------|--------|
| `commerce-platform-frontend/lib/skincareRoutine.ts` | Loading / new-user gating helper |
| `commerce-platform-frontend/components/skincareRoutinePage.tsx` | Render tree + early modal open from search params |
| `commerce-platform-backend/src/interactions/chat/invokeShoppingAgent.ts` | CTA URLs |
| `commerce-platform-backend/src/interactions/chat/getChatMessages.ts` | CTA URLs |
| `commerce-platform-backend/src/interactions/chat/startShoppingConversation.ts` | CTA URLs |
| `commerce-platform-frontend/src/__tests__/…` | Unit tests |
| `commerce-platform-backend/src/__tests__/interactions/chat/…` | CTA URL tests |
| `e2eTestFlows/flows/chat-cta-routine-navigation.md` | New flow |
| `e2eTestFlows/pages-graph.md` | `openSkinQuiz` if added |

---

## Verification (manual)

1. `resetE2eUserData` / new Clerk user → open chat → confirm both CTAs on opening turn.
2. Click **Set up my routine** — no flash of hero + AM/PM columns; setup modal opens (after fix + deep link).
3. Click **Take the Skin Quiz** — behavior matches chosen product option.
4. Floating nav **Your Skincare Routine** — no flash for fresh user; empty state stable.
5. `/skincare-routine?openQuiz=1` — onboarding modal without established-page flash.
6. `npm run lint && npm run build && npm test` in frontend; `npm test` in backend if CTA URLs change.

---

## Open questions for Inseong / Alex

~~Resolved — see product decisions above.~~

---

## TODO
