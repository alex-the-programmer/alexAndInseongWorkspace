---
name: playwright-e2e
description: >-
  Add, update, or debug Playwright E2E tests for commerce-platform-frontend.
  Use when the user asks for E2E tests, Playwright tests, UI flow tests, updates
  to playwright/tests, or when a feature branch changes routes, auth, chat, or
  skincare routine UI that should be covered in e2eTestFlows/.
---

# Playwright E2E (commerce-platform-frontend)

Local-only browser tests. Flow **specs** live in workspace `e2eTestFlows/`; **test code** in `commerce-platform-frontend/playwright/`.

## When to use

- User asks to add/update E2E or Playwright coverage
- A PR changes routes, auth gates, nav, chat, or routine UI
- Debugging flaky or failing `npm run test:e2e` runs
- **Fixing a user-visible bug** — add a repro E2E test first (TDD); see [Bug-fix TDD](#bug-fix-tdd-e2e-first)

**To run** tests locally or on staging (not author them), use the `run-e2e-automation` skill.

## Read first

1. `e2eTestFlows/pages-graph.md` — routes, auth zones, reachability
2. Relevant `e2eTestFlows/flows/<flow-id>.md` — case steps + assertions
3. `e2eTestFlows/index.md` — priority (P0/P1/P2) and what is already implemented
4. `commerce-platform-frontend/playwright/README.md` — env, projects, run commands

For copy-paste patterns and project rules, see [reference.md](reference.md).  
For a worked example, see [examples.md](examples.md).  
For bug-fix TDD with agent logging, see [examples-bug-fix-tdd.md](examples-bug-fix-tdd.md).

## Workflow checklist

Copy and track progress:

```
- [ ] Read pages-graph + flow file; confirm case id and auth (signed-in / guest / either)
- [ ] Bug fix? Write failing E2E repro first, then implement fix (see Bug-fix TDD below)
- [ ] Update pages-graph if routes or auth zones changed
- [ ] Add or update flow case in e2eTestFlows/flows/ (steps + assertions + notes)
- [ ] Implement test in commerce-platform-frontend/playwright/tests/
- [ ] Reuse playwright/helpers/; add helpers only when shared across 2+ specs
- [ ] Agent/LLM case? Use captureAgentResponseReview + [agent-response-review] logging
- [ ] Cross-link case id in a comment at top of spec
- [ ] Pick correct Playwright project (chromium / chromium-guest / chromium-sign-out)
- [ ] Run affected spec (run-e2e-automation skill); grep [agent-response-review] in log
- [ ] Run npm test if component selectors changed (e.g. aria-label)
```

## Bug-fix TDD (E2E first)

For **every new user-visible bug fix** where Playwright can reach the surface:

1. **Document** the repro in `e2eTestFlows/flows/<flow>.md` (new case id).
2. **Write the spec** with assertions for the broken behavior (e.g. forbidden phrase present, missing UI).
3. **Run on main / pre-fix** — confirm **red** when feasible.
4. **Implement the fix** in backend/frontend.
5. **Run again** — confirm **green** + review `[agent-response-review]` logs for LLM cases.
6. **Pair PRs** across repos with matching `ALE-*` branches.

Example: ALE-85 — `chat-agent-response-03` asserts no off-topic redirect for dry hand skin; logs full assistant reply for post-run review.

Skip only when no UI surface or automation is infeasible — document the exception in the implementation plan.

## Implementing a test

### File layout

| Flow area | Test path |
|-----------|-----------|
| Auth | `playwright/tests/auth/*.spec.ts` |
| Navigation | `playwright/tests/navigation/*.spec.ts` |
| Chat | `playwright/tests/chat/*.spec.ts` |
| Routine | `playwright/tests/routine/*.spec.ts` |

One spec file per flow file is fine; split only when a flow grows large.

### Spec conventions

```typescript
import { test, expect } from "@playwright/test";
import { waitForSignedInApp } from "../../helpers/navigation";

// e2eTestFlows/flows/nav-floating-pill.md — nav-floating-pill-01

test("nav-floating-pill-01: chat to skincare routine", async ({ page }) => {
  await waitForSignedInApp(page);
  // ...
});
```

- Test title includes the **case id** from the flow file
- Top comment links flow file + case id
- Prefer `getByRole` / `getByLabel`; add `data-testid` only when roles are insufficient — document it in the flow file

### Auth projects (do not break session ordering)

| Project | Use for |
|---------|---------|
| `setup` | `@clerk/testing` sign-in → `.auth/user.json` (auth-sign-in-01) |
| `chromium` | Signed-in tests (default) |
| `chromium-guest` | Unsigned redirect tests — file must match `guest.spec.ts` or add `testMatch` in config |
| `chromium-sign-out` | Sign-out only — **must run last**; invalidates Clerk session server-side |

**Never** UI-fill the Clerk sign-in form in tests (bot protection). Use existing `playwright/auth.setup.ts` + `storageState`.

**Never** hardcode passwords. Read `E2E_TEST_USER_EMAIL` from env; see `e2eTestFlows/SETUP.md`.

### Assertion policy

- Assert **structure**, not exact LLM copy (bubbles, loading settled, cards/CTAs present)
- Use `test.slow()` or longer `expect` timeouts for agent/GraphQL paths
- Use `test.skip(condition, reason)` for data-dependent cases (e.g. empty routine)
- **LLM / agent turns:** use `playwright/helpers/agentResponseReview.ts`
  - Call `captureAgentResponseReview()` after the agent turn completes
  - Logs **`[agent-response-review]`** + JSON (grep after run; see `run-e2e-automation` skill)
  - Assert stable heuristics (`hasOffTopicRedirect`, min length, etc.) — not verbatim reply text
  - Document expected behavior in the flow case `Notes` section for post-run review

### Helpers

Use `playwright/helpers/navigation.ts`:

- `waitForSignedInApp` — signed-in shell on `/chat`
- `waitForChatComposer` — active thread + enabled composer (clicks **New chat** if needed)
- `mainNav`, `routineNavLink`, `chatNavLink`, `chatComposer`

**Agent response review** (`playwright/helpers/agentResponseReview.ts`):

- `captureAgentResponseReview(page, { caseId, userMessage, expectOnTopicSkincare? })`
- `AGENT_RESPONSE_REVIEW_LOG_PREFIX` — `"[agent-response-review]"` marker for log grep
- `reviewAgentResponse()` — pure heuristics for unit-style checks in specs

## Running tests

Use the **`run-e2e-automation`** skill to run locally or on staging and review logs.

Quick local reference:

```bash
# Terminals 1–2: backend + frontend dev servers
cd commerce-platform-frontend
npm run test:e2e                              # full suite
npx playwright test playwright/tests/chat/    # one folder
npm run test:e2e:headed                       # watch in browser
npm run test:e2e:ui                           # Playwright UI mode
```

Pre-push in frontend repo: `npm run build`, `npm test`, and run affected E2E specs.

## PR checklist

When E2E coverage ships with a feature:

- [ ] `e2eTestFlows/pages-graph.md` updated if routes changed
- [ ] Flow case documented in `e2eTestFlows/flows/`
- [ ] Playwright spec with case-id comment
- [ ] Correct auth project; sign-out tests isolated if added
- [ ] Local green: affected spec + `npm test` if UI a11y labels changed
- [ ] Commit message starts with Linear ticket (e.g. `ALE-82 …`)

## Out of scope (v1)

- CI / GitHub Actions E2E
- Google OAuth in Playwright
- Visual regression baselines
- Pinning exact assistant message text
