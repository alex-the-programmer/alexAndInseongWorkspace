# ALE-51 Skincare routine — widen page layout

## Context

[Linear ALE-51](https://linear.app/dewly/issue/ALE-51/make-the-layout-of-the-routine-page-wider-so-that-we-can-fit-more-and): the signed-in `/skincare-routine` page used a **720px** centered column, leaving large empty margins on desktop.

**Goal:** Widen the routine page shell on desktop so the hero and routine list use more horizontal space. Recommendations stay in the **overlay drawer** on all breakpoints.

**Repo scope:** `commerce-platform-frontend` only. No backend, scrapers, or database changes.

**Branch:** `ALE-51-skincare-routine-wide-layout` (frontend only).

**Shipped:** [commerce-platform-frontend#13](https://github.com/alex-the-programmer/commerce-platform-frontend/pull/13) (merged to `main` at `8d57483`).

---

## Shipped implementation

| Change | Detail |
|--------|--------|
| Page shell | `.commerceRoutinePage` `max-width` **720px → 1200px** in `app/globals.css` (matches chat) |
| Layout | Single column unchanged; recommendations drawer unchanged |
| Nav polish (same PR) | Desktop floating nav routine segment: shrink-wrap tabs + extra right padding via inline styles in `floatingNavPill.tsx` |
| Tests | `src/__tests__/styles/routinePageLayout.test.ts`; desktop padding assertions in `floatingNavPill.test.tsx` |

**Not shipped (out of scope):** inline two-column recommendations panel on desktop. That was explored during implementation and reverted after ticket clarification.

---

## Files changed

| File | Change |
|------|--------|
| `app/globals.css` | Widen `.commerceRoutinePage`; desktop `flex: 0 1 auto` on nav segments |
| `components/floatingNavPill.tsx` | Desktop segment padding constants + inline layout |
| `src/__tests__/styles/routinePageLayout.test.ts` | **New** — CSS regression for 1200px shell |
| `src/__tests__/components/floatingNavPill.test.tsx` | Desktop padding + shrink-wrap tests |

---

## Verification

1. Desktop: routine page content column up to ~1200px wide (was 720px).
2. Recommendations still open in drawer from banner / section link / `openRecs=1`.
3. Mobile layout unchanged.
4. Empty state still uses narrow card (`max-width: 720px` inline on `NewUserRoutineEmptyState`).

---

## Out of scope

- Inline recommendations column on desktop (v2 if requested)
- Changing recommendation generation or GraphQL
- Widening beyond 1200px to mock `1320px`

---

## TODO

- [x] Confirm ALE-51 acceptance criteria: widen-only (no inline recs column)
- [x] Widen `.commerceRoutinePage` to `1200px` in `app/globals.css`
- [x] Revert two-column / inline `RecommendationsPanel` work
- [x] Unit tests (`routinePageLayout`, `floatingNavPill`, existing routine/drawer tests)
- [x] Manual QA: desktop routine page uses ~1200px column; drawer unchanged
- [x] `npm run build && npm test` in frontend
