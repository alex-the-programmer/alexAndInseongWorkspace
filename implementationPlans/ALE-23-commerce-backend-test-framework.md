# ALE-23 — Commerce Platform Backend: Test Framework Setup

## Goal

Establish a working test framework for `commerce-platform-backend` so the team can write and run tests confidently. This is not about achieving full coverage — it is about having the right tools in place and a handful of working examples.

Scope: **`commerce-platform-backend` only** (not scrapers, not frontends for this ticket).

---

## 1. Coverage Tool

**Choice: Jest built-in coverage (Istanbul/c8 via `@jest/coverage-provider`)**

Jest ships with Istanbul coverage out of the box via `--coverage`. It produces:
- `text` summary in the terminal
- `lcov` report (readable by CI tools and editors)
- `html` report in `coverage/`

No extra package needed beyond Jest itself.

---

## 2. Test Runner

**Choice: Jest + ts-jest (ESM mode)**

Rationale:
- `jest-prisma` (required for auto-rollback) is a Jest-specific environment — it cannot be used with Vitest or Node's built-in test runner.
- The project uses `"type": "module"` + `"module": "NodeNext"` in tsconfig. Jest supports ESM via `--experimental-vm-modules` (stable enough for test use).
- `ts-jest` in ESM mode handles TypeScript + `.js`-suffixed imports transparently.

The existing `"test": "tsx --test ..."` script in `package.json` will be replaced.

---

## 3. Packages to Install

### Production (none — all test-only)

### Dev dependencies

```
jest
ts-jest
@types/jest
jest-environment-node          # base env used by jest-prisma
@quramy/jest-prisma-node       # Jest environment that wraps each test in a rolled-back transaction
@quramy/prisma-fabbrica        # factory builder for Prisma models (rspec-like)
dotenv-cli                     # already present; used in test npm script
```

No new production deps.

---

## 4. Configuration Files to Create / Modify

### 4.1 `jest.config.ts` (new)

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: '@quramy/jest-prisma-node/environment',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // Rewrite *.js imports to the actual TS source so Jest can resolve them
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/graphql/generatedTypes.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  setupFilesAfterFramework: [],  // reserved for global test helpers
};

export default config;
```

### 4.2 `jest.setup.ts` (new, optional global setup)

Empty initially; referenced from `setupFilesAfterFramework` once needed.

### 4.3 `package.json` — update `scripts`

Replace the existing `test` script and add coverage:

```json
"test": "dotenv-cli -e .env -e .env.local -- node --experimental-vm-modules node_modules/.bin/jest",
"test:watch": "dotenv-cli -e .env -e .env.local -- node --experimental-vm-modules node_modules/.bin/jest --watch",
"test:coverage": "dotenv-cli -e .env -e .env.local -- node --experimental-vm-modules node_modules/.bin/jest --coverage"
```

### 4.4 `src/interactions/getPrismaClient.ts` — expose client for tests

`jest-prisma` injects a transaction-wrapped Prisma client via `jestPrisma.client`. The interaction files currently call `getPrismaClient()` which returns a module-level singleton. To allow tests to override it, we need a thin swap mechanism:

```ts
// getPrismaClient.ts — add test hook
import { PrismaClient } from '@prisma/client';

let _client: PrismaClient | null = null;

export function setPrismaClient(client: PrismaClient) {
  _client = client;
}

export default function getPrismaClient(): PrismaClient {
  if (_client) return _client;
  if (!_global) _global = new PrismaClient();
  return _global;
}

let _global: PrismaClient | null = null;
```

Each test file that hits the DB calls `setPrismaClient(jestPrisma.client)` in `beforeEach` and `setPrismaClient(null)` in `afterEach`, so rollback is automatic.

---

## 5. Factory Setup with `@quramy/prisma-fabbrica`

### 5.1 `src/__tests__/factories/index.ts` (new)

Define factories for the models we need in tests. Start with:

- `UserFactory` — `User` model (`clerkUserId` is the required unique field)
- `ChatFactory` — `Chat` model (requires a `User`)
- `ProductFactory` — `Product` model (requires `Brand` + `Category`)
- `CartProductFactory` — `CartProduct` model (requires `User`, `Chat`, `Product`)

Example shape:

```ts
import { defineUserFactory, defineChatFactory, ... } from '@quramy/prisma-fabbrica';

