# Flow: skin-quiz-complete

**Priority:** P1  
**Auth:** signed-in  
**Preconditions:** Authenticated session.

## Cases

### skin-quiz-complete-01: Modal quiz from routine page

- **Steps:**
  1. On `/skincare-routine`, click **Take the skin quiz**
  2. Dialog **Skin quiz** opens
  3. Complete intro → answer questions → finish
- **Assertions:**
  - Quiz progresses through phases (intro → questions → results/loading)
  - On completion, modal closes or routine page shows updated state
  - Optional: URL gains `generateRoutine=1` or recommendations drawer opens
- **Notes:** Long flow; may use minimal answers. Regeneration can take 30s+.

### skin-quiz-complete-02: Full-page quiz route

- **Steps:**
  1. Go to `/quizzes/skin-quiz`
  2. Complete quiz flow
- **Assertions:**
  - Results screen shows **Go to chat →** or **Done**
  - Navigation to `/chat` or `/skincare-routine` works
- **Notes:** No floating header on quiz route.

### skin-quiz-complete-03: Chat CTA to quiz

- **Steps:**
  1. From chat, click assistant CTA **Take the Skin Quiz** (if present)
- **Assertions:**
  - Navigates to `/quizzes/skin-quiz`
- **Notes:** Data-dependent; tie to P2 chat CTA case or seed new user.

### skin-quiz-retake-01: Retake from full-page results

- **Steps:**
  1. Complete full-page quiz
  2. On results, click **Retake quiz** and complete again
- **Assertions:**
  - Results screen returns after second completion

### skin-quiz-retake-02: Retake modal quiz from routine hero

- **Steps:**
  1. Complete modal quiz from routine page (after manual routine setup)
  2. Click **Retake the skin quiz** on hero → **Retake quiz** in modal → finish
- **Assertions:**
  - Modal closes; hero still offers **Retake the skin quiz**

## Reset policy

Cases that require a fresh profile call `resetE2eUserData()` in `beforeEach` (see `scripts/resetE2eTestUserData.mjs`).
