# ALE-46 Rename Hubble → Dewly (display rebrand)

## Context

[Linear ALE-46](https://linear.app/alexandinseongprojects/issue/ALE-46): rename the commerce platform **for display purposes** from **Hubble** to **Dewly**, and replace the logo mark with the Dewly brand assets attached to the ticket.

This is a **consumer-facing branding pass** only. Repo names (`commerce-platform-frontend`), package names, GraphQL schema, database tables, Clerk application settings, Vercel project names, and `commercePlatformMocks/` prototypes stay as-is unless product explicitly expands scope later.

**Branch:** `ALE-46-rename-hubble-to-dewly` (frontend only).

**Shipped:** [commerce-platform-frontend#12](https://github.com/alex-the-programmer/commerce-platform-frontend/pull/12) (merged to `main` at `060333d`).

**Asset source:** Dewly logo mark and wordmark PNGs committed under `public/brand/`; favicon via `app/icon.png`. Linear ticket attachments can replace these files if design ships updated assets.

---

## Goals

| Goal | Detail |
|------|--------|
| Product name | All user-visible “Hubble” / “hubble” strings become **Dewly** / **dewly** as appropriate |
| Logo mark | Replace the CSS gradient orb (`hubbleLogoMark.tsx`) with the Dewly logo from ticket assets |
| Browser chrome | Page `<title>`, favicon / app icon, and Open Graph basics reflect Dewly |
| Consistency | One small brand constants module so future copy changes do not require repo-wide grep |
| Header UX | Signed-out home: Log in + Get started in top bar; signed-in: account menu; hide Chat/Routine pills until login; frosted header bar on scroll; single-row mobile signed-in bar with compact pills and ellipsis name truncation |

---

## Current state

### Logo today

| Location | What it is |
|----------|------------|
| `components/hubbleLogoMark.tsx` | 26×26 CSS gradient circle + white dot (Hubble prototype stand-in) |
| `theme.ts` → `colors.logoMark` | `var(--logo-mark)` gradient token in `app/globals.css` |
| `components/typingIndicator.tsx`, `components/chatMessageList.tsx`, `components/quizRunner.tsx` | Inline uses of `theme.colors.logoMark` for assistant orb / loading states |

There is **no** `public/` directory, **no** favicon, and **no** `app/icon.tsx` / `app/apple-icon.tsx` in `commerce-platform-frontend`.

### User-facing “Hubble” strings (production frontend)

| File | String / usage |
|------|----------------|
| `app/layout.tsx` | `metadata.title`: `"hubble"` |
| `components/chatComposer.tsx` | Desktop placeholder: `"Ask Hubble anything about skin…"` |
| `components/quizRunner.tsx` | Progress header wordmark: `HUBBLE` |
| `components/quizRunner.tsx` | Step label: `` `HUBBLE IS ASKING · Q${n}` `` |
| `components/quizRunner.tsx` | Imports / renders `<HubbleLogoMark />` |

### Adjacent copy (not literally “Hubble”, but brand voice — update in this ticket)

| File | String |
|------|--------|
| `components/chatMessageList.tsx` | `"Your beauty guide is saying hi…"` |
| `components/chatMessageList.tsx` | Share text: `"Check out this K-beauty skincare advisor — …"` |

### Dev-only / comments (optional cleanup, not blocking)

- `app/globals.css` — `Hubble reference:` comment
- `components/chatPage.tsx`, `shoppingProductCard.tsx`, `cardHeader.tsx` — “Hubble-style/prototype” comments
- Tests: `hubbleLogoMark.test.tsx`, `chatComposer.test.tsx` placeholder assertion

### Backend

**No** `Hubble` / `Dewly` strings in `commerce-platform-backend`. Agent system prompts describe a generic “K-beauty cosmetologist” (`shoppingAgent.ts`, `chatSummarizationAgent.ts`). **Out of scope** for display-only rebrand unless product wants the assistant to introduce itself as Dewly in LLM copy (separate ticket).

---

## Asset inventory (from Linear ALE-46)

Before implementation, pull attachments from the Linear issue and place under:

```
commerce-platform-frontend/public/brand/
  dewly-logo-mark.png      # small mark for header / quiz / chat orb
  dewly-wordmark.png       # horizontal lockup (on disk; header uses mark + rendered text)
commerce-platform-frontend/app/icon.png   # favicon / app icon
```

**Acceptance criteria for assets:**

- Logo mark readable at **26px** (quiz progress header) and **32px** (typing indicator / assistant avatar)
- Works on **light and dark** backgrounds (provide separate assets or a single SVG with `currentColor` if design allows)
- Favicon recognizable at **16×16**

If the ticket ships only a raster PNG, use `next/image` with fixed width/height; prefer SVG when available.

---

## Design decisions

### 1. Central brand module (recommended)

Add `lib/brand.ts`:

```ts
export const BRAND_NAME = "Dewly";
export const BRAND_NAME_LOWER = "dewly";
export const BRAND_NAME_UPPER = "DEWLY";

export const CHAT_PLACEHOLDER_DESKTOP =
  "Ask Dewly anything about skin…";
export const CHAT_GREETING_LOADING = "Dewly is saying hi…";
export const QUIZ_STEP_LABEL = (q: number) =>
  `${BRAND_NAME_UPPER} IS ASKING · Q${q}`;
export const SHARE_MESSAGE = (url: string) =>
  `Check out ${BRAND_NAME} — personalized K-beauty skincare recommendations based on your skin. Try it: ${url}`;
export const METADATA_DESCRIPTION =
  "Beauty shopping, curated like an editor—but faster.";
```

Import these constants anywhere user-facing brand copy appears. Avoid scattering literal `"Dewly"` strings.

### 2. Logo component rename

| Today | Target |
|-------|--------|
| `components/hubbleLogoMark.tsx` | `components/dewlyLogoMark.tsx` (or `brandLogoMark.tsx` if we want name-agnostic file) |
| `HubbleLogoMark` default export | `DewlyLogoMark` |

Implementation:

- Render the committed SVG via inline `<svg>` (best for tinting) **or** `<Image src="/brand/dewly-logo-mark.svg" … />`
- Accept optional `size?: number` prop (default `26`) so quiz intro can use `48` without duplicating markup
- Keep `flexShrink: 0` and circular clipping only if the new mark is round; otherwise drop `borderRadius: 999` if the Dewly mark is not circular

**Gradient orb usages:** Places that currently paint `theme.colors.logoMark` on a `<div>` (typing indicator, chat greeting orb, quiz loading states) should either:

- **Preferred:** render `<DewlyLogoMark size={…} />` for visual consistency, or
- Update `--logo-mark` only if design spec says the Dewly mark is still gradient-based

Decide once assets are on disk; default to **shared logo component everywhere**.

### 3. Quiz wordmark

Replace hardcoded `HUBBLE` span in `quizRunner.tsx` progress header with `{BRAND_NAME_UPPER}` next to `<DewlyLogoMark />`.

If the ticket includes a horizontal wordmark SVG, optionally add `DewlyWordmark` and use it instead of the uppercase sans label.

### 4. Metadata & favicon (Next.js App Router)

Update `app/layout.tsx`:

```ts
export const metadata: Metadata = {
  title: BRAND_NAME_LOWER, // or "Dewly" — match design (browser tab casing)
  description: METADATA_DESCRIPTION,
};
```

Add app icons using ticket assets:

- `app/icon.png` (or `.ico`) — 32×32 / multi-size favicon
- `app/apple-icon.png` — 180×180 if provided

Next.js will serve these automatically; no manual `<link rel="icon">` required.

### 5. What we are **not** changing

| Item | Reason |
|------|--------|
| `commerce-platform-frontend` package name | Internal repo identifier |
| `commerce-platform-backend` | No user-facing Hubble strings |
| Prisma / database | No schema impact |
| `commercePlatformMocks/hubble/` | Design archive, not production |
| Clerk dashboard app display name | Admin console change, not code |
| LLM agent persona names | Display-only ticket; agent does not say “Hubble” today |
| CSS token names like `--logo-mark` | Internal; rename only if Dewly palette changes (separate design ticket) |

---

## Implementation plan

### Step 0 — Import assets

- [x] Create `commerce-platform-frontend/public/brand/` and add logo mark + wordmark PNGs
- [x] Add `app/icon.png` favicon from logo mark

### Step 1 — Brand constants

- [x] Add `lib/brand.ts` with name + copy helpers
- [x] Add `src/__tests__/lib/brand.test.ts` (smoke: exports defined, quiz label format)

### Step 2 — Logo component

- [x] Add `components/dewlyLogoMark.tsx` using committed assets
- [x] Delete `components/hubbleLogoMark.tsx` after updating imports
- [x] Rename test file to `dewlyLogoMark.test.tsx`; assert render + optional `size` prop
- [x] Replace inline `theme.colors.logoMark` orbs in `typingIndicator.tsx`, `chatMessageList.tsx`, and quiz loading UI with `<DewlyLogoMark />` where it improves consistency

### Step 3 — User-facing copy

- [x] `app/layout.tsx` — metadata title (+ description from `lib/brand.ts`)
- [x] `components/chatComposer.tsx` — desktop placeholder from `CHAT_PLACEHOLDER_DESKTOP`
- [x] `components/quizRunner.tsx` — import `DewlyLogoMark`, `BRAND_NAME_UPPER`, `quizStepLabel`
- [x] `components/chatMessageList.tsx` — greeting + share text from brand constants
- [x] `src/__tests__/components/chatComposer.test.tsx` — update placeholder expectation

### Step 4 — Favicon / app icons

- [x] Add `app/icon.png` from logo mark
- [x] Browser tab title `Dewly` in `app/layout.tsx`

### Step 5 — Landing & header UX (expanded during implementation)

- [x] Add `components/dewlyWordmark.tsx` — mark + rendered “Dewly” text (avoids raster wordmark background mismatch)
- [x] Add `components/headerAuthActions.tsx` — Log in, Get started, theme toggle on signed-out home
- [x] Add `components/headerUserMenu.tsx` — account menu (routine, theme, sign out)
- [x] Update `components/layoutWithHeader.tsx` — fixed header grid; hide nav pills when signed out; scroll-aware frosted panel (`commerceAppHeader--scrolled`); mobile compact wordmark
- [x] Update `components/floatingNavPill.tsx` — return `null` when signed out
- [x] Update `app/page.tsx` — redirect signed-in users to `/chat`; remove duplicate hero auth buttons
- [x] Update `app/globals.css` — signed-out/signed-in header layouts; single-row mobile signed-in bar; compact nav pill + ellipsis user name
- [x] Unit tests: `headerAuthActions`, `headerUserMenu`, expanded `layoutWithHeader`, `floatingNavPill`, `homePage`, `dewlyWordmark`, `brand`

### Step 6 — Comment cleanup (low priority)

- [x] Update `globals.css` header comment from “Hubble reference” → “Dewly / legacy Hubble palette reference” (palette unchanged unless design says otherwise)
- [ ] Refresh dev-only “Hubble-style” comments to “Dewly” or “brand” where touched

---

## Files to touch (expected diff)

| File | Change |
|------|--------|
| `public/brand/*` | **New** — logo / wordmark assets from Linear |
| `lib/brand.ts` | **New** — brand constants |
| `components/dewlyLogoMark.tsx` | **New** — replaces gradient orb |
| `components/hubbleLogoMark.tsx` | **Delete** |
| `app/layout.tsx` | Metadata title |
| `components/dewlyWordmark.tsx` | **New** — header lockup (mark + text) |
| `components/headerAuthActions.tsx` | **New** — signed-out home auth CTAs |
| `components/headerUserMenu.tsx` | **New** — signed-in account menu |
| `components/layoutWithHeader.tsx` | Fixed header, scroll panel, responsive layout |
| `components/floatingNavPill.tsx` | Hide when signed out |
| `app/page.tsx` | Signed-in redirect; hero layout |
| `app/globals.css` | Header / nav responsive styles |
| `app/icon.png` | **New** favicon |
| `components/chatComposer.tsx` | Placeholder |
| `components/quizRunner.tsx` | Logo, wordmark, step label |
| `components/chatMessageList.tsx` | Greeting + share copy |
| `components/typingIndicator.tsx` | Optional: use logo component |
| `src/__tests__/lib/brand.test.ts` | **New** |
| `src/__tests__/components/dewlyWordmark.test.tsx` | **New** |
| `src/__tests__/components/headerAuthActions.test.tsx` | **New** |
| `src/__tests__/components/headerUserMenu.test.tsx` | **New** |
| `src/__tests__/components/layoutWithHeader.test.tsx` | Header layout, scroll, mobile wordmark |
| `src/__tests__/components/floatingNavPill.test.tsx` | Signed-out hide, responsive labels |
| `src/__tests__/app/homePage.test.tsx` | Signed-in redirect |
| `src/__tests__/components/chatComposer.test.tsx` | Placeholder string |

**Repo scope:** `commerce-platform-frontend` only.

---

## Verification

### Automated

```bash
cd commerce-platform-frontend
npm run lint
npm run build
npm test
```

### Manual QA

1. **`/` landing** — browser tab title “dewly” / “Dewly”; favicon visible
2. **`/chat`** — composer placeholder mentions Dewly (desktop); mobile placeholder unchanged (`"Ask about skin care…"`) unless product wants that updated too
3. **Empty chat / new thread** — loading greeting uses Dewly copy; typing indicator shows new mark
4. **`/quizzes/skin-quiz`** — progress header shows Dewly logo + `DEWLY`; step label `DEWLY IS ASKING · Q1`
5. **Share action** — copied text mentions Dewly and `/chat` URL
6. **Dark mode** — logo mark legible on dark backgrounds
7. **Grep sanity** — `rg -i hubble commerce-platform-frontend` returns only historical comments in mocks (none in production components after cleanup)

---

## Open questions (confirm before or during implementation)

1. **Browser tab casing:** `Dewly` (title case) — **decided**
2. **Mobile composer placeholder:** branded `"Ask Dewly about skin care…"` via `CHAT_PLACEHOLDER_MOBILE` — **decided**
3. **Wordmark:** rendered mark + “Dewly” text in header; raster wordmark PNG kept on disk only — **decided**
4. **Assistant persona:** backend agent intros unchanged — **deferred**
5. **OG / social preview:** not added — **deferred**

---

## TODO

- [x] Add logo assets under `public/brand/` + `app/icon.png`
- [x] Add `lib/brand.ts` + unit test
- [x] Implement `dewlyLogoMark.tsx` + `dewlyWordmark.tsx`; remove `hubbleLogoMark.tsx`
- [x] Wire logo into quiz header, typing indicator, and chat greeting orbs
- [x] Update layout metadata + favicon
- [x] Replace Hubble strings in `chatComposer`, `quizRunner`, `chatMessageList`
- [x] Header UX: auth actions, account menu, signed-out nav hide, scroll panel, mobile single-row bar
- [x] Update affected unit tests (337 tests passing at ship)
- [x] Run `npm run build`, `npm test` in frontend
- [x] Open PR against `main` — https://github.com/alex-the-programmer/commerce-platform-frontend/pull/12 (merged)
