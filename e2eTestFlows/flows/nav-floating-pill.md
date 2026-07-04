# Flow: nav-floating-pill

**Priority:** P0  
**Auth:** signed-in  
**Preconditions:** Authenticated session; on `/chat` or `/chat/:id`.

## Cases

### nav-floating-pill-01: Chat → Routine

- **Steps:**
  1. From `/chat/:id`, click **Your Skincare Routine** (desktop label) or **Routine** (mobile)
- **Assertions:**
  - URL is `/skincare-routine`
  - Routine page content visible (hero or step list)

### nav-floating-pill-02: Routine → Chat

- **Steps:**
  1. From `/skincare-routine`, click **Chat** in floating nav
- **Assertions:**
  - URL matches `/chat` or `/chat/:id`
  - Chat composer or message list visible

### nav-floating-pill-03: Logo returns to chat when signed in

- **Steps:**
  1. From `/skincare-routine`, click **Dewly** wordmark / home link
- **Assertions:**
  - Navigates to `/chat` (not `/`)
