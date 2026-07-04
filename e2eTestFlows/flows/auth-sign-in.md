# Flow: auth-sign-in

**Priority:** P0  
**Auth:** signed-out  
**Preconditions:** E2E test user exists in Clerk dev instance; `E2E_TEST_USER_EMAIL` and `E2E_TEST_USER_PASSWORD` set in `.env.local`.

## Cases

### auth-sign-in-01: Email/password happy path

- **Steps:**
  1. Go to `/sign-in`
  2. Fill email and password from env
  3. Click **Sign in**
- **Assertions:**
  - URL becomes `/chat` or `/chat/:id`
  - **Chat** link visible in floating nav (signed-in chrome)
- **Notes:** Use `storageState` from this flow for all other signed-in tests.

### auth-sign-in-02: Already signed in redirects away

- **Steps:**
  1. With active session, go to `/sign-in`
- **Assertions:**
  - Redirected to `/chat` (or `/chat/:id`)
- **Notes:** Can run as follow-up in same project after setup.

### auth-sign-in-03: Invalid password shows error

- **Steps:**
  1. Go to `/sign-in`
  2. Enter valid email, wrong password
  3. Submit
- **Assertions:**
  - Remains on `/sign-in`
  - Error feedback visible (Clerk field error or form error state)
- **Notes:** P1 if Clerk error copy is unstable; skip in v1 if flaky.
