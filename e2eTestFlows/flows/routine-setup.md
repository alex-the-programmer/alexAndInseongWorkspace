# Flow: routine-setup

**Priority:** P1  
**Auth:** signed-in  
**Preconditions:** `resetE2eUserData()` clears quiz, routine, and profile memory before each case.

## Cases

### routine-setup-01: Initial setup from empty state

- **Steps:**
  1. On `/skincare-routine`, click **Set up my routine**
  2. In **Set up your routine** dialog, enable **Cleanser** (Morning) and **Save routine**
- **Assertions:**
  - Empty-state CTA is gone
  - **Morning routine** heading and **Morning** / **Evening** toggle visible

### routine-setup-02: Repeat setup after reset

- **Steps:**
  1. Complete routine-setup-01
  2. Run `resetE2eUserData()` and reload
  3. Complete setup again
- **Assertions:**
  - Empty state returns after reset
  - Second setup succeeds with routine chrome visible

### routine-setup-03: Extend routine on a second pass

- **Steps:**
  1. Complete routine-setup-01
  2. Switch to **Evening**, add custom product via **Add a step**
  3. Switch back to **Morning**
- **Assertions:**
  - Evening product visible on PM slot
  - Morning slot unchanged (evening product not shown)

## Notes

- Uses `playwright/helpers/routineSetup.ts` and `scripts/resetE2eTestUserData.mjs`.
- **Re-do my routine** (onboarding quiz) is heavier — covered separately if needed.
