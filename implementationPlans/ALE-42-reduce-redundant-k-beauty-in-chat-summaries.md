# ALE-42 Reduce redundant “K-beauty” in chat history summaries

## Context

[Linear ALE-42](https://linear.app/alexandinseongprojects/issue/ALE-42/nearly-all-summaries-start-with-k-beaty-its-redundant): chat **history card** copy (especially **synopsis**) often opens with “K-beauty” / “Korean skincare” even though the whole product is already a K-beauty advisor. That prefix adds noise in the **My chats** sidebar and makes cards feel samey.

**Repo scope:** `commerce-platform-backend` only. Summaries are produced server-side when the user starts a **new chat** (previous thread is summarized in the background). The frontend only displays stored `synopsis` and `nextActionDescription` (`chatPage.tsx` → `formatChatSynopsis`).

**Branch:** `alexmtruecar/ale-42-nearly-all-summaries-start-with-k-beaty-its-redundant` (or `ALE-42-reduce-redundant-k-beauty-in-chat-summaries` per team convention).

**Database changes:** None.

---

## Current state

| Layer | Location | Behavior today |
|-------|----------|----------------|
| Trigger | `interactions/chats/createNextChat.ts` | On **New chat**, calls `summarizeChatForHistoryCard` for the **previous** `currentChatId` (errors logged, non-blocking) |
| Summarization | `interactions/chats/summarizeChatForHistoryCard.ts` | Loads last 24 non-system messages → `chatSummarizationAgent` structured output → writes `title` (if not manually edited), `synopsis`, `nextActionDescription`, brand links |
| Agent prompt | `agents/chatSummarizationAgent.ts` | Asks for concise title/synopsis/next step; second person; **no** rule about avoiding category boilerplate |
| Post-process | `normalizeSummaryText()` in `summarizeChatForHistoryCard.ts` | Fixes “the user” → “you” and leading “User ”; **does not** strip K-beauty prefixes |
| Schema | `interactions/chats/chatSummarySchema.ts` | Zod caps: title 120, synopsis 280, nextAction 160 chars |
| UI | `commerce-platform-frontend/components/chatPage.tsx` | Sidebar shows `formatChatSynopsis(chat)` and optional `nextActionDescription` block |
| Shopping agent | `agents/shoppingAgent.ts` | Uses “K-beauty” in **live** chat tone (correct there); unrelated to history summaries |

There are **no** existing unit tests for `summarizeChatForHistoryCard` or `normalizeSummaryText` (planned in ALE-25 but not landed).

---

## Gap analysis

| Area | Today | Target (ALE-42) |
|------|-------|-----------------|
| Agent instructions | Neutral summary rules only | Explicit: don’t lead with “K-beauty” / “Korean skincare” — app context is already K-beauty |
| `normalizeSummaryText` | User/pronoun fixes only | Unchanged (pronoun only; no K-beauty strip) |
| Synopsis quality | Often “K-beauty …” opener | Lead with **specific** topic (product, concern, brands, decision) |
| `nextActionDescription` | Same model bias | Same rules (shown in sidebar callout) |
| `title` | Sometimes category-prefixed | Prefer concrete topic; strip leading boilerplate if present |
| Existing DB rows | Old synopses unchanged until re-summarized | Accept for v1; optional follow-up backfill |

---

## Design decisions

### Fix at generation time, not in the frontend (locked)

- Do **not** add client-side string stripping in `formatChatSynopsis` — that hides bad data and won’t fix search (`listMyChats` searches `synopsis`).
- Change **agent instructions** + **`normalizeSummaryText`** so persisted fields are clean.

### Prompt-only fix (locked)

- **Prompt** (`chatSummarizationAgent.ts`) is the sole fix for redundant K-beauty openers.
- **No** hardcoded prefix stripping in `normalizeSummaryText` — avoids brittle regex maintenance; retest in product after prompt change.
- Existing `normalizeSummaryText` still handles “the user” → “You ” pronoun normalization only.

### When summaries refresh

- Summaries run when user clicks **New chat** (`createNextChat` → summarize previous chat).
- **Existing** chats keep old synopsis until that chat is summarized again (user leaves it and starts another chat). No migration/backfill in v1 unless product asks.

### No GraphQL / schema changes

- Field shapes unchanged; no codegen beyond routine backend checks.

---

## Implementation plan

### 1. Backend — agent instructions

**File:** `src/agents/chatSummarizationAgent.ts`

Add rules under `Rules:` (keep existing rules):

- The app is already a K-beauty shopping advisor; **do not** start `synopsis`, `nextActionDescription`, or `title` with “K-beauty”, “Korean beauty”, “Korean skincare”, or similar category labels.
- Open with the **specific** decision or topic (e.g. product type, skin concern, brands compared, budget).
- Mention “K-beauty” only when it is essential mid-sentence (uncommon).

Optional one-line examples in the prompt (helps gpt-4o-mini):

- Good synopsis: “You compared hydrating toners from COSRX and Beauty of Joseon.”
- Bad synopsis: “K-beauty toner comparison for dry skin.”

### 2. Backend — tests for existing helpers

**File:** `src/interactions/chats/summarizeChatForHistoryCard.ts`

- Export `normalizeSummaryText` and `buildTranscript` for unit tests (pronoun normalization + transcript formatting only).

**Tests:** `src/__tests__/interactions/chats/summarizeChatForHistoryCard.test.ts`

- `normalizeSummaryText`: “the user” / “user” / “you” → “You …”; empty → `null`
- `buildTranscript`: filters system messages; last 24 messages

### 3. Backend — optional agent instruction smoke test

If the repo has a pattern for testing agent instruction strings (unlikely), skip. Rely on helper tests + manual QA.

### 4. Verification

**Automated**

```bash
cd commerce-platform-backend
npm run lint && npm run build && npm test
```

**Manual**

1. Sign in; open a chat; discuss a **specific** product or concern (avoid saying “K-beauty” in your messages).
2. Click **New chat** to trigger summarization of the previous thread.
3. In **My chats**, open the previous card: synopsis should **not** start with “K-beauty” / “Korean skincare”; it should name the actual topic.
4. Repeat with a transcript where you **do** say “K-beauty” mid-message — synopsis may include K-beauty **later**, not as the first words.
5. Check **next action** callout on the card — same rule.

---

## File checklist

| File | Action |
|------|--------|
| `src/agents/chatSummarizationAgent.ts` | Add no-leading-K-beauty rules + examples |
| `src/interactions/chats/summarizeChatForHistoryCard.ts` | Export `normalizeSummaryText` / `buildTranscript` for tests (no prefix strip) |
| `src/__tests__/interactions/chats/summarizeChatForHistoryCard.test.ts` | Helper unit tests |

**Not changed**

| File | Reason |
|------|--------|
| `commerce-platform-frontend/*` | Display-only; data fixed at source |
| `prisma/schema.prisma` | No schema change |
| `createNextChat.ts` | Trigger path already correct |

---

## Edge cases

| Case | Expected behavior |
|------|-------------------|
| User never starts a new chat | Old synopsis never refreshes (unchanged) |
| Summarization fails (budget/LLM) | `createNextChat` still succeeds; warn log; previous chat keeps old/null synopsis |
| Manually edited title | `isTitleManuallyEdited` — title not overwritten; synopsis/next action still updated |
| Search “k-beauty” | May still match mid-string synopsis; leading strip does not break search |
| Title entirely “K-beauty routine help” | After strip, may be short; model should do better on regen |

---

## Follow-ups (out of scope for ALE-42)

- **Backfill:** admin script or one-off job to re-run `summarizeChatForHistoryCard` for recent chats.
- **Dedicated mutation:** `refreshChatSummary(chatId)` for support/debug.
- **ALE-25:** broader `summarizeChatForHistoryCard` interaction tests with mocked `trackedAgentGenerate`.

---

## TODO

- [x] Backend: update `chatSummarizationAgent` instructions (no leading K-beauty boilerplate)
- [x] Backend: prompt-only (no `stripRedundantCategoryPrefix` hardcode)
- [x] Backend: export helpers and add `summarizeChatForHistoryCard.test.ts` with table-driven prefix cases
- [ ] Manual QA: New chat → previous card synopsis/next action without leading K-beauty
- [x] `npm run lint`, `npm run build`, `npm test` in `commerce-platform-backend`
