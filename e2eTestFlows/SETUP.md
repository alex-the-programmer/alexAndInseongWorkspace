# E2E local setup

## 1. Stack

```bash
# Terminal 1 — backend
cd commerce-platform-backend && npm run dev

# Terminal 2 — frontend
cd commerce-platform-frontend && npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3020 |
| GraphQL | http://localhost:4020/api/public |

## 2. Dedicated Clerk test user

Playwright uses a **single shared user** in the Clerk **development** instance.

**Recommended email:** `e2e+playwright@example.com` (Clerk dev accepts `example.com`).

### Option A — Script (preferred)

From `commerce-platform-frontend` (requires `CLERK_SECRET_KEY` in `.env.local`):

```bash
node scripts/createE2eTestUser.mjs
```

Creates the user via Clerk Backend API and appends `E2E_TEST_USER_EMAIL` / `E2E_TEST_USER_PASSWORD` to `.env.local` if missing.

### Option B — Clerk Dashboard

1. Clerk Dashboard → **Users** → **Create user**
2. Email + password (no OAuth)
3. Add to `commerce-platform-frontend/.env.local`:

```bash
E2E_TEST_USER_EMAIL=e2e+playwright@example.com
E2E_TEST_USER_PASSWORD=<your-password>
```

### Option C — Sign-up UI + dev OTP

1. Go to http://localhost:3020/sign-up
2. Register with chosen email/password
3. If email verification appears, use Clerk dev code **`424242`**
4. Copy credentials into `.env.local` as above

**Never commit** `.env.local` or passwords.

## 3. Verify sign-in manually

1. Sign out if needed
2. http://localhost:3020/sign-in
3. Sign in with E2E credentials → should land on `/chat`

## 4. Next steps (Phase 2)

After setup, Phase 2 adds Playwright `auth.setup.ts` that reads these env vars and saves `.auth/user.json` for reuse.
