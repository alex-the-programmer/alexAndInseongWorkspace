# Flow: chat-known-profile

**Priority:** P1  
**Auth:** signed-in  
**Ticket:** ALE-45 / ALE-37

## Cases

### chat-known-profile-01: Does not re-ask budget after skin quiz

- **Steps:**
  1. `resetE2eUserData()`
  2. Complete skin quiz at `/quizzes/skin-quiz`
  3. Fresh chat → `recommend a moisturizer for me`
- **Assertions:**
  - `reAsksKnownBudget: false`
- **Spec:** `playwright/tests/chat/known-profile.spec.ts`
