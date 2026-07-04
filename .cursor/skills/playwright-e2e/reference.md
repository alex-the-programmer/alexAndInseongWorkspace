# Playwright E2E reference

## Signed-in test scaffold

```typescript
import { test, expect } from "@playwright/test";
import { waitForSignedInApp, mainNav } from "../../helpers/navigation";

// e2eTestFlows/flows/<flow>.md — <case-id>

test("<case-id>: short title", async ({ page }) => {
  await waitForSignedInApp(page);
  await expect(mainNav(page)).toBeVisible();
});
```

## Guest redirect test

Put in `playwright/tests/auth/guest.spec.ts` (or extend `testMatch` in `playwright.config.ts`):

```typescript
import { expectHomeSignInWall } from "../../helpers/navigation";

test("unsigned user visiting /some-protected-route is redirected to home sign-in modal", async ({
  page,
}) => {
  await page.goto("/some-protected-route");
  await expectHomeSignInWall(page);
});
```

## Chat message test

```typescript
import { test, expect } from "@playwright/test";
import { chatComposer, waitForChatComposer } from "../../helpers/navigation";

test("<case-id>: send user message", async ({ page }) => {
  await waitForChatComposer(page);

  const message = "Unique test message";
  await chatComposer(page).fill(message);
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByText(message, { exact: true })).toBeVisible({
    timeout: 15_000,
  });
});
```

## Floating nav navigation

```typescript
import { routineNavLink, chatNavLink, waitForSignedInApp } from "../../helpers/navigation";

test.beforeEach(async ({ page }) => {
  await waitForSignedInApp(page);
});

// Chat → Routine
await routineNavLink(page).click();
await expect(page).toHaveURL("/skincare-routine");

// Routine → Chat
await chatNavLink(page).click();
await expect(page).toHaveURL(/\/chat/);
```

## Sign-out test

Only in `playwright/tests/auth/sign-out.spec.ts` (runs in `chromium-sign-out` project):

```typescript
import { waitForSignedInApp } from "../../helpers/navigation";

test("auth-sign-out-01: sign out from account menu", async ({ page }) => {
  await waitForSignedInApp(page);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page
    .getByRole("menu", { name: "Account menu" })
    .getByRole("button", { name: "Sign out" })
    .click();
  await expect(page).toHaveURL("/");
});
```

## Waiting for GraphQL / async UI

Prefer Playwright auto-waiting and `expect.poll`:

```typescript
await expect(page.getByText("Loading")).not.toBeVisible({ timeout: 30_000 });
await expect.poll(async () => page.getByRole("article").count()).toBeGreaterThan(0);
```

Avoid bare `page.waitForTimeout()` unless debugging.

## Flow file template

```markdown
# Flow: my-new-flow

**Priority:** P1
**Auth:** signed-in | signed-out | either
**Preconditions:** ...

## Cases

### my-new-flow-01: short title

- **Steps:**
  1. ...
- **Assertions:**
  - ...
- **Notes:** data deps, skip conditions, selectors (`data-testid` if any)
```

## Agent / LLM response review

For chat or agent E2E cases, capture and log assistant output for post-run review — do not pin exact LLM copy.

```typescript
import {
  captureAgentResponseReview,
  AGENT_RESPONSE_REVIEW_LOG_PREFIX,
} from "../../helpers/agentResponseReview";

test.slow();

test("chat-agent-response-03: dry hand skin stays on-topic", async ({ page }) => {
  // ... send userMessage ...
  const review = await captureAgentResponseReview(page, {
    caseId: "chat-agent-response-03",
    userMessage: "tell me what to do for my dry hand skin",
    expectOnTopicSkincare: true,
    timeoutMs: 120_000,
  });

  expect(review.heuristics.hasOffTopicRedirect).toBe(false);
});
```

After the run:

```bash
grep '\[agent-response-review\]' /tmp/e2e-run.log
```

Each line is JSON with `verdict`, `assistantText`, `heuristics`, and `notes`. The agent running `run-e2e-automation` compares these to the flow case's expected behavior.

Reference: `playwright/tests/chat/skincare-advice-on-topic.spec.ts` (ALE-85).

## Config reminders

From `playwright.config.ts`:

- `baseURL`: `process.env.E2E_BASE_URL ?? "http://localhost:3020"`
- `workers: 1`, `fullyParallel: false` — shared E2E Clerk user
- Guest specs: `testMatch: /guest\.spec\.ts/`
- Sign-out specs: separate project depending on `chromium`

## Env vars (`.env.local`, gitignored)

```bash
E2E_TEST_USER_EMAIL=e2e+playwright@example.com
CLERK_SECRET_KEY=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
```

Provision user: `node scripts/createE2eTestUser.mjs`

## Common failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Redirect to Clerk sign-in mid-suite | Sign-out ran before other authed tests | Keep sign-out in `chromium-sign-out` project only |
| Guest test hits Clerk hosted sign-in | Old middleware default | Expect `/` + landing sign-in dialog (`expectHomeSignInWall`) |
| Composer disabled on `/chat` | No active thread | Use `waitForChatComposer` or click **New chat** |
| Strict mode violation on "Message" | Matches textarea + button | Use `getByRole('textbox', { name: 'Message' })` |
| UI sign-in fails | Clerk bot protection | Use `@clerk/testing` in `auth.setup.ts`, not form fill |
