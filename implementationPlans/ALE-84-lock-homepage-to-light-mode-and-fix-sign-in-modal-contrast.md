# ALE-84 Lock homepage to light mode and fix sign-in modal contrast

## Context

[Linear ALE-84](https://linear.app/dewly/issue/ALE-84/lock-homepage-to-light-mode-and-fix-sign-in-modal-contrast)

The commerce landing page and sign-up/sign-in wall (`SignUpWall`) were designed **light-mode-first**: white and frosted-white surfaces, warm `--ink-*` muted text, and hardcoded `#fff` backgrounds on OAuth buttons and form fields.

Dark mode flips global tokens such as `--text-primary` and `body { color: var(--foreground) }` to white. Elements on light surfaces that do not set their own text color inherit white — producing invisible labels (e.g. **Continue with Google**, email placeholder, modal title).

Broader homepage dark mode is **not ready**: chips, value cards, hero input, and “How it works” row all share the same pattern. Rather than ship a partial dark landing, **the homepage is locked to light mode for now**. Dark mode remains available on `/chat`, `/skincare-routine`, and other signed-in routes.

**Repos:**

| Repo | Role |
|------|------|
| `commerce-platform-frontend` | Theme lock, sign-in wall CSS, tests |
| Workspace root | This plan |

**Database changes:** None.

**Out of scope (follow-up):**

- Full dark-mode landing page (elevated surfaces, `--ink-*` dark tokens, chip/card restyling)
- Dark-mode sign-up wall card (modal can stay light while home is light-only; contrast fixes still help if wall opens from dark routes later)

---

## Problem summary

| Surface | Symptom in dark mode |
|---------|----------------------|
| Google OAuth button | White text on `#fff` button background |
| Email input (sign-in wall) | White placeholder/text on light input background |
| Landing value cards / how-it-works | White `--text-primary` on frosted white cards |
| Homepage overall | Light-only design conflicts with user/system dark preference |

---

## Solution

### 1. Sign-in wall contrast (light surfaces)

In `app/globals.css`, scope readable text onto the always-light modal:

- `.commerceSignUpWall__card` — `color: var(--black)`
- `.commerceSignUpWall__oauthBtn` — `color: var(--black)` (Apple button keeps its own override)
- `.commerceSignUpWall__form input` — `color: var(--black)` and `::placeholder { color: var(--ink-3) }`

### 2. Light-only homepage route

New `lib/lightOnlyRoutes.ts`:

```ts
export const LIGHT_ONLY_ROUTES = ["/"] as const;
export function isLightOnlyRoute(pathname: string | null): boolean;
```

`components/themeContext.tsx`:

- Read `usePathname()`
- When `isLightOnlyRoute(pathname)`, force `document.documentElement.classList.remove("dark")` regardless of stored preference or system theme
- Ignore `setTheme()` on light-only routes (do not overwrite localStorage)
- When navigating away from `/`, re-apply stored preference

`app/layout.tsx` inline theme script — on initial paint, skip dark class when `window.location.pathname === '/'` (prevents flash before hydration).

### 3. Hide theme toggle on home

`components/headerAuthActions.tsx` — remove `<ThemeToggle />` (home header is signed-out only; toggle is unavailable where dark mode is disabled).

---

## Files changed (frontend)

| File | Change |
|------|--------|
| `lib/lightOnlyRoutes.ts` | New — route allowlist |
| `components/themeContext.tsx` | Path-aware theme apply + lock |
| `app/layout.tsx` | Boot script skips dark on `/` |
| `components/headerAuthActions.tsx` | Remove theme toggle |
| `app/globals.css` | Sign-up wall contrast |
| `src/__tests__/lib/lightOnlyRoutes.test.ts` | New |
| `src/__tests__/components/themeContext.test.tsx` | Light-only route cases |
| `src/__tests__/components/headerAuthActions.test.tsx` | No toggle on home |
| `src/__tests__/components/layoutWithHeader.test.tsx` | No toggle on home |

---

## Test plan

- [x] `npm test` — `lightOnlyRoutes`, `themeContext`, `headerAuthActions`, `layoutWithHeader`
- [x] Manual — home stays light with system dark + stored `theme=dark`
- [x] Manual — no theme toggle in home header
- [x] Manual — sign-in wall Google label and email placeholder readable
- [x] Manual — navigate to `/chat`; stored dark preference restores

---

## TODO

- [x] Create Linear ticket ALE-84
- [x] Fix sign-up wall OAuth/input contrast in `globals.css`
- [x] Add `lightOnlyRoutes` helper
- [x] Path-aware theme lock in `ThemeProvider`
- [x] Boot script light-only guard in `layout.tsx`
- [x] Remove home header theme toggle
- [x] Unit tests
- [x] Open frontend PR
- [x] Open workspace plan PR
