# Flow: landing-signed-out

**Priority:** P1  
**Auth:** signed-out  
**Preconditions:** No active Clerk session.

## Cases

### landing-signed-out-01: Landing renders core chrome

- **Steps:**
  1. Go to `/`
- **Assertions:**
  - **Message Dewly** textbox visible
  - **Log in** and **Sign up** buttons in header
  - At least one starter chip button visible (e.g. breakout-related chip)

### landing-signed-out-02: Starter chip opens sign-up wall

- **Steps:**
  1. On `/`, click a starter chip (e.g. **Help with breakouts on my chin**)
- **Assertions:**
  - Dialog **Create your free Dewly account** (or login variant) opens
  - **Continue with Google** or email path available

### landing-signed-out-03: Hero submit opens sign-up wall

- **Steps:**
  1. Type a short message in **Message Dewly**
  2. Click **Send**
- **Assertions:**
  - Sign-up wall dialog opens (message stored for post-auth pending send)
