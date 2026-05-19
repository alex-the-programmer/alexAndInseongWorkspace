# ALE-21 — Per-user daily AI usage rate limiting

## Context

**Linear:** [ALE-21](https://linear.app/alexandinseongprojects/issue/ALE-21/have-a-rate-limiting-of-how-many-tokens-can-one-burn) — rate limit how many tokens/cents a user can burn per day.

**Repo:** `commerce-platform-backend` only (GraphQL + Mastra agents).

**Implementation branch:** `ALE-21-have-a-rate-limiting-of-how-many-tokens-can-one-burn`

Track tokens and estimated cost per user per UTC day; enforce a configurable daily budget (`AI_DAILY_BUDGET_CENTS` env). Record **one row per `agent.generate()`** (individual LLM call). Block **before** a new user-facing action when over budget; **allow the full turn** once started (no mid-turn abort between shopping main + extraction + memory extract).

---

## Current state

- Four Mastra agents in `commerce-platform-backend/src/mastra/index.ts`; `result.usage` is **logged only** (e.g. `invokeShoppingAgent.ts` line 340).
- No usage tables in `commerce-platform-backend/prisma/schema.prisma`.
- No `Engagement` model — user AI activity is centered on **`Chat`** + `mastraThreadId`.
- Postgres `mastra.mastra_ai_spans` exists (`prisma/mastra/mastraInit.sql`) but **`@mastra/observability` is not installed** and observability is not configured on `Mastra`.

### LLM call sites to instrument (7 paths)

| User action | LLM calls per action | Entry interaction |
| ----------- | -------------------- | ----------------- |
| `sendShoppingMessage` / `startShoppingConversation` | 1–3 (`shoppingAgent` main + optional structured extraction + `extractFactsFromChatTurn`) | `sendShoppingMessage.ts`, `startShoppingConversation.ts` |
| `generateSkincareRoutine` | 1 (+ possible tool loops) | `generateSkincareRoutine.ts` |
| `createNextChat` (background) | 1 (`chatSummarizationAgent`) | `summarizeChatForHistoryCard.ts` |
| Quiz / routine memory | 1 each via `extractFactsWithLlm.ts` | `completeQuizResponse.ts`, `syncUserMemoryFromRoutine.ts` |

---

## Mastra built-ins: what to use vs skip

| Mastra feature | Purpose | Fit for ALE-21 |
| -------------- | ------- | -------------- |
| **`result.usage`** on `generate()` | Per-call token counts | **Use** — source data for our ledger |
| **`CostGuardProcessor`** | Dollar limits via observability metrics | **Do not rely on alone** — requires OLAP store (DuckDB/ClickHouse, not Postgres), metrics are async/buffered (“best-effort”, can overshoot) |
| **`TokenLimiterProcessor`** | Context-window trimming | **Not applicable** — not billing/rate limits |
| **`@mastra/observability` + automatic metrics** | Traces, token/cost metrics, Studio | **Phase 2 optional** — good for debugging; not transactional enforcement |

**Recommendation:** Implement a **Prisma usage ledger** as the source of truth for daily limits and per-call stats. Optionally add Mastra observability later for operator dashboards—not for blocking users.

---

## Design

### Definitions

- **Daily limit:** per **User** (`users.id`), calendar day in **UTC**.
- **Engagement (stats):** each **`agent.generate()`** = one usage row (individual LLM call).
- **Enforcement:** check budget **only before a new user-facing action**; if over limit, reject before any LLM calls. **Allow the full turn** once started.

### Env configuration

Add to `commerce-platform-backend/.env.example`:

```bash
# Max estimated AI spend per user per UTC day, in cents. 0 = unlimited (local dev).
AI_DAILY_BUDGET_CENTS=50
```

### Database (requires architect approval before migrate)

New Prisma model **`AiLlmUsageEvent`** (`ai_llm_usage_events`):

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | BigInt PK | |
| `userId` | BigInt FK → `users` | indexed |
| `chatId` | BigInt? FK → `chats` | nullable (routine/quiz paths) |
| `correlationId` | UUID | groups calls from one user action (e.g. one `sendShoppingMessage`) |
| `userAction` | enum | `SHOPPING_MESSAGE`, `SHOPPING_OPENING`, `ROUTINE_GENERATION`, `CHAT_SUMMARY`, `MEMORY_EXTRACTION`, … |
| `agentId` | String | e.g. `shoppingAgent` |
| `modelId` | String | e.g. `openai/gpt-4o-mini` |
| `inputTokens` | Int | default 0 |
| `outputTokens` | Int | default 0 |
| `totalTokens` | Int | input + output |
| `costCents` | Int | estimated, integer cents |
| `createdAt` | DateTime | indexed with `userId` for daily rollup |

Indexes:

- `(userId, createdAt)` — daily sum query
- `(chatId, createdAt)` — optional chat-level analytics
- `(correlationId)` — inspect all LLM calls for one user action

### Cost estimation module

New module `commerce-platform-backend/src/interactions/aiUsage/`:

- **`parseGenerateUsage(result.usage)`** — normalize to `{ inputTokens, outputTokens }`.
- **`estimateCostCents(modelId, inputTokens, outputTokens)`** — static pricing for `gpt-4o-mini`, `gpt-4.1-mini`.
- **`getUserDailySpendCents(userId)`** — `SUM(costCents)` where `createdAt >= startOfUtcDay`.
- **`assertUserWithinDailyBudget(userId)`** — throws `Daily AI usage limit reached` when at/over limit.
- **`recordLlmUsageEvent(...)`** — insert row after each generate.

### Central wrapper

**`trackedAgentGenerate(agent, options)`**:

1. Call `agent.generate(...)`.
2. On success: `recordLlmUsageEvent` from `result.usage`.
3. Re-throw on failure (prefer no row on hard failure).

**Pre-check placement** (before first generate of a user action only):

| Interaction | Pre-check | `correlationId` |
| ----------- | --------- | --------------- |
| `sendShoppingMessage` | yes | new UUID at start |
| `startShoppingConversation` | yes | new UUID |
| `generateSkincareRoutine` | yes | new UUID |
| `summarizeChatForHistoryCard` | yes | new UUID |
| `extractFactsWithLlm` | yes when user-triggered | caller-supplied |

`invokeShoppingAgent` receives `correlationId` from parent; **no** second pre-check inside.

### GraphQL / UX

- Budget errors throw `Error` like other interactions; user-friendly message, no internal cents in production.
- No frontend changes required for v1.

---

## Phase 2 (optional, separate PR)

1. Add `@mastra/observability`, `@mastra/duckdb` (dev) or ClickHouse (prod).
2. Composite storage: Postgres for memory/threads; DuckDB for metrics domain.
3. Set `userId` / `threadId` on tracing context from `RequestContext`.
4. Use Studio for ops; keep Prisma ledger for limits.

Do **not** replace Prisma enforcement with `CostGuardProcessor` alone.

---

## Testing

**Interaction tests** (`src/__tests__/interactions/aiUsage/`):

- `estimateCostCents` for known models/token counts.
- `getUserDailySpendCents` sums only same UTC day.
- `assertUserWithinDailyBudget` throws when at limit; no-op when `AI_DAILY_BUDGET_CENTS=0`.
- `recordLlmUsageEvent` persists expected columns.

**Interaction test** for `sendShoppingMessage`:

- User at budget − 1 cent: pre-check blocks before agent runs.
- Under budget: `correlationId` passed; multiple records when mocking multiple generates.

---

## Implementation order

1. Add env + pricing/usage helpers (no DB yet) with unit tests for pure functions.
2. Architect review → Prisma models + migration `ale-21-ai-usage-events`.
3. `recordLlmUsageEvent` + `assertUserWithinDailyBudget` + `trackedAgentGenerate`.
4. Wire pre-checks + wrapper at all LLM entry points.
5. Update `.env.example`.
6. Manual test: `AI_DAILY_BUDGET_CENTS=1`, verify block on **next** message after a completed turn.

---

## Out of scope (v1)

- Frontend usage meter UI
- Per-model or per-feature budgets
- Refunds / rollover
- Conquistador / other product repos
- Mastra DuckDB observability (Phase 2)

---

## TODO

- [ ] Get architect approval for `ai_llm_usage_events` table + indexes
- [ ] Add `AI_DAILY_BUDGET_CENTS`, `parseGenerateUsage`, `estimateCostCents`, daily sum, `assertUserWithinDailyBudget`
- [ ] Add `AiLlmUsageEvent` model and run `prisma migrate dev`
- [ ] Implement `recordLlmUsageEvent` + `trackedAgentGenerate` wrapper
- [ ] Pre-check + tracked generate on shopping, routine, chat summary, memory extraction paths
- [ ] Interaction tests for budget logic and `sendShoppingMessage` pre-check behavior
- [ ] Update `.env.example` and confirm manual limit test
