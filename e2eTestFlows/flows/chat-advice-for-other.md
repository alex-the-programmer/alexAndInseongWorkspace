# Flow: chat-advice-for-other

**Priority:** P1  
**Auth:** signed-in  
**Ticket:** ALE-10

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
