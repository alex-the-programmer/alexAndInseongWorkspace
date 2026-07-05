# Flow: chat-cta-routine-navigation

**Priority:** P1  
**Auth:** signed-in  
**Ticket:** [ALE-92](https://linear.app/dewly/issue/ALE-92/delay-when-switching-to-your-skincare-routine)  
**Preconditions:** `resetE2eUserData()` + `resetE2eAiUsageBudget()`; fresh user with no skin quiz and no routine items.

## Cases

### chat-cta-routine-01: Take the Skin Quiz CTA opens skin quiz modal

- **Steps:**
  1. `startFreshChat` (opening turn with CTAs)
  2. Click assistant CTA **Take the Skin Quiz**
- **Assertions:**
  - Navigates to `/skincare-routine` (not `/quizzes/skin-quiz`)
  - Does **not** flash established routine chrome (`what you use, daily`, `Morning routine`)
  - Dialog **Skin quiz** is visible with **Start quiz**
- **Spec:** `playwright/tests/chat/cta-routine-navigation.spec.ts`
- **Notes:** Backend CTA URL must be `/skincare-routine?openSkinQuiz=1`; one-time query param is stripped after open.

### chat-cta-routine-02: Set up my routine CTA opens setup modal

- **Steps:**
  1. `startFreshChat`
  2. Click assistant CTA **Set up my routine**
- **Assertions:**
  - Navigates to `/skincare-routine`
  - Does **not** flash established routine chrome
  - Dialog **Set up your routine** is visible (AM/PM step picker; e.g. **Cleanser** chip)
- **Spec:** `playwright/tests/chat/cta-routine-navigation.spec.ts`
- **Notes:** Backend CTA URL must be `/skincare-routine?openSetup=1`.

## Reset policy

`resetE2eUserData()` and `resetE2eAiUsageBudget()` in `beforeEach` (serial suite).
