# Worked example — add P1 landing redirect test

This validates the skill workflow using a **not-yet-implemented** case. Follow the same steps for any new flow.

## Goal

Implement `landing-signed-in-redirect-01` from `e2eTestFlows/flows/landing-signed-in-redirect.md`.

## Step 1 — Read specs

- `e2eTestFlows/pages-graph.md`: `/` redirects signed-in users to `/chat`
- Flow file: signed-in user visiting `/` ends on `/chat`

## Step 2 — Update catalog (if missing)

Ensure `e2eTestFlows/index.md` lists the flow and priority.

## Step 3 — Add spec

Create `commerce-platform-frontend/playwright/tests/navigation/landing-redirect.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

// e2eTestFlows/flows/landing-signed-in-redirect.md — landing-signed-in-redirect-01

test("landing-signed-in-redirect-01: signed-in user visiting / goes to chat", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/chat(\/.+)?$/);
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
});
```

Uses default `chromium` project (storageState from setup). No new helpers needed.

## Step 4 — Run

```bash
cd commerce-platform-frontend
npx playwright test playwright/tests/navigation/landing-redirect.spec.ts
```

## Step 5 — PR

- Flow doc already in `e2eTestFlows/flows/landing-signed-in-redirect.md`
- New spec + green local run
- Commit: `ALE-82 add landing signed-in redirect E2E test`

---

## Existing implementation reference

These P0 cases are already implemented — use as templates:

| Case id | Spec file |
|---------|-----------|
| nav-floating-pill-01–03 | `playwright/tests/navigation/floating-nav.spec.ts` |
| chat-new-message-01–02 | `playwright/tests/chat/new-message.spec.ts` |
| auth-sign-out-01 | `playwright/tests/auth/sign-out.spec.ts` |
| routine-view-02 (guest) | `playwright/tests/auth/guest.spec.ts` |

When updating an existing flow, edit the flow markdown **and** the matching spec; re-run that file only.
