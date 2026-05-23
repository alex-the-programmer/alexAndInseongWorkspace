# ALE-34 Your Skin Routine — New User

## Context

[Linear ALE-34](https://linear.app/alexandinseongprojects/issue/ALE-34/your-skin-routine-new-user): when a signed-in user has not set up a routine yet, `/skincare-routine` should show a dedicated **new-user empty state** (see issue screenshot) instead of the full AM/PM routine editor.

Interactions:

- **Set up my routine** → opens a **routine setup popup** (AM/PM step picker — same UX as the skin quiz’s `ROUTINE_STEPS` question).
- **I don't have one** → opens the **skin quiz in a popup** (full `QuizRunner` flow, not a full-page navigation).

**Repo scope:** `commerce-platform-frontend` only. No backend, scrapers, or database changes (use existing `addRoutineItem`, quiz mutations, and `myRoutine` query).

**Branch:** `ALE-34-your-skin-routine-new-user` (per Linear git branch name).

**Depends on (soft):** [ALE-31](implementationPlans/ALE-31-re-theme-navigation.md) floating top pill on `/skincare-routine` — empty state and modals must clear the pill band (`FLOATING_NAV_TOP_OFFSET`). If ALE-31 is not merged yet, implement against current layout or the in-flight branch.

---

## Current State

| Area | Today |
|------|--------|
| `/skincare-routine` | `SkincareRoutinePage` always renders hero card + AM/PM columns after sign-in |
| Empty routine | Same UI as users with items; columns show “No products in this column yet.” |
| Quiz entry | Hero trailing **Take skin quiz** navigates to `/quizzes/skin-quiz` (full page) |
| Routine setup | Only via per-product `ProductLookupInput` in columns, or quiz `ROUTINE_STEPS` answer stored in quiz response (not auto-synced to `myRoutine` items) |
| Modals | No shared modal; `chatPage` uses fixed drawer pattern (`role="dialog"`) |
| Chat CTAs | Backend already links **Set up my routine** → `/skincare-routine` when routine is empty (`startShoppingConversation.helpers`) |

**New-user detection elsewhere (align with this):**

```typescript
// commerce-platform-backend — routine “empty”
routine.status === "missing" || (routine.status === "present" && routine.items.length === 0)
```

Frontend equivalent after `useMyRoutineQuery` resolves: `routineItems.length === 0`.

---

## Gap Analysis

| Area | Today | Target (ALE-34) |
|------|-------|-----------------|
| First visit to routine | Full editor with empty columns | Centered **new-user** panel with headline, short copy, two actions |
| Set up my routine | N/A on page (only chat CTA) | Modal with AM/PM step grid; save creates **MANUAL** `RoutineItem`s |
| I don't have one | Navigate to full-page quiz | Modal embedding **full** skin quiz |
| After setup / quiz | N/A | Dismiss modal, refetch, show existing hero + columns UI |
| Hero copy when empty | “Here's the routine I built for you” | Hidden until user has ≥1 routine item (or post-quiz full view) |

---

## Design Spec (New-User Empty State)

Match the Linear screenshot ([attachment on ALE-34](https://linear.app/alexandinseongprojects/issue/ALE-34/your-skin-routine-new-user)). If copy differs in the mock, use the mock as source of truth during implementation.

**Layout (signed-in, `routineItems.length === 0`, not loading):**

```
┌─────────────────────────────────────────────┐
│         [floating nav pill — ALE-31]        │
├─────────────────────────────────────────────┤
│                                             │
│     Your skin routine          (display)    │
│     Short supporting line (muted)           │
│                                             │
│     ┌─────────────────────────────┐       │
│     │     Set up my routine         │       │  ← primary Button
│     └─────────────────────────────┘       │
│                                             │
│     I don't have one                        │  ← text button / link
│                                             │
└─────────────────────────────────────────────┘
```

**Tokens:** `theme.font.display` for headline, `theme.colors.textMuted` for body, existing `Button` primary + ghost/outline for secondary.

**Do not show** on empty state: hero “built for you” card, AM/PM toggle, routine columns, **Take skin quiz** in hero (quiz is the secondary path).

---

## Design Spec (Modals)

### Shared `OverlayModal`

New `components/overlayModal.tsx` (name flexible):

- Fixed backdrop `rgba(0,0,0,0.5)`, `zIndex` above page content, below global modals if any
- Centered panel (routine setup) or near-full-viewport panel (quiz)
- `role="dialog"`, `aria-modal="true"`, labelled title
- Close control (×) and backdrop click → `onClose`
- `Escape` closes (mirror `chatPage` drawer pattern)
- Body scroll locked while open

### Routine setup modal

- Title: e.g. **Set up your routine** (confirm from mock)
- Subtitle: reuse quiz prompt — “Which steps are already in your routine?”
- Body: **Routine step picker** (same UI as `RoutineInput` in `quizRunner.tsx`)
- Footer: **Cancel** + **Save routine** (disabled until ≥1 step selected AM or PM)
- On save: persist steps → close → `refetch()` `myRoutine`

### Quiz modal

- Large panel (~`min(960px, 100vw - 32px)`, `max-height: calc(100svh - 48px)`, scroll inside)
- Embed `<QuizRunner quizPath="skin-quiz" variant="embedded" onFinished={...} />`
- Results phase: **Done** button (not “Go to chat →”) calls `onFinished` and closes modal
- Optional: skip intro in embedded mode and start at first question if user already has in-progress response — match full-page retake behavior via existing `beginQuiz` logic

---

## Decisions

### When to show new-user state

- **Show** when: `authReady && !loading && !error && routineItems.length === 0`
- **Hide** when: any routine item exists (MANUAL or RECOMMENDED)
- **Do not** use quiz completion alone to exit empty state (user may finish quiz but still have zero items until they generate/add products)

### Routine setup persistence (v1 — frontend only)

- Load `ROUTINE_STEPS` question config from `useQuizByUrlQuery({ url: "skin-quiz" })` (question `key === "routine"`).
- On save, for each selected step key in `am` / `pm`:
  - `addRoutineItem` with `timeOfDay: AM | PM`, `stepKey: <config key>`, `customProductName: <step label>`, `source: MANUAL`
- Run mutations **sequentially** (or `Promise.all` if ordering irrelevant). No new bulk API in this ticket.
- Skip keys already present if user re-opens setup (optional dedupe by `stepKey` + `timeOfDay`).

### QuizRunner embedding

- Add props to `QuizRunner`:

```typescript
type QuizRunnerProps = {
  quizPath?: string;
  variant?: "page" | "embedded";
  onFinished?: () => void;
};
```

- `embedded`: no `minHeight: 100svh` on outer wrapper; progress header `position: sticky` inside modal instead of `fixed` to viewport; results footer shows **Done** → `onFinished()` instead of chat link (or in addition, mock-dependent).
- Full-page `/quizzes/skin-quiz` unchanged (`variant` defaults to `"page"`).

### Deep link from chat (optional, recommended)

- Support `?openSetup=1` and `?openQuiz=1` on `/skincare-routine` to auto-open the matching modal once after load (chat CTA lands on routine page). Keeps chat buttons as plain `/skincare-routine` URLs without frontend router state in GraphQL.

### Out of scope

- Syncing quiz `ROUTINE_STEPS` answers into `myRoutine` automatically on quiz complete
- New GraphQL mutations or Prisma schema
- Changing chat CTA labels/URLs (already **Set up my routine**)
- Redesigning the populated routine page hero (only gating when empty)
- Notification bell, profile menu, sign-out (other tickets)

---

## Implementation Plan

### 1. Extract routine step picker + helpers

- Move to `components/routineStepPicker.tsx` (or `lib/routineSteps.ts` + presentational component):
  - `getRoutineGroups(question)` (from `quizRunner.tsx`)
  - `RoutineStepPicker` (exported UI from `RoutineInput`)
  - `isRoutineAnswerComplete(answer)`
- Update `quizRunner.tsx` to import `RoutineStepPicker` (no behavior change on `/quizzes/*`).

### 2. Persist routine answer helper

- `lib/persistRoutineSteps.ts`:

```typescript
export async function persistRoutineSteps(
  answer: RoutineAnswer,
  groups: { am: StepGroupOption[]; pm: StepGroupOption[] },
  addRoutineItem: (vars) => Promise<unknown>,
  existingItems?: { stepKey: string; timeOfDay: RoutineTimeOfDay }[]
): Promise<void>
```

- Map `am`/`pm` keys → labels from `groups`; call `addRoutineItem` for each new step.
- Unit tests in `src/__tests__/lib/persistRoutineSteps.test.ts`.

### 3. `OverlayModal` component

- Implement `components/overlayModal.tsx` with tests for open/close, aria attributes, and `onClose` on Escape (mock `keydown`).

### 4. `RoutineSetupModal`

- `components/routineSetupModal.tsx`:
  - Fetches routine question via `useQuizByUrlQuery`
  - Local state for `RoutineAnswer`
  - Save → `persistRoutineSteps` → `onSaved` / close
  - Loading/error states for missing quiz config

### 5. `QuizModal` wrapper

- `components/quizModal.tsx`: `OverlayModal` + `QuizRunner` embedded + `onFinished` closes and notifies parent.

### 6. Extend `QuizRunner` for embedded mode

- `variant === "embedded"`: layout/sticky header/results **Done** behavior
- Call `onFinished` after successful complete when user taps **Done** on results (and optionally after intro “Retake” completes — only if product wants; default: **Done** on results only)

### 7. Refactor `SkincareRoutinePage`

- Export pure helper:

```typescript
export function shouldShowNewUserRoutineState(
  authReady: boolean,
  loading: boolean,
  error: unknown,
  itemCount: number
): boolean
```

- Render tree:
  1. Signed-out gate (unchanged)
  2. Loading / error (unchanged)
  3. **New-user empty state** when `shouldShowNewUserRoutineState`
  4. Existing full routine UI otherwise
- State: `setupModalOpen`, `quizModalOpen`
- `useSearchParams`: open modals from `?openSetup=1` / `?openQuiz=1`
- Wire buttons to set modal open

### 8. Tests

| File | Coverage |
|------|----------|
| `skincareRoutineHelpers.test.ts` | Extend with `shouldShowNewUserRoutineState` |
| `persistRoutineSteps.test.ts` | AM/PM mapping, dedupe, empty answer rejected |
| `routineSetupModal.test.tsx` | Save disabled until selection; calls persist |
| `skincareRoutinePage.test.tsx` (new) | Empty state CTAs; modals open; full UI when items mock present |

Use existing RTL + Apollo mock patterns from `chatMessageList.test.tsx` / `floatingNavPill.test.tsx`.

### 9. Pre-push validation

In `commerce-platform-frontend`:

```bash
npm run lint && npm run build && npm test
```

---

## Files (expected touch list)

| File | Change |
|------|--------|
| `components/skincareRoutinePage.tsx` | New-user branch, modals, helpers |
| `components/overlayModal.tsx` | **New** shared dialog shell |
| `components/routineSetupModal.tsx` | **New** setup popup |
| `components/quizModal.tsx` | **New** quiz popup wrapper |
| `components/routineStepPicker.tsx` | **New** extracted picker (or `lib/` + thin component) |
| `components/quizRunner.tsx` | `variant` / `onFinished`; import picker |
| `lib/persistRoutineSteps.ts` | **New** save helper |
| `src/__tests__/components/skincareRoutineHelpers.test.ts` | New-user helper tests |
| `src/__tests__/lib/persistRoutineSteps.test.ts` | **New** |
| `src/__tests__/components/routineSetupModal.test.tsx` | **New** (optional if covered by page test) |
| `src/__tests__/components/skincareRoutinePage.test.tsx` | **New** |

**Out of scope:** `commerce-platform-backend`, `commerce-platform-scrapers`, `graphql` schema changes.

---

## Verification (manual)

1. `npm run dev` in `commerce-platform-frontend`
2. Sign in as user with **zero** routine items → `/skincare-routine` shows new-user empty state (not columns)
3. **Set up my routine** → modal with AM/PM steps; select steps → Save → modal closes → columns appear with MANUAL items
4. Reset user / new account → **I don't have one** → quiz modal; complete quiz → **Done** → modal closes → full routine page with **Take skin quiz** / **Build custom…** per quiz status (existing hero logic)
5. User with existing routine items → lands on full page (no empty state)
6. `/skincare-routine?openSetup=1` opens setup modal once (if implemented)
7. Chat CTA **Set up my routine** → routine page → can complete flow without hunting for buttons
8. Floating nav pill still visible and tappable above empty state (ALE-31)
9. Keyboard: Escape closes modals; focus not trapped broken
10. Mobile ~375px: modals scroll, buttons tappable
11. `npm run lint && npm run build && npm test` pass

---

## TODO

- [x] Confirm exact headline/body/button copy against Linear screenshot
- [x] Extract `RoutineStepPicker` + `getRoutineGroups` from `quizRunner.tsx`
- [x] Add `lib/persistRoutineSteps.ts` + unit tests
- [x] Add `overlayModal.tsx` + unit tests
- [x] Add `routineSetupModal.tsx`
- [x] Add `quizModal.tsx`; extend `QuizRunner` with `variant` / `onFinished`
- [x] Refactor `skincareRoutinePage.tsx` (empty state, modals, `shouldShowNewUserRoutineState`)
- [x] Optional: `?openSetup=1` / `?openQuiz=1` search-param deep links
- [x] Add/update component tests; `npm run build`, `npm test`
- [ ] Manual QA per checklist above
