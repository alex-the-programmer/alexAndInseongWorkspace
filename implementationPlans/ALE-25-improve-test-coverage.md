# ALE-XXX — Improve Test Coverage: Backend + Frontend

## Context

Following ALE-23 (test framework setup), both repos have baseline tests passing but significant coverage gaps remain:

- **Backend:** 31.8% statements / 18.9% branches. Biggest gaps: `interactions/catalog` (21%), `interactions/chat` (8%), `interactions/userMemory` (11%), `src/tools` (27%).
- **Frontend:** 26.6% statements / 20.0% branches. Biggest gaps: `components/quizRunner` (0%), `components/shopPage` (0%), `components/skincareRoutinePage` (0%), auth pages (0%). Helper function tests already exist for all three large components.

Goal: target the highest-value untested code with focused new test files, following existing patterns exactly.

---

## Repos and Branches

- `commerce-platform-backend` at `/Users/alexmarchenko/Projects/alexAndInseongWorkspace/commerce-platform-backend` — currently on `unit-tests` branch (merged to main). Create new branch from latest main.
- `commerce-platform-frontend` at `/Users/alexmarchenko/Projects/alexAndInseongWorkspace/commerce-platform-frontend` — on `main`. Create branch.

---

## Part 1 — Backend Interaction Tests

### 1.1 Update `src/__tests__/factories/index.ts`

Add exports for factories not yet wired up (all are generated in `src/__generated__/fabbrica/`):

```ts
export const SellerSpecFactory = defineSellerSpecFactory();
export const SellerSpecMappingFactory = defineSellerSpecMappingFactory({
  defaultData: { sellerSpec: SellerSpecFactory },
});
export const ProductSellerSpecFactory = defineProductSellerSpecFactory({
  defaultData: { product: ProductFactory, sellerSpec: SellerSpecFactory },
});
export const UserMemoryFactFactory = defineUserMemoryFactFactory({
  defaultData: { user: UserFactory },
});
```

Critical file: `src/__tests__/factories/index.ts`

---

### 1.2 New file: `src/__tests__/interactions/catalog/findProductsBySpecs.test.ts`

Source: `src/interactions/catalog/findProductsBySpecs.ts`

Tests to write:
1. Returns matching product IDs when a single stringValue filter matches
2. Returns intersection when two filters are both required (AND logic)
3. Returns empty when no product matches any filter
4. Returns empty array for empty filters input
5. Resolves `productSpecId` → sellerSpecId via `SellerSpecMapping` and still finds the product
6. Excludes products where `mergedIntoProductId` is set

Use: `ProductFactory`, `SellerSpecFactory`, `SellerSpecMappingFactory`, `ProductSellerSpecFactory`

---

### 1.3 New file: `src/__tests__/interactions/catalog/getShoppingProductCardsBatch.test.ts`

Source: `src/interactions/catalog/getShoppingProductCardsBatch.ts`

Tests to write:
1. Returns empty map for empty input
2. Returns card data including name, priceLabel, retailerName, productUrl for a product with a seller offer
3. Skips products that have no offers with a valid productUrl (no seller product)
4. Includes `ratingLabel` ("4.5/5") when a `ProductReviewSummary` row exists
5. Returns `null` ratingLabel when no review summary
6. Follows `mergedIntoProductId` one hop to find offers on the merged product

Use: `ProductFactory`, `SellerFactory`, `SellerProductFactory`, `CurrencyFactory`, `SellerProductPriceFactory`, `ProductReviewSummaryFactory`

Note: `buildSellerProductPageUrl` interpolates `{sku}` in `productUrlTemplate`. Set `productUrlTemplate` to `"https://store.example.com/p/{sku}"` and `sku` to `"ABC-123"` on test products.

---

### 1.4 New file: `src/__tests__/interactions/userMemory/buildUserMemorySummary.test.ts`

Source: `src/interactions/userMemory/buildUserMemorySummary.ts`

Tests to write:
1. Returns `"No durable user memory yet."` and `tokenEstimate: 7` when user has no ACTIVE facts
2. Returns a bullet-list summary of factTexts for a user with ACTIVE facts
3. Excludes ARCHIVED facts from the summary
4. Deduplicates facts with the same text (case-insensitive)
5. Respects `MAX_MEMORY_SUMMARY_LINES` by stopping at the cap