export const UserFactory = defineUserFactory({
  defaultData: {
    clerkUserId: () => `test_clerk_${Math.random().toString(36).slice(2)}`,
  },
});

export const ChatFactory = defineChatFactory({
  defaultData: async () => ({
    user: await UserFactory.create(),
    title: 'Test Chat',
    mastraThreadId: () => `thread_${Math.random().toString(36).slice(2)}`,
  }),
});
// ... etc
```

### 5.2 `src/__tests__/helpers/prismaSetup.ts` (new)

```ts
import { setPrismaClient } from '../../interactions/getPrismaClient.js';
import { initialize } from '@quramy/prisma-fabbrica';

export function usePrisma() {
  beforeEach(() => {
    setPrismaClient(jestPrisma.client);
    initialize({ prisma: jestPrisma.client });
  });
  afterEach(() => {
    setPrismaClient(null as any);
  });
}
```

Called at the top of any test file that touches the DB.

---

## 6. Interaction Tests (Real DB, Auto-Rollback)

### 6.1 `src/__tests__/interactions/cart/getMyCart.test.ts`

Tests to write:
- Returns empty array when no cart items exist for the user+chat
- Returns cart lines when cart products are present
- Throws when chatId does not belong to the user

### 6.2 `src/__tests__/interactions/catalog/searchProducts.test.ts`

Tests to write:
- Returns products matching an exact name substring
- Returns empty result for an unknown query
- Respects `take` and `skip` pagination params

### 6.3 `src/__tests__/interactions/users/ensureUser.test.ts`

Tests to write:
- Creates a new user row on first call with a new clerkUserId
- Returns existing user on second call (idempotent)

---

## 7. GraphQL Layer Tests

Use Apollo Server's `executeOperation` for in-process GraphQL testing — no HTTP needed.

### 7.1 `src/__tests__/graphql/helpers/buildTestServer.ts` (new)

Bootstraps an ApolloServer instance with the same schema + resolvers as production, but with:
- A fake context that injects a test `clerkUserId` instead of real Clerk auth
- The transaction-wrapped `jestPrisma.client` via `setPrismaClient`

### 7.2 `src/__tests__/graphql/myCart.query.test.ts`

Tests to write:
- `myCart` query returns `[]` for an authenticated user with no cart items
- `myCart` query returns cart lines after seeding via `CartProductFactory`
- `myCart` query throws/returns error for an invalid `chatId`

### 7.3 `src/__tests__/graphql/myChats.query.test.ts`

Tests to write:
- `myChats` returns empty list for new user
- `myChats` returns chats after seeding via `ChatFactory`
- `myChats` with `titleSearch` filters results correctly

---

## 8. Coverage Baseline

After the framework is in place and the sample tests pass, run `npm run test:coverage` to establish a baseline. The goal is not a specific percentage — just confirming the tooling works and generating the initial `lcov` report.

---

## Decisions Requiring Architect Approval

**No database changes in this ticket.** All tests run against the existing schema with auto-rollback — no migrations, no new tables.

---

## TODO

- [ ] Install dev dependencies (`jest`, `ts-jest`, `@types/jest`, `@quramy/jest-prisma-node`, `@quramy/prisma-fabbrica`)
- [ ] Create `jest.config.ts`
- [ ] Update `package.json` test scripts
- [ ] Modify `getPrismaClient.ts` to support client injection
- [ ] Create `src/__tests__/helpers/prismaSetup.ts`
- [ ] Create `src/__tests__/factories/index.ts` with User, Chat, Product, CartProduct factories
- [ ] Write interaction tests: `getMyCart`, `searchProducts`, `ensureUser`
- [ ] Create `src/__tests__/graphql/helpers/buildTestServer.ts`
- [ ] Write GraphQL tests: `myCart` query, `myChats` query
- [ ] Run `npm run test:coverage` and confirm all tests pass + coverage report generated
- [ ] Create PR for `commerce-platform-backend`
