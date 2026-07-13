# Flow: routine-recommendation-drawer-layering

**Priority:** P1  
**Auth:** signed-in  
**Preconditions:** E2E user with manual routine + completed skin quiz; `generateSkincareRoutine` produces recommendations.

## Cases

### routine-drawer-layering-01: Drawer stacks above header chrome (ALE-100)

- **Steps:**
  1. Reset E2E user; set up manual routine; complete skin quiz modal
  2. Wait for routine regeneration to finish
  3. Open **View recommendations** drawer
  4. Probe top-right of drawer panel with `elementFromPoint` — must hit drawer content, not header nav pill or account trigger
  5. (Optional) Open account menu; repeat probe — menu must not be topmost over drawer
- **Assertions:**
  - `[data-testid="recommendations-drawer"]` / dialog visible
  - `expectDrawerAboveHeader` returns `ok: true`
  - Skip when no recommendations after regeneration
- **Spec:** `playwright/tests/routine/recommendation-drawer-layering.spec.ts`
- **Notes:** Regression for stacking-context trap — drawer was capped by `.commerceRoutinePageShell__content { z-index: 1 }` and rendered under fixed header (`--z-header: 100`).
