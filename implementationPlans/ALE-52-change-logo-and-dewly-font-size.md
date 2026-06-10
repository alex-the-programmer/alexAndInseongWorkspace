# ALE-52 Change size of logo and font size of Dewly

## Context

[Linear ALE-52](https://linear.app/dewly/issue/ALE-52/change-size-of-logo-and-font-size-of-dewly): the top-left **Dewly** lockup in the app header is visually oversized compared to the signed-in **Profile** chip on the right. Design wants the brand mark to feel balanced with that control.

**Target sizes (from ticket):**

| Element | Target |
|---------|--------|
| Logo mark | **40×40 px** |
| “Dewly” wordmark text | **35 px** font size |

**Goal:** Resize the header wordmark so its cap height aligns with the ~40 px profile control, without changing brand assets, landing hero sizing, or quiz flows.

**Repo scope:** `commerce-platform-frontend` only. No backend, scrapers, GraphQL, or database changes.

**Branch:** `ALE-52-change-logo-and-dewly-font-size` (frontend only).

**Shipped:** [commerce-platform-frontend#16](https://github.com/alex-the-programmer/commerce-platform-frontend/pull/16) (merged to `main` at `c468a61`).

**Related work:**

- [ALE-46](ALE-46-rename-hubble-to-dewly.md) — introduced `DewlyWordmark`, `lib/brand.ts` size constants, and header wiring in `layoutWithHeader.tsx`.

**Database changes:** None.

---

## Shipped implementation

| Change | Detail |
|--------|--------|
| Nav logo mark | `BRAND_WORDMARK_SIZE_NAV` **48 → 40** in `lib/brand.ts` |
| Nav wordmark text | New `BRAND_WORDMARK_TEXT_SIZE_NAV = 35`; wired via `textSize` prop on `DewlyWordmark` |
| Mobile signed-in logo | `BRAND_WORDMARK_SIZE_NAV_MOBILE` **38 → 32** |
| Component API | `DewlyWordmark` accepts optional `textSize` (defaults to `size * 1.12`) |
| Tests | Updated `brand.test.ts`, `dewlyWordmark.test.tsx`; `layoutWithHeader.test.tsx` unchanged |

---

## Current state (pre-ship)

| Layer | Location | Behavior today |
|-------|----------|----------------|
| Size constants | `lib/brand.ts` | `BRAND_WORDMARK_SIZE_NAV = 48`, `BRAND_WORDMARK_SIZE_NAV_MOBILE = 38`, `BRAND_WORDMARK_SIZE_LANDING = 64` (landing constant unused in UI today) |
| Wordmark component | `components/dewlyWordmark.tsx` | Logo mark uses `size` prop; text uses `fontSize: size * 1.12` → **~54 px** at nav size |
| Header wiring | `components/layoutWithHeader.tsx` | Passes `wordmarkSize` from brand constants into `<DewlyWordmark size={…} linkHome />` |
| Profile chip (desktop) | `components/headerUserMenu.tsx` | Trigger avatar **32×32** + **6 px** vertical padding → ~**44 px** tall; dropdown header avatar **40×40** |
| Profile chip (mobile) | `app/globals.css` | Avatar overridden to **28×28**; wordmark **text hidden** (`.commerceWordmark__text { display: none }`) |
| Signed-out mobile home | `layoutWithHeader.tsx` | Uses **full** `BRAND_WORDMARK_SIZE_NAV` (not mobile compact) because user is not signed in |

**Visual gap:** Nav logo at 48 px and text at ~54 px reads larger/heavier than the profile pill the ticket references (~40 px).

---

## Gap analysis

| Area | Today | Target (ALE-52) |
|------|-------|-----------------|
| Nav logo mark | 48 px | **40 px** |
| Nav “Dewly” text | ~54 px (`48 × 1.12`) | **35 px** (explicit, not derived) |
| Mobile signed-in logo | 38 px | **32 px** (proportional shrink; text already hidden) |
| Mobile signed-out logo | 48 px (same as nav) | **40 px** (follows updated nav constant) |
| Landing / quiz logos | Unchanged sizes in quiz runner | **Out of scope** |
| Profile chip | Unchanged | **Out of scope** |

---

## Design decisions

### Nav-only text size override (locked)

The ticket specifies **35 px** text with a **40 px** logo. The existing `size * 1.12` ratio cannot hit both targets.

- Add `BRAND_WORDMARK_TEXT_SIZE_NAV = 35` in `lib/brand.ts`.
- Add optional `textSize?: number` to `DewlyWordmark`. When provided, use it for `.commerceWordmark__text`; when omitted, keep `size * 1.12` for any future non-nav callers.
- `layoutWithHeader.tsx` passes `textSize={BRAND_WORDMARK_TEXT_SIZE_NAV}` always (harmless on mobile where CSS hides text).

### Update brand constants, not inline magic numbers (locked)

```ts
export const BRAND_WORDMARK_SIZE_NAV = 40;
export const BRAND_WORDMARK_TEXT_SIZE_NAV = 35;
export const BRAND_WORDMARK_SIZE_NAV_MOBILE = 32;
```

`BRAND_WORDMARK_SIZE_LANDING` stays **64** — not part of this ticket.

### Mobile compact logo (locked)

Signed-in mobile shows **logo only** in a tight single-row header next to compact nav pills and the profile chip (28 px avatar). Reduce `BRAND_WORDMARK_SIZE_NAV_MOBILE` from 38 → **32** so the mark does not dominate the row. This is a proportional adjustment; ticket screenshots focus on desktop alignment.

### Do not change quiz / chat orb sizes (locked)

`quizRunner.tsx` uses standalone `DewlyLogoMark` at 28 / 48 px. Leave those untouched — different surfaces, different hierarchy.

### No CSS-only override in `globals.css` (locked)

Keep sizing in `lib/brand.ts` + component props so tests and future callers stay centralized. Header layout CSS (`commerceAppHeader`, wordmark text hide on mobile) stays as-is.

---

## Implementation plan

### 1. Brand constants

**File:** `lib/brand.ts`

1. Set `BRAND_WORDMARK_SIZE_NAV = 40`.
2. Add `BRAND_WORDMARK_TEXT_SIZE_NAV = 35`.
3. Set `BRAND_WORDMARK_SIZE_NAV_MOBILE = 32`.

### 2. Wordmark component

**File:** `components/dewlyWordmark.tsx`

1. Extend props:

```ts
type DewlyWordmarkProps = {
  size?: number;
  textSize?: number;
  linkHome?: boolean;
};
```

2. Compute text font size:

```ts
const wordmarkTextSize = textSize ?? size * 1.12;
```

3. Apply `wordmarkTextSize` to `.commerceWordmark__text` `fontSize`.

### 3. Header wiring

**File:** `components/layoutWithHeader.tsx`

1. Import `BRAND_WORDMARK_TEXT_SIZE_NAV`.
2. Update render:

```tsx
<DewlyWordmark
  size={wordmarkSize}
  textSize={BRAND_WORDMARK_TEXT_SIZE_NAV}
  linkHome
/>
```

No other call sites need changes today.

### 4. Tests

**File:** `src/__tests__/lib/brand.test.ts`

- Assert `BRAND_WORDMARK_SIZE_NAV === 40`.
- Assert `BRAND_WORDMARK_TEXT_SIZE_NAV === 35`.
- Assert mobile nav size `<` nav size and `>= 32` (replace the old `>= 44` guard).

**File:** `src/__tests__/components/dewlyWordmark.test.tsx`

- Add case: `textSize={35}` with `size={40}` renders text at 35 px (inspect computed style or `style.fontSize`).
- Existing logo height assertion stays valid with explicit `size` prop.

**File:** `src/__tests__/components/layoutWithHeader.test.tsx`

- Existing tests that query `img[height="${BRAND_WORDMARK_SIZE_NAV}"]` / mobile constant should pass after constant updates (no test logic change expected).

### 5. Verification

```bash
cd commerce-platform-frontend
npm run lint && npm run build
npm test -- --testPathPattern="brand|dewlyWordmark|layoutWithHeader"
```

**Manual QA:**

1. **Desktop, signed in** (`/chat` or `/skincare-routine`): Dewly lockup height feels even with the profile chip; logo ~40 px, text readable at ~35 px.
2. **Desktop, signed out** (`/`): lockup still balanced next to Log in / Get started.
3. **Mobile, signed in**: logo-only mark fits the single-row header without crowding nav pills or profile name.
4. **Mobile, signed out** (`/`): logo at 40 px; text still hidden.
5. **Quiz** (`/quizzes/skin-quiz`): quiz header logo sizes unchanged.

---

## File checklist

| File | Action |
|------|--------|
| `lib/brand.ts` | Update nav + mobile logo sizes; add nav text size constant |
| `components/dewlyWordmark.tsx` | Optional `textSize` prop |
| `components/layoutWithHeader.tsx` | Pass `textSize` from brand constant |
| `src/__tests__/lib/brand.test.ts` | Update size assertions |
| `src/__tests__/components/dewlyWordmark.test.tsx` | Cover `textSize` prop |
| `src/__tests__/components/layoutWithHeader.test.tsx` | Should pass unchanged (uses imported constants) |

**No changes:** `headerUserMenu.tsx`, `quizRunner.tsx`, `app/globals.css` (unless visual QA reveals overflow — unlikely), backend.

---

## Out of scope

- Replacing logo PNG/SVG assets
- Resizing landing hero wordmark (`BRAND_WORDMARK_SIZE_LANDING`)
- Quiz runner / chat assistant orb sizes
- Profile chip dimensions
- Signed-out desktop showing a smaller wordmark than signed-in (both use the same nav constant today)

---

## TODO

- [x] Create branch `ALE-52-change-logo-and-dewly-font-size` off latest `main`
- [x] Update `lib/brand.ts` constants (40 / 35 / 32)
- [x] Add `textSize` prop to `DewlyWordmark` and wire in `layoutWithHeader.tsx`
- [x] Update unit tests (`brand`, `dewlyWordmark`, confirm `layoutWithHeader` passes)
- [x] `npm run lint`, `npm run build`, `npm test` in frontend
- [ ] Manual QA per checklist (desktop + mobile, signed in/out)
- [x] Open PR against `main` in `commerce-platform-frontend`
- [x] Merge PR and bump frontend submodule on workspace `main`
