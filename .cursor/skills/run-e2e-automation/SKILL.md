---
name: run-e2e-automation
description: >-
  Run Playwright E2E tests for commerce-platform-frontend locally or against
  staging. Use when the user asks to run, test, or verify E2E automation,
  browser tests, Playwright locally, on staging, or preview; when validating
  a bug fix with automation; or when reviewing agent/LLM output from test logs.
---

# Run E2E automation

Run and review **commerce-platform-frontend** Playwright tests. For **writing** tests, use the `playwright-e2e` skill.

## 1. Pick environment

| User intent | Target | Action |
|-------------|--------|--------|
| "locally", "local dev", "on my machine", default | **Local** | Backend `:4020` + frontend `:3020` must be running |
| "staging", "preview", "deployed", "production-like" | **Staging** | Set `E2E_BASE_URL` + matching `NEXT_PUBLIC_GRAPHQL_URL` |

If unclear, **default to local** and start dev servers if not already up.

### Local prerequisites

```bash
# Terminal 1
cd commerce-platform-backend && npm run dev

# Terminal 2
cd commerce-platform-frontend && npm run dev
```

Verify: frontend `http://localhost:3020`, GraphQL `http://localhost:4020/api/public`.  
Clerk E2E user: `e2eTestFlows/SETUP.md`.

### Staging

```bash
cd commerce-platform-frontend
export E2E_BASE_URL="https://<staging-frontend-host>"
# .env.local must point GraphQL at the staging API for that environment:
# NEXT_PUBLIC_GRAPHQL_URL=https://<staging-api>/api/public
```

Playwright `baseURL` reads `E2E_BASE_URL` (see `playwright.config.ts`).  
Confirm staging has the E2E Clerk user or use credentials the user provides.

## 2. Run tests

Always tee output when agent/LLM cases may run — needed for post-run review.

```bash
cd commerce-platform-frontend

# Full suite
npm run test:e2e 2>&1 | tee /tmp/e2e-run.log

# Single spec (preferred when validating a fix)
npx playwright test playwright/tests/chat/skincare-advice-on-topic.spec.ts \
  --project=chromium 2>&1 | tee /tmp/e2e-run.log

# Headed (debug UI)
npm run test:e2e:headed -- playwright/tests/chat/skincare-advice-on-topic.spec.ts
```

**Project selection:** `chromium` (signed-in), `chromium-guest`, `chromium-sign-out` (must run last in full suite).

## 3. Review LLM / agent output

Tests that involve the shopping agent should log structured reviews using the marker:

**`[agent-response-review]`**

Extract and parse after the run:

```bash
grep '\[agent-response-review\]' /tmp/e2e-run.log
```

Each line is JSON with:

| Field | Use |
|-------|-----|
| `caseId` | Flow case (e.g. `chat-agent-response-03`) |
| `userMessage` | Prompt sent |
| `assistantText` | Captured reply |
| `verdict` | `pass` \| `warn` \| `fail` |
| `heuristics` | `hasOffTopicRedirect`, `mentionsSkincareTerms`, `productCardCount`, … |
| `notes` | Human-readable review hints |

**Agent workflow after a run:**

1. Read all `[agent-response-review]` lines from the log.
2. Compare to **expected behavior** in `e2eTestFlows/flows/<flow>.md` for that `caseId`.
3. Report: pass/fail, whether the bug repro is fixed, and whether output quality looks on-topic (even when structural asserts pass).
4. If `verdict` is `warn`, explain whether it is acceptable or needs follow-up.

Helper: `playwright/helpers/agentResponseReview.ts`  
Constant: `AGENT_RESPONSE_REVIEW_LOG_PREFIX`

## 4. Bug-fix validation checklist

When user asked to verify a bug fix:

```
- [ ] Correct environment (local vs staging)
- [ ] Dev servers up (local) or E2E_BASE_URL set (staging)
- [ ] Run the ticket's repro spec (or full chat folder)
- [ ] Playwright exit code green
- [ ] Grep [agent-response-review] — assistant behavior matches expectation
- [ ] Summarize findings for the user (quote assistantText if useful)
```

## 5. Common failures

| Symptom | Fix |
|---------|-----|
| Connection refused `:3020` | Start frontend dev server |
| GraphQL / agent errors | Start backend; check `NEXT_PUBLIC_GRAPHQL_URL` |
| Clerk sign-in redirect | Re-run `setup` project; check `E2E_TEST_USER_EMAIL` |
| Agent timeout | `test.slow()` spec; timeout 120s+; confirm OpenAI/backend keys |
| No `[agent-response-review]` lines | Spec may not use `captureAgentResponseReview` — add per `playwright-e2e` skill |

## Additional resources

- Setup: `e2eTestFlows/SETUP.md`
- Run commands: `commerce-platform-frontend/playwright/README.md`
- Write tests: `.cursor/skills/playwright-e2e/SKILL.md`
- Cursor rule: `.cursor/rules/e2e-automation.mdc`
