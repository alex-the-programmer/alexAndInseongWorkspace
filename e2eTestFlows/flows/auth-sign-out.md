# Flow: auth-sign-out

**Priority:** P0  
**Auth:** signed-in (use `storageState`)  
**Preconditions:** Authenticated session.

## Cases

### auth-sign-out-01: Sign out from account menu

- **Steps:**
  1. From any signed-in page with header (e.g. `/chat/:id`)
  2. Open **Account menu** (avatar trigger)
  3. Click **Sign out**
- **Assertions:**
  - Lands on `/` (landing)
  - Landing hero visible (e.g. **Message Dewly** textbox or **Log in** button)
  - `/chat` redirects to `/` with sign-in modal if visited directly while signed out
