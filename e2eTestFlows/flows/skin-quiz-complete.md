# Flow: skin-quiz-complete

**Priority:** P1  
**Auth:** signed-in  
**Preconditions:** Authenticated session.

## Cases

### skin-quiz-complete-01: Modal quiz from routine page

- **Steps:**
  1. On `/skincare-routine`, complete manual routine setup
  2. Click **Take the skin quiz**
  3. Dialog **Skin quiz** opens; complete intro → questions → finish
- **Assertions:**
  - Modal closes after completion
  - Routine page shows **Retake the skin quiz** after regeneration
- **Notes:** Long flow; regeneration can take 30s+.

### skin-quiz-complete-02: Legacy `/quizzes/skin-quiz` redirects to routine modal

- **Steps:**
  1. Go to `/quizzes/skin-quiz` while signed in
- **Assertions:**
  - Redirects to `/skincare-routine`
  - **Skin quiz** dialog opens (no full-page legacy quiz)
  - Quiz can be completed in the modal

### skin-quiz-complete-03: `openSkinQuiz` deep link on empty routine

- **Steps:**
  1. Fresh user → `/skincare-routine?openSkinQuiz=1` (same URL as chat CTA)
  2. Complete quiz in modal
- **Assertions:**
  - Modal opens without established routine chrome flash
  - Modal closes after completion

### skin-quiz-retake-01: Retake after first modal completion

- **Steps:**
  1. Complete modal quiz from routine page (after manual setup)
  2. Click **Retake the skin quiz** → **Retake quiz** → finish again
- **Assertions:**
  - Modal closes; hero still offers **Retake the skin quiz**

### skin-quiz-retake-02: Retake modal quiz from routine hero

- **Steps:**
  1. Complete modal quiz from routine page (after manual routine setup)
  2. Click **Retake the skin quiz** on hero → **Retake quiz** in modal → finish
- **Assertions:**
  - Modal closes; hero still offers **Retake the skin quiz**

## Reset policy

Cases that require a fresh profile call `resetE2eUserData()` in `beforeEach` (see `scripts/resetE2eTestUserData.mjs`).

## Chat CTA (ALE-92)

- **Take the Skin Quiz** → `/skincare-routine?openSkinQuiz=1` (modal on routine page)
- **Set up my routine** → `/skincare-routine?openSetup=1` (setup modal)

Signed-in visits to `/quizzes/skin-quiz` redirect to the skin quiz modal deep link.
