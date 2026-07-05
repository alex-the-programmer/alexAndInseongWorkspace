# Pages graph — commerce-platform-frontend

Generated during **ALE-82 Phase 1** discovery (`main` branch, June 2026).  
Re-validate on feature branches when routes or navigation change.

**Dev URLs:** frontend `http://localhost:3020` · GraphQL `http://localhost:4020/api/public`

---

## Auth zones

| Zone | Routes | Gate |
|------|--------|------|
| **Public** | `/`, `/sign-in`, `/sign-up`, `/sso-callback` | None |
| **Middleware-protected** | `/chat`, `/chat/*`, `/skincare-routine` | Clerk `auth.protect()` in `proxy.ts` |
| **Unprotected but auth-dependent** | `/quizzes/*` | No redirect; saving quiz answers needs signed-in GraphQL |
| **Local-only** | `/dev/retailer-card-audit` | `notFound()` unless `isLocalDevToolsEnabled()` |
| **Legacy redirects** | `/shop`, `/shop/:chatId` | 308 → `/chat`, `/chat/:chatId` |

Post-auth default destination: **`/chat`** (`CLERK_AFTER_AUTH_URL`).

---

## Route inventory

| Route | Page component | Floating header |
|-------|----------------|-----------------|
| `/` | `LandingPage` (signed out only; signed-in → `/chat`) | Yes |
| `/sign-in` | Email/password + Google OAuth | No |
| `/sign-up` | Email/password + Google OAuth (+ email verify step) | No |
| `/sso-callback` | OAuth return handler | No |
| `/chat` | `ChatPage` — list / new chat; auto-navigates to `/chat/:id` | Yes |
| `/chat/[chatId]` | `ChatPage` with active thread | Yes |
| `/skincare-routine` | `SkincareRoutinePage` | Yes |
| `/quizzes/[path]` | `QuizRunner` full page (e.g. `skin-quiz`) | No |
| `/dev/retailer-card-audit` | `RetailerCardAuditPage` | No |

---

## Reachability graph (routes)

Edges: **link**, **router navigation**, **redirect**, or **legacy redirect**.

```mermaid
flowchart TD
  subgraph public["Public"]
    landing["/"]
    signIn["/sign-in"]
    signUp["/sign-up"]
    sso["/sso-callback"]
  end

  subgraph signedIn["Signed-in (core app)"]
    chat["/chat"]
    chatId["/chat/:chatId"]
    routine["/skincare-routine"]
    quizPage["/quizzes/skin-quiz"]
  end

  subgraph localOnly["Local dev only"]
    devAudit["/dev/retailer-card-audit"]
  end

  subgraph legacy["Legacy (308)"]
    shop["/shop"]
    shopId["/shop/:chatId"]
  end

  landing -->|"signed in (replace)"| chat
  landing -->|"Log in / Sign up buttons"| signIn
  landing -->|"Sign up wall → email path"| signUp
  landing -->|"Sign up wall → email path"| signIn

  signIn -->|"success"| chat
  signIn -->|"link"| signUp
  signUp -->|"success"| chat
  signUp -->|"link"| signIn

  signIn -->|"Google OAuth"| sso
  signUp -->|"Google OAuth"| sso
  sso -->|"complete"| chat
  sso -->|"needs sign-in"| signIn
  sso -->|"needs sign-up"| signUp

  chat -->|"select / create chat"| chatId
  chatId -->|"My chats drawer"| chatId
  chat -->|"floating nav"| routine
  routine -->|"floating nav"| chat
  chatId -->|"assistant CTA"| quizPage
  chatId -->|"assistant CTA"| routine
  quizPage -->|"Go to chat →"| chat

  landing -->|"logo (signed out)"| landing
  chat -->|"logo (signed in)"| chat
  chatId -->|"logo (signed in)"| chat
  routine -->|"logo (signed in)"| chat

  shop -->|"308"| chat
  shopId -->|"308"| chatId

  devAudit -.->|"direct URL only"| devAudit
```

---

## Overlay / modal graph (not separate routes)

These surfaces share the URL bar with their host page. Document separately because Playwright must open/close them without `page.goto`.

```mermaid
flowchart TD
  subgraph landingOverlays["/ (landing)"]
    wall["SignUpWall dialog"]
    wall -->|"email submit"| signUp
    wall -->|"switch to login"| signIn
    wall -->|"OAuth"| sso
  end

  subgraph globalHeader["Header (signed in)"]
    acctMenu["Account menu"]
    acctMenu -->|"My Skincare Routine"| routine
    acctMenu -->|"Sign out"| landing
  end

  subgraph chatOverlays["/chat/*"]
    chatsDrawer["My chats drawer (mobile)"]
    deleteDlg["Delete chat confirmation"]
    helpPopover["What can I ask?"]
  end

  subgraph routineOverlays["/skincare-routine"]
    setupModal["Set up your routine modal"]
    onboardModal["Routine onboarding modal"]
    quizModal["Skin quiz modal"]
    recsDrawer["Your custom routine drawer"]
    removeDlg["Remove routine product confirmation"]
  end

  landing -->|"hero submit / chip"| wall
  routine -->|"Set up my routine"| setupModal
  routine -->|"Take the skin quiz"| quizModal
  routine -->|"View recommendations"| recsDrawer
  quizModal -->|"Done + regenerate"| routine
```

### Query-param deep links (`/skincare-routine`)

| Param | Opens / triggers |
|-------|-------------------|
| `openSetup=1` | “Set up your routine” modal (new-user empty state) |
| `openQuiz=1` | Routine onboarding modal |
| `openSkinQuiz=1` | Skin quiz modal |
| `generateRoutine=1` | `generateSkincareRoutine` mutation |
| `openRecs=1` | Recommendations drawer after generate |
| `regenerateSource=skin-quiz` | “Updating recommendations…” loading on hero |
| `regenerateSource=routine-onboarding` | Same, from onboarding path |

---

## Entry points

| Entry | Lands on | Notes |
|-------|----------|-------|
| Direct `/` | Landing or → `/chat` if signed in | |
| Direct `/chat` | Chat home → canonical `/chat/:id` | Middleware requires auth |
| Direct `/chat/:id` | Specific thread | Shareable deep link |
| `/sign-in?email=` | Sign-in with prefilled email | From sign-up wall |
| `/sign-up?email=` | Sign-up with prefilled email | From sign-up wall |
| Landing hero message | Sign-up wall → auth → `/chat` + pending message sent | `pendingChatMessage` |
| Assistant CTA | `/skincare-routine?openSkinQuiz=1`, `/skincare-routine?openSetup=1` | Dynamic `cta.url` |
| Account menu | `/skincare-routine` | |
| Legacy `/shop` | `/chat` | Permanent redirect |

---

## Header visibility (`shouldShowFloatingNav`)

| Path pattern | Floating nav + header |
|--------------|----------------------|
| `/`, `/chat`, `/chat/*`, `/skincare-routine` | Shown |
| `/sign-in`, `/sign-up`, `/sso-callback` | Hidden |
| `/quizzes/*` | Hidden |
| `/dev/*` | Hidden |

`FloatingNavPill` (Chat / Routine) renders only when **signed in**.

---

## Discovery gaps / branch drift risks

- **Quiz paths** beyond `skin-quiz` are dynamic (`/quizzes/[path]`); confirm available quizzes in backend before adding E2E.
- **Agent CTAs** are dynamic per message; catalog common URLs during Phase 3 smoke tests.
- **Email verification** on sign-up may block automated user creation unless Clerk dev OTP (`424242`) or Dashboard-created user is used.
- Re-run this graph when adding routes under `app/` or new `router.push` targets.
