# Flow: chat-agent-response

**Priority:** P1  
**Auth:** signed-in  
**Preconditions:** Backend + agent available; expect **30–120s** for turn completion.

## Assertion policy (agreed)

- Assert **structure**, not exact LLM copy
- Log **`[agent-response-review]`** JSON per agent turn (`captureAgentResponseReview`) for post-run quality review
- Future batch quality evals → Langfuse (out of scope for Playwright)

## Cases

### chat-agent-response-01: Assistant turn completes

- **Steps:**
  1. Send a simple message (e.g. `Hello`)
  2. Wait for loading state to finish
- **Assertions:**
  - An assistant message region appears after the user message
  - Assistant bubble contains non-empty text (`toHaveText` with min length, not exact string)
  - No persistent error banner (see `chatActionError` patterns)
- **Notes:** Mark `test.slow()`; timeout ≥ 120s. Flaky if backend/agent down.

### chat-agent-response-02: Send button disabled while in flight

- **Steps:**
  1. Send a message
  2. Immediately check composer controls
- **Assertions:**
  - **Send message** disabled or loading indicator visible during turn
- **Notes:** Optional P1; timing-sensitive.

### chat-agent-response-03: Skincare advice stays on-topic (ALE-85)

- **Steps:**
  1. Send `tell me what to do for my dry hand skin`
  2. Wait for agent turn to complete
- **Assertions:**
  - Assistant reply does **not** contain the off-topic redirect (`not really equipped to answer`)
  - No contradictory redirect + skincare offer in the same message
  - Reply has non-trivial length
- **Notes:** `test.slow()`; timeout ≥ 120s. Playwright logs `[agent-response-review] {json}` for post-run analysis — grep test output or CI logs. Product cards are logged but not required (agent may ask a clarifying question first). Implemented in `playwright/tests/chat/skincare-advice-on-topic.spec.ts`.
