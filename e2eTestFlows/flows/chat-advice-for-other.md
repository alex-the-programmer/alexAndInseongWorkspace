# Flow: chat-advice-for-other

**Priority:** P1  
**Auth:** signed-in  
**Ticket:** ALE-10, ALE-106

## Cases

### chat-advice-for-other-01: Third-party advice pivots with share nudge

- **Steps:**
  1. Fresh chat
  2. Send `My friend has oily skin, what should she use?`
- **Assertions:**
  - Share nudge visible
  - No product cards
  - `[agent-response-review]`: no off-topic redirect; share pivot language
- **Spec:** `playwright/tests/chat/advice-for-other.spec.ts`

### chat-advice-for-other-02: First-person body-part complaint does not show share nudge (ALE-106)

- **Steps:**
  1. Fresh chat
  2. Send `after swimming a lot, my hands are super dry`
- **Assertions:**
  - Share nudge **not** visible
  - `[agent-response-review]`: on-topic skincare; no share-pivot language; no off-topic redirect
  - Product cards may appear if the agent delivers immediately — primary signal is **no share nudge**
- **Spec:** `playwright/tests/chat/advice-for-other.spec.ts`

### chat-advice-for-other-03: Follow-up product pick delivers without share nudge (ALE-106)

- **Steps:**
  1. Fresh chat
  2. Send `after swimming a lot, my hands are super dry`
  3. Wait for assistant reply
  4. Send `perhaps a good thick hand cream would be best`
- **Assertions:**
  - Share nudge **not** visible on any assistant message
  - After step 4: product cards **or** substantive on-topic reply without deferral-only stub
  - `[agent-response-review]`: no share-pivot language on either turn
- **Notes:** Product cards preferred; if agent gives guidance without cards, `hasDeferralStub` must be false.
- **Spec:** `playwright/tests/chat/advice-for-other.spec.ts`
