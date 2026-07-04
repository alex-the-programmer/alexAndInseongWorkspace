# Flow: landing-signed-in-redirect

**Priority:** P1  
**Auth:** signed-in  
**Preconditions:** Authenticated session.

## Cases

### landing-signed-in-redirect-01: Home redirects to chat

- **Steps:**
  1. Go to `/`
- **Assertions:**
  - URL becomes `/chat` or `/chat/:id` (not landing hero)
  - Chat UI visible
