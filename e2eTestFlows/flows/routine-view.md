# Flow: routine-view

**Priority:** P0  
**Auth:** signed-in  
**Preconditions:** Authenticated session.

## Cases

### routine-view-01: Signed-in user sees routine page

- **Steps:**
  1. Go to `/skincare-routine`
- **Assertions:**
  - Page shows routine chrome: **Morning** / **Evening** toggle and/or setup CTAs

### routine-view-02: Unsigned user redirected to sign-in

- **Steps:**
  1. Without auth, go to `/skincare-routine`
- **Assertions:**
  - Redirected to `/` with landing **sign-in modal** open (not Clerk hosted `/sign-in`)
  - Modal shows log-in copy, not “You've started a chat…”
- **Notes:** Signed-out project / fresh context (no `storageState`). ALE-83 middleware + home modal redirect.

### routine-view-03: Morning / Evening toggle

- **Steps:**
  1. On routine page with existing steps, click **Evening** then **Morning**
- **Assertions:**
  - Active toggle state changes (aria-pressed or visual active class)
  - Step list updates or remains consistent with time-of-day
- **Notes:** Skip if test user has empty routine — use user with seeded routine or assert empty-state CTAs instead.
