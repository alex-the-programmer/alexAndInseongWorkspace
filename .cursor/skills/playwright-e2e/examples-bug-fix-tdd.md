# Worked example — bug-fix TDD (ALE-85)

## Bug

Shopping agent falsely redirects on-topic skincare advice: *"tell me what to do for my dry hand skin"* → off-topic redirect.

## Step 1 — Flow case (before fix)

Add `chat-agent-response-03` to `e2eTestFlows/flows/chat-agent-response.md` with:

- Repro user message
- Assert: no `not really equipped to answer` in reply
- Notes: grep `[agent-response-review]` after run

## Step 2 — Failing spec (on main / pre-fix)

`playwright/tests/chat/skincare-advice-on-topic.spec.ts`:

```typescript
const review = await captureAgentResponseReview(page, {
  caseId: "chat-agent-response-03",
  userMessage: "tell me what to do for my dry hand skin",
  expectOnTopicSkincare: true,
});
expect(review.heuristics.hasOffTopicRedirect).toBe(false);
```

Run → **red** on unfixed backend.

## Step 3 — Fix backend

Implement guard + prompt changes (ALE-85).

## Step 4 — Green + log review

```bash
npx playwright test playwright/tests/chat/skincare-advice-on-topic.spec.ts \
  --project=chromium 2>&1 | tee /tmp/e2e-run.log
grep '\[agent-response-review\]' /tmp/e2e-run.log
```

Expect `verdict: "pass"`, `hasOffTopicRedirect: false`, substantive `assistantText`.

## Step 5 — PRs

- Backend fix PR
- Frontend E2E PR (can ship together)
