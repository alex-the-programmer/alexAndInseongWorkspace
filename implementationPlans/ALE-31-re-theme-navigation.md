# ALE-31 Re-theme Navigation

## Context

[Linear ALE-31](https://linear.app/alexandinseongprojects/issue/ALE-31/re-theme-navigation): replace the full-width fixed top app bar with a **top floating pill** nav on primary consumer surfaces. The pill has exactly two destinations — **Chat** (renamed from Shop; route **`/chat`**, was `/shop`) and **Skin routine** (`/skincare-routine`). Remove the permanent **Skin quiz** nav entry; quiz access remains on the routine page (and existing in-chat CTAs). **No notification bell** in this ticket.

Target UX (from issue screenshots):

- Full-bleed pages with no full-width top bar (logo strip, link row, hamburger sheet)
- Centered **top** floating pill: `Chat` | `Skin routine`, icons + labels, active segment uses accent fill
- Chat screen: pill fixed near top; composer stays at bottom (unchanged)
- Routine screen: pill at top; hero card + AM/PM content below; **Take skin quiz** stays in routine header when quiz incomplete
- Landing welcome: large serif headline + single CTA; same pill visible at top

**Repo scope:** `commerce-platform-frontend` only. No backend, scrapers, or database changes.

**Branch:** `ALE-31-re-theme-navigation` (per Linear git branch name, normalized to workspace convention).

---

## Current State

| Surface | Component | Behavior today |
|--------|-----------|----------------|
| App pages | `components/appHeader.tsx` | Fixed 64px top bar: logo, Shop, Skin quiz, Your routine (signed-in), auth, theme toggle |
| Landing | `components/landingNav.tsx` | Same top bar pattern: Search, Skin quiz, Sign In/Up |
| Layout | `components/layoutWithHeader.tsx` | Renders `AppHeader` except auth paths |
| Chat routes | `app/shop/page.tsx`, `app/shop/[chatId]/page.tsx` | `/shop`, `/shop/[chatId]` |
| Offsets | `shopPage`, `skincareRoutinePage`, `quizRunner` | `paddingTop: 80` for header clearance |
| Quiz entry | `appHeader`, `landingNav` | Permanent `/quizzes/skin-quiz` link |
| Routine quiz CTA | `skincareRoutinePage.tsx` `CardHeader.trailing` | **Take skin quiz** when user cannot generate routine — **keep** |

There is **no** existing floating pill nav or notification bell in production code (only the legacy full-width top bar).

---

## Gap Analysis

| Area | Today | Target (ALE-31) |
|------|-------|-----------------|
| App chrome | Fixed full-width top `AppHeader` (64px) | Compact **top floating pill** only (no logo row, no link strip) |
| Primary nav items | Shop, Skin quiz, Your routine | Pill: **Chat**, **Skin routine** only |
| Shop route + label | `/shop`, "Shop" / landing "Search" | **`/chat`**, **`/chat/[chatId]`**, label **Chat** everywhere |
| Routine label | "Your routine" | **Skin routine** |
| Skin quiz in nav | Header + landing links | **Removed** from nav; routine page CTA unchanged |
| Notifications | N/A | Explicitly out of scope |
| Page layout | `paddingTop: 80` for full bar | `paddingTop` for **pill height + margin** (~56–72px), not a 64px chrome bar |
| Auth / theme | In top bar | Must relocate (see decisions below) |
| Quiz flow | Uses `AppHeader` + own progress header (ALE-24) | Hide app pill on `/quizzes/*`; quiz keeps quiz-specific header |

---

## Design Spec (Floating Pill)

Implement `components/floatingNavPill.tsx` (name can vary; single source of truth).

```
        ┌─────────────────────────────────────┐
        │  [💬] Chat  │  [✨] Skin routine   │  ← segmented control in pill
        └─────────────────────────────────────┘
              fixed, top ~16px + safe-area-inset-top
              horizontal center, z-index above content, below modals
```

**Visual (match mocks + existing tokens):**

- Container: `borderRadius: 999`, `background: theme.colors.navBg` or `surface`, blur optional, subtle border `navBorder`, soft shadow
- Segment inactive: transparent / muted text
- Segment active: `theme.colors.accentSolid` background, `theme.colors.onAccent` text
- Icons: simple line icons (inline SVG or Unicode placeholders initially — prefer small SVG components for test stability)
- Min tap target ~44px height per segment
- `role="navigation"`, `aria-current="page"` on active link

**Positioning:**

- `position: fixed`, `left: 50%`, `transform: translateX(-50%)`, `top: calc(12px + env(safe-area-inset-top))`
- `zIndex`: below modal overlays (e.g. 90) but above page content
- Page scroll areas use `paddingTop` (or equivalent) so content clears the pill — composer on `/chat` stays at the bottom and is unaffected

**Visibility rules:**

| Path pattern | Show pill? |
|--------------|------------|
| `/`, `/chat`, `/chat/*`, `/skincare-routine` | Yes |
| `/quizzes/*` | No (quiz runner owns top chrome) |
| `/sign-in`, `/sign-up`, `/sso-callback` | No |
| Other routes | No (until product expands) |

**Active state:**

- `/chat` and `/chat/[chatId]` → Chat active
- `/skincare-routine` → Skin routine active

**Signed-out + Skin routine:**

- Keep existing `SkincareRoutinePage` gate ("Sign in to view your routine")
- Pill still links to `/skincare-routine` (Clerk middleware may also protect — verify `proxy.ts`); no nav change required in backend

---

## Decisions

### Auth — Option A (locked)

- **Landing (`/`):** Sign In / Sign Up stay in hero CTAs only (`app/page.tsx`). Not in the floating pill. Remove auth from `LandingNav` when that full bar is deleted.
- **App routes (`/chat`, `/chat/*`, `/skincare-routine`):** Floating pill has **no** sign-in, sign-up, user name, or sign-out.
- **Signed-in sign-out:** Deferred to a future profile menu (out of scope for ALE-31). Do **not** add a third pill segment, overflow menu, or routine-page footer auth for sign-out.
- **Implication:** After sign-in, users on `/chat` or `/skincare-routine` cannot sign out in-app until profile menu ships. Acceptable per product choice.

### Other defaults (unchanged unless revised)

- **Theme toggle:** Fixed top-right in the pill band on routes that show the pill (pill centered, toggle flush right) — not in the pill.
- **Landing chrome:** Remove `LandingNav` full-width bar; top floating pill + hero CTAs for auth.
- **Logo / home:** No logo in pill; home via `/` landing only.

---

## Implementation Plan

### 1. New floating navigation component

**File:** `components/floatingNavPill.tsx`

- Client component using `usePathname()` for active segment
- Two `Link` segments (or `button` + `router.push` if preferred for tests):
  - Chat → `/chat`
  - Skin routine → `/skincare-routine`
- Export helper `shouldShowFloatingNav(pathname: string): boolean` for layout tests
- Export constant `FLOATING_NAV_TOP_OFFSET = 72` (pill height + top margin + safe area) for page `paddingTop`

### 2. Replace header layout wiring

**Files:**

- `components/layoutWithHeader.tsx` → rename conceptually to `LayoutWithNav` (optional rename; can keep filename and change behavior):
  - Stop rendering `AppHeader` on consumer routes
  - Render `FloatingNavPill` when `shouldShowFloatingNav(pathname)` — **two segments only**, no auth UI
  - Render `ThemeToggle` fixed top-right in the pill band when pill visible — **no** sign-in/out/name in that band (Option A)
- `components/appHeader.tsx`:
  - **Remove from layout** entirely; delete file or leave unused until cleanup PR. Do not keep an auth-only stub on app routes.
- `components/landingNav.tsx`:
  - **Delete** or stop rendering — landing auth lives in `app/page.tsx` hero only (Option A)
  - Layout-owned `FloatingNavPill` on `/` as well

### 3. Remove Skin quiz from permanent navigation

**Files:**

- `components/appHeader.tsx` — remove Skin quiz links (desktop + mobile sheet) if file retained temporarily
- `components/landingNav.tsx` — remove Skin quiz links; update landing hero if it duplicated quiz CTA

**Do not remove:**

- `skincareRoutinePage.tsx` trailing **Take skin quiz**
- `chatMessageList.tsx` quiz CTAs
- `/quizzes/[path]` route

### 4. Rename route `/shop` → `/chat`

Move Next.js app routes and update every consumer-facing URL. **No backend changes** (GraphQL only; no `/shop` API paths).

**Route mapping:**

| Old | New |
|-----|-----|
| `/shop` | `/chat` |
| `/shop/[chatId]` | `/chat/[chatId]` |

**App directory:**

- Move `app/shop/page.tsx` → `app/chat/page.tsx` (still renders `ShopPage` component)
- Move `app/shop/[chatId]/page.tsx` → `app/chat/[chatId]/page.tsx`
- Delete empty `app/shop/` directory after move

**Redirects (recommended):** In `next.config.ts` (or `next.config.mjs`), permanent redirects so bookmarks and shared links keep working:

```ts
{ source: "/shop", destination: "/chat", permanent: true },
{ source: "/shop/:chatId", destination: "/chat/:chatId", permanent: true },
```

**Files to update (grep `/shop` in frontend):**

| File | Change |
|------|--------|
| `proxy.ts` | `createRouteMatcher(["/chat(.*)"])` |
| `app/sign-in/page.tsx`, `app/sign-up/page.tsx` | `AFTER_SIGN_*_URL = "/chat"` |
| `app/sso-callback/page.tsx` | post-auth `navigateTo("/chat")` |
| `app/page.tsx` | landing CTAs `href="/chat"` |
| `components/shopPage.tsx` | `router.push/replace` → `/chat/${id}`; update route comments |
| `components/chatMessageList.tsx` | share URL `.../chat` |
| `components/quizRunner.tsx` | completion link `href="/chat"` |
| `components/appHeader.tsx`, `landingNav.tsx` | links if still present during migration |
| `src/__tests__/app/appPages.test.tsx` | import `app/chat/*`; adjust describe blocks |
| `src/__tests__/components/*.test.tsx` | pathnames `/chat` |
| `src/__tests__/components/chatMessageList.test.tsx` | share URL expects `/chat` |

**Optional (out of scope for minimal diff):** rename `shopPage.tsx` → `chatPage.tsx` and test file names — not required for the URL change.

### 5. Rename labels (Your routine → Skin routine; copy alignment)

| Location | Old | New |
|----------|-----|-----|
| Floating pill | Shop link | **Chat** → `/chat` |
| `shopPage` mobile drawer title | "My chats" | unchanged (internal) |
| `quizRunner` completion CTA | "Go to chat →" | `href="/chat"` |
| `app/page.tsx` CTAs | "Search" / `/shop` | **Chat** or "Start chatting" → `/chat` |
| Tests | `/shop`, Shop | `/chat`, Chat |

### 6. Page layout adjustments

Replace full 64px header offset with smaller top inset for the floating pill only.

| File | Change |
|------|--------|
| `components/shopPage.tsx` | `paddingTop: 80` → `FLOATING_NAV_TOP_OFFSET` (~72px); mobile drawer/sheet `top` aligns to pill bottom edge (not 64px full bar); "My chats" bar positions below pill |
| `components/skincareRoutinePage.tsx` | `paddingTop: 80` → `FLOATING_NAV_TOP_OFFSET`; keep existing bottom padding for page content |
| `components/quizRunner.tsx` | Keep `paddingTop: 80` for quiz progress header only (no app pill on quiz routes) |
| `app/page.tsx` | Hero `paddingTop` clears top pill band (replace `LandingNav` 64px offset) |

### 7. Theme tokens (optional)

Existing `navBg` / `navBorder` in `theme.ts` and `app/globals.css` are sufficient. Add only if mock needs pill-specific tokens:

- `--nav-pill-shadow` (optional CSS variable in `globals.css`)

No architect approval needed unless adding new semantic tokens is substantial.

### 8. Tests

| File | Action |
|------|--------|
| `src/__tests__/components/appHeader.test.tsx` | Replace or narrow — if `AppHeader` removed, delete file or test only legacy behavior |
| New `src/__tests__/components/floatingNavPill.test.tsx` | Renders on `/chat`; active on `/chat` and `/chat/abc`; links to `/chat` and `/skincare-routine` |
| `src/__tests__/components/layoutWithHeader.test.tsx` | Expect pill not header on `/chat`; no nav on auth paths |
| `src/__tests__/app/appPages.test.tsx` | `app/chat` routes |
| `src/__tests__/components/chatMessageList.test.tsx` | share URL contains `/chat` |
| `src/__tests__/components/landingNav.test.tsx` | Rewrite for landing without top bar OR remove if `LandingNav` deleted |
| `src/__tests__/components/chatMessageList.test.tsx` | No change expected (quiz CTAs remain) |

Run: `npm run lint`, `npm run build`, relevant tests in `commerce-platform-frontend`.

---

## Files Touched (expected)

| File | Change |
|------|--------|
| `components/floatingNavPill.tsx` | **New** |
| `components/layoutWithHeader.tsx` | Wire pill, drop header |
| `components/appHeader.tsx` | Remove from layout / delete nav UI |
| `components/landingNav.tsx` | Remove top bar or delete |
| `components/shopPage.tsx` | Top inset for pill; drawer offsets below pill |
| `components/skincareRoutinePage.tsx` | Top padding only |
| `app/chat/page.tsx`, `app/chat/[chatId]/page.tsx` | **Moved** from `app/shop/` |
| `next.config.*` | Redirects `/shop` → `/chat` |
| `proxy.ts` | Protect `/chat(.*)` |
| `app/sign-in`, `app/sign-up`, `app/sso-callback` | Post-auth `/chat` |
| `components/chatMessageList.tsx`, `quizRunner.tsx` | `/chat` URLs |
| `app/page.tsx` | Landing spacing / CTA copy + `/chat` links |
| `src/__tests__/components/*` | Nav + route test updates |

**Out of scope:** `commerce-platform-backend`, `commerce-platform-scrapers`, notification bell, renaming `shopPage.tsx` component file (optional follow-up).

---

## Verification (manual)

1. `npm run dev` in `commerce-platform-frontend`
2. **Landing `/`:** no full-width top bar; top pill shows Chat + Skin routine; sign-in/up still reachable
3. **`/chat`:** top pill visible; Chat active; content clears pill; composer still at bottom
4. **`/chat/[id]`:** deep link loads chat; pill shows Chat active
5. **`/shop` and `/shop/[id]`:** redirect to `/chat` equivalents (308/ permanent)
6. **`/skincare-routine`:** Skin routine active; **Take skin quiz** visible when quiz incomplete; no nav link to quiz
7. **`/quizzes/skin-quiz`:** no floating pill; quiz progress header still works (ALE-24)
8. **Auth routes:** no pill; post sign-in lands on `/chat`
9. **Signed-in on `/chat`:** no sign-out control visible (Option A — profile menu later)
10. **Signed-in on `/`:** hero still offers navigation to app; no sign-out in pill (sign-out deferred)
11. **Mobile ~375px:** pill centered at top, safe-area-inset-top respected, tappable segments
12. **Share link** from chat copies URL with `/chat`
13. **Dark mode:** pill contrast readable
14. `npm run lint && npm run build && npm test` pass

---

## TODO

- [x] Auth: Option A (landing hero only; no auth in pill or app chrome)
- [ ] Confirm theme toggle + landing top bar approach (defaults in Decisions section)
- [ ] Create `floatingNavPill.tsx` + `shouldShowFloatingNav` helper
- [ ] Update `layoutWithHeader.tsx` to render pill instead of `AppHeader`
- [ ] Remove / gut `appHeader.tsx` and `landingNav.tsx` top bars
- [ ] Remove Skin quiz links from all permanent nav
- [ ] Move `app/shop` → `app/chat`; add `/shop` → `/chat` redirects in `next.config`
- [ ] Update all `/shop` links, `proxy.ts`, auth redirects, share URLs, router pushes
- [ ] Rename labels: Chat + Skin routine in nav and landing CTAs
- [ ] Adjust `shopPage`, `skincareRoutinePage`, `app/page.tsx` top padding for pill band
- [ ] Fix `shopPage` mobile drawer offsets (anchor below top pill, not `top: 64` full bar)
- [ ] Add `floatingNavPill.test.tsx`; update `layoutWithHeader` and landing tests
- [ ] Manual QA per checklist above
- [ ] `npm run lint`, `npm run build`, `npm test` in frontend
