# ALE-88 Sign-up screen overlaps with header bar

## Context

[Linear ALE-88](https://linear.app/dewly/issue/ALE-88/sign-up-screen-overlaps-with-header-bar)

On the signed-out homepage (`/`), opening the sign-up / sign-in modal (`SignUpWall`) leaves the fixed header bar (Dewly wordmark, **Log in**, **Sign up**) visually on top of the modal. The header overlaps the modal card — especially the close button and top content — making the overlay feel broken.

Reported as a layering bug (screenshot attached in Linear). Root cause is a **CSS stacking context** issue, not Clerk or modal content.

**Branch:** `ALE-88-sign-up-screen-overlaps-with-header-bar`

**Repos:**

| Repo | Role |
|------|------|
| `commerce-platform-frontend` | z-index / modal layering fix, tests |
| Workspace root | This plan, E2E flow doc |

**Database changes:** None.

**Related:** [ALE-84](implementationPlans/ALE-84-lock-homepage-to-light-mode-and-fix-sign-in-modal-contrast.md) (sign-up wall contrast on the same modal surfaces).

**Out of scope:**

- `/sign-in` and `/sign-up` full-page routes (header is already hidden via `shouldShowFloatingNav`)
- Redesigning modal copy or OAuth flows
- Hiding the header with a separate animation (modal simply needs to sit above it)

---

## Problem summary

| Layer | Selector | `z-index` | DOM position |
|-------|----------|-----------|--------------|
| Header | `.commerceAppHeader` | **100** (`--z-header`) | Direct child of `SignUpWallProvider` in `layoutWithHeader.tsx` |
| Landing shell | `.commerceLanding` | **1** | Page content (`children` of layout) |
| Landing (wall open) | `.commerceLanding--wallOpen` | **150** (`--z-landing-wall-open`) | Raised when modal open |
| Modal overlay | `.commerceSignUpWall` | **200** (`--z-modal`) | Child of `.commerceLanding` |

`SignUpWall` is `position: fixed` with `z-index: 200`, but it lives **inside** `.commerceLanding`, which has `position: relative; z-index: 1`. That creates a stacking context capped at **1** relative to the document. The header at **100** always paints above the entire landing subtree — regardless of the modal’s internal z-index.

**Fix:** Raise `.commerceLanding--wallOpen` to `z-index: 150` and centralize layer tokens in `:root`.

---

## Files changed

| Repo | File | Change |
|------|------|--------|
| frontend | `app/globals.css` | `--z-header`, `--z-landing-wall-open`, `--z-modal`; raise `.commerceLanding--wallOpen` |
| frontend | `src/__tests__/components/landingPage.test.tsx` | Assert `commerceLanding--wallOpen` when wall opens |
| frontend | `playwright/tests/home/sign-up-wall-layering.spec.ts` | Layering regression (guest) |
| frontend | `playwright.config.ts` | Include `home/*.spec.ts` in `chromium-guest` |
| workspace | `e2eTestFlows/flows/landing-signed-out.md` | Case `landing-signed-out-04` |
| workspace | `e2eTestFlows/index.md` | Case count 4 |

---

## Test plan

- [x] `npm test` — `landingPage`, `headerAuthActions`, `layoutWithHeader`
- [ ] `npx playwright test playwright/tests/home/sign-up-wall-layering.spec.ts` (requires local dev server)
- [x] Manual — `/` → header **Sign up** / **Log in** → modal above header
- [x] `npm run build`

---

## TODO

- [x] Create feature branch `ALE-88-sign-up-screen-overlaps-with-header-bar` in `commerce-platform-frontend`
- [x] Add z-index tokens and `.commerceLanding--wallOpen` layer in `globals.css`
- [x] Extend unit test for `commerceLanding--wallOpen`
- [x] Add Playwright layering spec + flow doc case
- [ ] Manual QA on local (`localhost:3020`)
- [x] `npm run lint`, `npm test`, `npm run build`
- [ ] Open frontend PR
- [ ] Open workspace plan PR
