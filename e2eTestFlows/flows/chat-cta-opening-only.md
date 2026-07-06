# Flow: chat-cta-opening-only

**Priority:** P1  
**Auth:** signed-in  
**Ticket:** ALE-95

Quiz/routine CTA buttons must appear only on the greeting opening turn, not when the user's first message is a real question (homepage pending-message path).

## Cases

### chat-cta-no-opening-01: No CTAs when chat starts with pending homepage message

- **Preconditions:** `resetE2eUserData()` — quiz and routine incomplete.
- **Steps:**
  1. Store sensitive-skin landing starter as pending chat message (simulates homepage → auth).
  2. Navigate to `/chat` and wait for assistant reply.
  3. Reload page (exercises `getChatMessages` hydration).
- **Assertions:**
  - User message visible (sensitive-skin starter text).
  - **Take the Skin Quiz** not visible.
  - **Set up my routine** not visible (before and after reload).
- **Spec:** `playwright/tests/chat/cta-opening-only.spec.ts`

### Related positive case

- `chat-opening-nudge-01` in `chat-opening-nudge.md` — fresh chat with greeting still shows CTAs (ALE-6).