Use: `UserFactory`, `UserMemoryFactFactory`

---

### 1.5 New file: `src/__tests__/interactions/chats/summarizeChatForHistoryCard.test.ts`

Source: `src/interactions/chats/summarizeChatForHistoryCard.ts`

This interaction calls `chatSummarizationAgent` (an LLM). Only test the two early-return paths that bypass the LLM — both are well-defined DB-only code paths:

1. **No user turns:** Create a chat and call the function when there are no messages (or only assistant messages). Expect the function to return the chat record without calling the LLM.
2. **Empty transcript after filtering:** Create a chat with only whitespace-content messages. Expect the same early return.

Also test `normalizeSummaryText` and `buildTranscript` indirectly through a co-located unit test file or by temporarily exporting them (see Note below).

**Note on private helpers:** `normalizeSummaryText` and `buildTranscript` are not exported. Two options (either is fine, pick the cleaner one):
- Export them with `export` keyword and import in the test
- Write a separate co-located file `src/interactions/chats/summarizeChatForHistoryCard.helpers.test.ts` that duplicates the logic (same pattern as frontend quizRunnerHelpers)

Helpers to cover:
- `normalizeSummaryText`: "the user" → "you", leading "User " → "You ", empty returns null
- `buildTranscript`: filters system messages, slices to last 24, formats as "User: / Assistant:"

Use: `UserFactory`, `ChatFactory`

---

## Part 2 — Backend Tool Unit Tests

### 2.1 New file: `src/__tests__/tools/findProductsBySpecsTool.test.ts`

Source: `src/tools/findProductsBySpecsTool.ts`

The `normalizeFilterInput` function is a pure function not exported from the module. Test it via a co-located test or by exporting it. Tests:

1. Returns input unchanged when only `sellerSpecId` provided
2. Returns input unchanged when only `productSpecId` provided
3. When both IDs are the same number, removes `productSpecId` (keeps `sellerSpecId`)
4. When both IDs differ, removes `sellerSpecId` (keeps `productSpecId`)
5. Returns non-object input unchanged

Also test Zod schema validation:
6. Rejects a filter object that has both `sellerSpecId` and `productSpecId` (different values) without going through `normalizeFilterInput`
7. Accepts a filter with only `sellerSpecId` + `stringValue`

---

## Part 3 — Frontend Component Tests

All frontend tests live in `src/__tests__/components/` or `src/__tests__/app/`.

Setup already mocks globally: Clerk (`useAuth`, `useUser`), `next/navigation`, `next/link`, `window.matchMedia`.

For components using Apollo hooks, mock `@/lib/graphql` per test file:
```typescript
jest.mock('@/lib/graphql', () => ({
  useMyRoutineQuery: jest.fn(),
  useAddRoutineItemMutation: jest.fn().mockReturnValue([jest.fn(), {}]),
  // ... other hooks used by the component
}))
```

---

### 3.1 New file: `src/__tests__/components/quizRunner.test.tsx`

Source: `components/quizRunner.tsx`

This component requires `path` prop and uses: `useQuizByUrlQuery`, `useMyLatestQuizResponseQuery`, `useStartQuizResponseMutation`, `useSaveQuizAnswerMutation`, `useCompleteQuizResponseMutation`.

Tests:
1. **Loading state:** When query is loading, shows a loading indicator (or nothing) without crashing
2. **Not found:** When `useQuizByUrlQuery` returns no quiz, shows "not found" or empty state
3. **Intro screen:** When quiz data is present and no active response, renders the intro screen (quiz title and start button visible)
4. **First question displayed:** After clicking start (mock `useStartQuizResponseMutation` resolving), renders first question prompt
5. **Question types render without crashing:** Render with a SINGLE_CHOICE question; option buttons appear

---

### 3.2 New file: `src/__tests__/components/shopPage.test.tsx`

Source: `components/shopPage.tsx`

Uses: `useMyChatsQuery`, `useChatMessagesQuery`, `useCreateNextChatMutation`, `useRenameChatMutation`, `useSetChatPinnedMutation`, `useSendShoppingMessageMutation`, `useStartShoppingConversationMutation`, Clerk `useAuth`/`useUser`, `useRouter`.

