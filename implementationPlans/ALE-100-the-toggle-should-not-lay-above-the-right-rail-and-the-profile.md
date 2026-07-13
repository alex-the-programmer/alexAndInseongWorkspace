# ALE-100 — Fix header chrome layering above recommendations drawer

## Context

[Linear ALE-100](https://linear.app/dewly/issue/ALE-100/the-toggle-should-not-lay-above-the-right-rail-and-the-profile)

Screenshot (attached in Linear) shows the **recommendations drawer** open on `/skincare-routine` while **header chrome** still paints on top:

- **FloatingNavPill** (Chat / Routine toggle) overlaps the drawer in the top-right band
- **HeaderUserMenu** profile dropdown extends over the drawer panel when open

**Repos:**

| Repo | Role |
|------|------|
| `commerce-platform-frontend` | Fix drawer stacking + z-index tokens |
| Workspace root | This plan + E2E flow doc |

**Branch:** `alexmtruecar/ale-100-the-toggle-should-not-lay-above-the-right-rail-and-the`

**Database changes:** None.

**Related (out of scope unless discovered during fix):**

- [ALE-34](ale-34-routine-page-redesign.md) — introduced `RecommendationsDrawer` and routine page shell
- [ALE-103](ALE-103-clicking-on-buy-does-not-take-the-user-anywhere.md) — drawer Buy behavior (same surface, different bug)
- [ALE-101](ALE-101-button-style-is-broken.md) — drawer Buy button layout

---

## Problem summary

| Surface | Symptom |
|---------|---------|
| `/skincare-routine` with recommendations drawer open | Fixed header (nav pill + account menu) renders **above** the right-rail drawer |
| Profile dropdown open while drawer open | Dropdown menu appears **above** the drawer panel |

### Terminology

| Term in ticket | Component | File |
|----------------|-----------|------|
| **Toggle** | `FloatingNavPill` — Chat / Routine nav pill in fixed header | `components/floatingNavPill.tsx` |
| **Right rail / side rail** | `RecommendationsDrawer` — fixed right panel | `components/recommendationsDrawer.tsx` |
| **Profile dropdown** | `HeaderUserMenu` account menu | `components/headerUserMenu.tsx` |

Secondary “toggle” on the same page: AM/PM `SlotToggle` inside the drawer and on the main routine list — **not** the bug in the screenshot (those are inside the drawer once layering is fixed).

### Current layout hierarchy

```
LayoutWithHeader
├── .commerceAppHeader                    z-index: 100  (globals.css --z-header)
│   ├── FloatingNavPill                   ← “toggle”
│   └── HeaderUserMenu                    dropdown z-index: 200 (local to header)
│
└── SkincareRoutinePage
    └── .commerceRoutinePageShell
        ├── .commerceAmbient              z-index: 0
        └── .commerceRoutinePageShell__content   z-index: 1  ← stacking context trap
            ├── RecommendationsDrawer     fixed z-index: 200/201 (capped by parent)
            ├── OverlayModal (quiz/setup) fixed z-index: 200/210 (same trap)
            └── .commerceRoutinePage
```

### Root cause

**Stacking context trap on routine page content.**

`.commerceRoutinePageShell__content` uses `position: relative; z-index: 1` so page content stacks above `.commerceAmbient` (`z-index: 0`). That creates a stacking context that **caps** all descendants — including `RecommendationsDrawer` at inline `z-index: 200/201 — at an effective global level of **1**.

The fixed header sits at **100**, so header chrome always wins where it overlaps the drawer (top ~72px, right ~520px).

The profile dropdown’s inline `zIndex: 200` only applies **within** the header’s stacking context; globally it still competes as part of the header layer (100), which is already above the trapped drawer.

### Reference implementation (works today)

Chat mobile chats drawer in `components/chatPage.tsx`:

- Rendered as a **sibling** of `.commerceChatPage__content`, not inside the `z-index: 1` wrapper
- `top: FLOATING_NAV_TOP_OFFSET_VAR` (starts below header band)
- Backdrop `z-index: 140`, panel `z-index: 150` — both above `--z-header: 100`

`RecommendationsDrawer` should follow the same layering contract.

---

## Solution

### 1. Portal `RecommendationsDrawer` to `document.body`

Mirror `components/quizSuggestionInput.tsx` (`createPortal(..., document.body)`):

- Render backdrop + `<aside role="dialog">` through a portal when `open`
- Guard SSR: only portal when `typeof document !== "undefined"`
- Keep `if (!open) return null` early exit

This escapes `.commerceRoutinePageShell__content`’s stacking context without changing ambient glow behavior.

### 2. Centralize z-index tokens for overlays

In `app/globals.css`, extend the existing scale:

```css
:root {
  --z-header: 100;
  --z-drawer-backdrop: 140;
  --z-drawer: 150;
  --z-landing-wall-open: 150;
  --z-modal: 200;
}
```

Replace hardcoded `200` / `201` in `recommendationsDrawer.tsx` with `var(--z-drawer-backdrop)` and `var(--z-drawer)`.

Align chat mobile drawer inline values to the same tokens in a follow-up or same PR if trivial (reduces drift).

**Layering intent:**

| Layer | Token | Value |
|-------|-------|-------|
| Header | `--z-header` | 100 |
| Drawer backdrop | `--z-drawer-backdrop` | 140 |
| Drawer panel | `--z-drawer` | 150 |
| Centered modals | `--z-modal` | 200 |

Drawer (150) > header (100). Centered modals (200) > drawer when both could appear (rare; quiz modals usually close before opening recs drawer).

### 3. Offset drawer below the header band

Change drawer panel + backdrop positioning to match chat:

```ts
top: FLOATING_NAV_TOP_OFFSET_VAR,  // var(--commerce-floating-nav-top-offset) = 72px
bottom: 0,
// backdrop: same top offset, not inset: 0
```

Import `FLOATING_NAV_TOP_OFFSET_VAR` from `components/floatingNavPill.tsx` (already used on routine page shell padding).

This prevents the drawer from occupying the header band even after z-index is fixed — consistent with chat side rail.

### 4. Body scroll lock (optional but recommended)

When drawer is open, set `document.body.style.overflow = "hidden"` (same pattern as `overlayModal.tsx`). Restore on close/unmount. Prevents background scroll bleed on mobile.

### 5. Close profile dropdown when drawer opens (UX polish)

In `HeaderUserMenu`, listen for drawer open via a lightweight approach:

- **Preferred:** pass `recommendationsDrawerOpen` from `skincareRoutinePage.tsx` into `LayoutWithHeader` → `HeaderUserMenu` as `forceClose?: boolean`, OR
- **Simpler:** `useEffect` in `HeaderUserMenu` that closes menu on `pathname` change (already may exist) + document `pointerdown` outside — verify existing behavior

If portaling fixes the visual bug, forced close is **nice-to-have** (dropdown shouldn’t be reachable over drawer). Minimum bar: drawer covers header; dropdown cannot paint above drawer.

### 6. Audit `OverlayModal` (defer unless reproducing)

`OverlayModal` (`components/overlayModal.tsx`) is also rendered inside `.commerceRoutinePageShell__content` with `z-index: 200/210` and suffers the same trap. Centered quiz/setup modals may not visibly overlap the header, so **do not refactor in this ticket** unless manual QA shows header over modal chrome. If needed later: portal `OverlayModal` the same way.

**Do not** remove `z-index: 1` from `.commerceRoutinePageShell__content` as the primary fix — that risks regressing ambient glow stacking on routine and chat pages.

---

## Files changed (frontend)

| File | Change |
|------|--------|
| `components/recommendationsDrawer.tsx` | Portal to `document.body`; top offset; CSS var z-index; body scroll lock |
| `app/globals.css` | Add `--z-drawer-backdrop`, `--z-drawer`; document layering scale in comment |
| `components/floatingNavPill.tsx` | No change expected (export already exists) |
| `components/headerUserMenu.tsx` | Optional: close menu when overlay drawer open |
| `src/__tests__/components/recommendationsDrawer.test.tsx` | Assert portal target + top offset + z-index tokens |
| `playwright/tests/routine/recommendation-drawer-layering.spec.ts` | **New** E2E layering case |
| `playwright/helpers/routineRecommendations.ts` | Reuse open-drawer helper from ALE-103 if present |

**Workspace (E2E docs):**

| File | Change |
|------|--------|
| `e2eTestFlows/flows/routine-recommendation-drawer-layering.md` | New flow case |
| `e2eTestFlows/index.md` | Cross-link P1 case |

---

## Tests

### Unit (Jest + RTL)

| File | Case |
|------|------|
| `recommendationsDrawer.test.tsx` | When open, backdrop + dialog render under `document.body` (not inside test container only) |
| `recommendationsDrawer.test.tsx` | Dialog `style.top` uses `var(--commerce-floating-nav-top-offset)` |
| `recommendationsDrawer.test.tsx` | Existing Buy / close / slot toggle tests still pass |

Example portal assertion:

```ts
renderDrawer();
expect(document.body.querySelector('[aria-label="Your custom routine"]')).toBeInTheDocument();
```

### E2E (required — user-visible bug)

Per workspace TDD rule: add Playwright repro **before or alongside** the fix.

| Case id | Flow file | Spec |
|---------|-----------|------|
| `routine-drawer-layering-01` | `routine-recommendation-drawer-layering.md` | Open recommendations drawer → header nav pill and account trigger are **not** the topmost element over the drawer panel |

**Stable assertions (no LLM):**

1. Sign in → `/skincare-routine` → open **View recommendations** (reuse seeding from `routine-recommendation-buy` helper or manual routine + quiz if needed)
2. `page.locator('[aria-label="Your custom routine"]')` visible
3. `elementFromPoint` at coordinates inside drawer header (e.g. top-right of dialog, below nav offset) returns an element **inside** the drawer, not `.commerceFloatingNav` or `.commerceHeaderUserMenu__trigger`
4. Optional: open account menu, repeat `elementFromPoint` over drawer body — menu must not be topmost

Skip when no recommendations to show (same pattern as ALE-103).

### Manual verification

1. `/skincare-routine` → open recommendations drawer
2. Confirm Chat/Routine pill does **not** overlap drawer top-right
3. Open profile dropdown while drawer open — menu should be **behind** drawer or auto-closed
4. Resize to mobile width — drawer still clears header band
5. Close drawer — header interactions normal
6. Regression: drawer Buy, AM/PM toggle inside drawer, backdrop click to close

---

## Implementation order

1. Add E2E flow doc + Playwright spec (expect **red** on main)
2. Add CSS z-index tokens
3. Portal + position + z-index in `recommendationsDrawer.tsx`
4. Unit tests
5. Confirm E2E **green**
6. `npm run lint`, `npm test`, `npm run build` in frontend

---

## Out of scope

- Portaling `OverlayModal` (unless QA finds visible header-over-modal bug)
- Chat `ChatHelpToggle` footer toggle (different surface)
- Changing header `z-index` or nav pill layout
- Removing `.commerceRoutinePageShell__content { z-index: 1 }` globally
- Profile dropdown portal to body (only needed if dropdown still leaks after drawer fix — unlikely)

---

## TODO

- [x] Reproduce locally: open recommendations drawer, confirm header overlap
- [x] Add `e2eTestFlows/flows/routine-recommendation-drawer-layering.md` + index cross-link
- [x] Add Playwright `routine-drawer-layering-01` (red before fix)
- [x] Add `--z-drawer-backdrop` / `--z-drawer` to `globals.css`
- [x] Portal `RecommendationsDrawer` to `document.body` with header top offset
- [x] Replace inline z-index with CSS variables
- [x] Add body scroll lock when drawer open
- [x] Extend `recommendationsDrawer.test.tsx` (portal + top offset)
- [x] Run `npm test`, `npm run lint`, `npm run build` in frontend
- [x] Confirm Playwright case green
- [ ] (Optional) Close `HeaderUserMenu` when drawer opens
- [ ] Open frontend PR on `alexmtruecar/ale-100-the-toggle-should-not-lay-above-the-right-rail-and-the`
