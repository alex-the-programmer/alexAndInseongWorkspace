# Flow: chat-opening-nudge

**Priority:** P1  
**Auth:** signed-in  
**Ticket:** ALE-6

## Cases

### chat-opening-nudge-01: Opening nudge when quiz missing

- **Steps:**
  1. `resetE2eUserData()`
  2. Fresh chat (opening turn auto-generated)
- **Assertions:**
  - **Take the Skin Quiz** CTA visible
  - No product cards on opening
- **Spec:** `playwright/tests/chat/opening-nudge.spec.ts`