Tests:
1. **Loading state:** When `useMyChatsQuery` returns `{ loading: true }`, renders without crashing
2. **Empty chat list:** When query returns empty chats, renders "New Chat" button and empty sidebar
3. **Chat list renders:** When query returns 2 chats, both chat titles appear in the sidebar
4. **Active chat selected:** When `activeChatId` matches a chat, the chat messages area renders
5. **Composer visible:** When a chat is active, the message composer renders

Note: `useAuth` and `useUser` are mocked in setup.ts as `isSignedIn: false`. Override per-test for signed-in scenarios using `jest.mocked`.

---

### 3.3 New file: `src/__tests__/components/skincareRoutinePage.test.tsx`

Source: `components/skincareRoutinePage.tsx`

Uses: `useMyRoutineQuery`, `useQuizByUrlQuery`, `useMyLatestQuizResponseQuery`, `useAddRoutineItemMutation`, `useRemoveRoutineItemMutation`, `useGenerateSkincareRoutineMutation`, Clerk `useAuth`/`useUser`.

Tests:
1. **Loading state:** When `useMyRoutineQuery` is loading, renders without crashing
2. **Empty routine:** When query returns no items, renders AM/PM tabs and empty state
3. **Routine items render:** When query returns items, product names appear
4. **Tab switching:** Clicking PM tab shows PM items; AM tab shows AM items
5. **Generate routine button disabled when quiz incomplete:** When quiz response is absent, button is disabled or absent

---

### 3.4 New file: `src/__tests__/app/authPages.test.tsx`

Sources: `app/sign-in/page.tsx`, `app/sign-up/page.tsx`, `app/sso-callback/page.tsx`

These pages typically render Clerk-provided components (`<SignIn>`, `<SignUp>`, `<AuthenticateWithRedirectCallback>`). Tests are smoke tests:
1. Sign-in page renders without crashing
2. Sign-up page renders without crashing
3. SSO callback page renders without crashing

Mock `@clerk/nextjs` components if they don't already exist in setup.ts.

---

## Part 4 — Execution Order

1. `factories/index.ts` — add 4 new factory exports (required by steps 2–5)
2. `findProductsBySpecs.test.ts` — catalog interaction test
3. `getShoppingProductCardsBatch.test.ts` — catalog interaction test
4. `buildUserMemorySummary.test.ts` — userMemory interaction test
5. `summarizeChatForHistoryCard.test.ts` + helpers export — chats interaction test
6. `findProductsBySpecsTool.test.ts` — tool unit test
7. Frontend: `quizRunner.test.tsx`, `shopPage.test.tsx`, `skincareRoutinePage.test.tsx`, `authPages.test.tsx`

After each file: run `npm test -- <pattern>` to confirm passing before moving on.

---

## Verification

**Backend:**
```bash
cd /Users/alexmarchenko/Projects/alexAndInseongWorkspace/commerce-platform-backend
npm test                     # all tests pass
npm run test:coverage        # statements climb from 31.8% toward ~55%+
```

**Frontend:**
```bash
cd /Users/alexmarchenko/Projects/alexAndInseongWorkspace/commerce-platform-frontend
npm test                     # all tests pass
npm run test:coverage        # statements climb from 26.6% toward ~40%+
```

---

## TODO

- [ ] Add 4 new factory exports to `src/__tests__/factories/index.ts` (backend)
- [ ] Write `findProductsBySpecs.test.ts` (6 tests)
- [ ] Write `getShoppingProductCardsBatch.test.ts` (6 tests)
- [ ] Write `buildUserMemorySummary.test.ts` (5 tests)
- [ ] Export `normalizeSummaryText` + `buildTranscript` from `summarizeChatForHistoryCard.ts`
- [ ] Write `summarizeChatForHistoryCard.test.ts` (4 tests — 2 DB paths + 2 helper unit tests)
- [ ] Export `normalizeFilterInput` from `findProductsBySpecsTool.ts`
- [ ] Write `findProductsBySpecsTool.test.ts` (7 tests)
- [ ] Write `quizRunner.test.tsx` (5 tests)
- [ ] Write `shopPage.test.tsx` (5 tests)
- [ ] Write `skincareRoutinePage.test.tsx` (5 tests)
- [ ] Write `authPages.test.tsx` (3 tests)
- [ ] Run full test suites in both repos and confirm all pass
- [ ] Create PRs for both repos against `main`
