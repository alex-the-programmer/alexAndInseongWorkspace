# ALE-43 Consolidate AI usage cost: microcents vs cents

## Context

[Linear ALE-43](https://linear.app/alexandinseongprojects/issue/ALE-43/investigate-why-we-have-separate-counting-of-tokens-usage-in-cents-vs): investigate why the LLM usage ledger stores **both** `costMicrocents` / `totalCostMicrocents` and `costCents` / `totalCostCents`, and whether to consolidate to a single stored field (or a decimal/float).

**Repo scope:** `commerce-platform-backend` only. No GraphQL fields expose cost today; budget enforcement is internal.

**Related work:**

- [ALE-21 rate limiting](ale-21-rate-limit-user-ai-usage.md) — original ledger with **whole cents** per event.
- [ALE-21 sub-cent follow-up](ale-21-cost-microcents.md) — added microcents; kept cents as denormalized display.

**Branch:** `ALE-43-consolidate-ai-cost-microcents-vs-cents` (from latest `main`).

---

## Executive summary

| Question | Answer |
| -------- | ------ |
| Why two fields? | v1 billed each LLM call in **whole cents** (`Math.ceil`), so tiny calls cost 1¢ and blew the daily cap. Microcents fixed precision; **cents columns were kept** as rounded display copies. |
| Is microcents the right unit? | **Yes** for integer fixed-point: 10_000 microcents = 1¢, matches `AI_DAILY_BUDGET_CENTS` env without floats. |
| Consolidate? | **Yes — drop stored `costCents` / `totalCostCents`.** Keep one integer column per table; derive display cents in code via `microcentsToDisplayCents`. |
| Switch to float/Decimal? | **No** for v1 consolidation. Floats risk rounding drift on budget compares; `Decimal` is viable later if ops want dollar literals in SQL, but adds complexity with no current consumer. |

---

## Current state

### Schema (`prisma/schema.prisma`)

| Model | Microcent column (enforcement) | Cent column (denormalized) |
| ----- | ------------------------------ | -------------------------- |
| `AiLlmUsageEvent` (`ai_llm_usage_events`) | `costMicrocents` | `costCents` = `round(costMicrocents / 10_000)` |
| `AiLlmDailySpend` (`ai_llm_daily_spends`) | `totalCostMicrocents` | `totalCostCents` = `round(totalCostMicrocents / 10_000)` |

Unit constant: `MICROCENTS_PER_CENT = 10_000` in `src/interactions/aiUsage/aiUsageMicrocents.ts`.

### Write path

```text
trackedAgentGenerate → recordLlmUsageEvent
  → estimateCostMicrocents(modelId, tokens)
  → persist costMicrocents + costCents on event
  → incrementUserDailySpendMicrocents (updates totalCostMicrocents + totalCostCents)
```

### Read path (budget)

```text
assertUserWithinDailyBudget
  → getAiDailyBudgetMicrocents()  // AI_DAILY_BUDGET_CENTS * 10_000
  → getUserDailySpendMicrocents() // O(1) from ai_llm_daily_spends row
  → compare integers (no floats)
```

### Read path (display)

- `getUserDailySpendCents()` — **computes** `microcentsToDisplayCents(spentMicrocents)`; does not read `totalCostCents` from DB.
- `costCents` on events is **written but not read** in production `src/` (only asserted in tests).

### Migrations timeline

1. `20260518120000_ale_21_ai_llm_usage_events` — `costCents` only.
2. `20260518130000_ale_21_ai_llm_daily_spends` — daily tally (initially cent-based).
3. `20260518140000_ale_21_cost_microcents` — added microcent columns, backfilled from tokens, rebuilt daily totals from `SUM(costMicrocents)`.

---

## Why the dual-field design existed (reasoning)

### Problem that motivated microcents

Original ALE-21 stored **integer cents per event** with per-call rounding up. A typical shopping turn (~1.5k tokens on gpt-4o-mini) is **~0.045¢** real cost but was recorded as **1¢**. With `AI_DAILY_BUDGET_CENTS=5`, users hit the limit after a handful of turns.

### Why microcents instead of changing the env unit

- Product/ops think in **whole cents** (`AI_DAILY_BUDGET_CENTS=5`).
- Sub-cent accuracy needs a finer grain; scaling cents by 10_000 avoids floating point.
- Budget compare stays exact: `spentMicrocents >= budgetCents * 10_000`.

### Why `costCents` was kept on disk (follow-up tradeoff)

Documented in [ale-21-cost-microcents.md](ale-21-cost-microcents.md) as **“display only”**:

- Easier ad-hoc SQL / logs without dividing by 10_000.
- Avoided a breaking migration that removed a column ops might already query.
- Daily row still stores rounded total for quick human scan.

### Downsides (why ALE-43 exists)

1. **Two sources that can drift** if a future code path updates one column and not the other (today both are set in the same transaction, but the schema suggests parity is required).
2. **Misleading semantics** — `costCents` on a *single event* is `round(microcents/10000)`, so many events show `0` while the day total is non-zero; readers may think spend is zero.
3. **Dead storage** — production code does not read stored cent columns; tests duplicate assertions on both.
4. **Cognitive load** — new contributors ask which column is “truth” (answer: microcents only).

---

## Options considered

### A. Keep dual fields (status quo)

- **Pros:** No migration; SQL `SELECT costCents` unchanged.
- **Cons:** Permanent duplication and drift risk; does not resolve ALE-43.

### B. Single integer microcents (recommended)

- **Pros:** One source of truth; same precision; env unchanged; derive display at read time (already done for daily spend).
- **Cons:** Raw SQL / BI must divide by 10_000 or use a DB view.

### C. Single integer “nano-cents” / store budget env in microcents

- Rename columns to `costAmount` with documented scale — cosmetic only; same as B.

### D. Single `Decimal` / `Float` dollar column

| Approach | Verdict |
| -------- | ------- |
| `Float` / `Double` | **Reject** — comparison errors for limits (`0.1 + 0.2`). |
| `Decimal(12,6)` USD | **Defer** — workable for dashboards; Prisma + JS need consistent rounding rules; no current UI requirement. |
| `Int` microcents | **Keep** — already implemented and tested. |

### E. Database generated column for cents

- Postgres `GENERATED ALWAYS AS (round(costMicrocents::numeric / 10000)) STORED`
- **Pros:** SQL ergonomics without app dual-write.
- **Cons:** Still two columns; Prisma may not model generated columns cleanly; architect review for managed vs native.

**Recommendation:** **B** unless ops strongly need SQL-visible cents without a view — then **E** as an alternative to app-level dual-write, not duplicate app writes.

---

## Design decision (locked for this ticket)

1. **Source of truth:** `costMicrocents` / `totalCostMicrocents` only.
2. **Remove:** `costCents`, `totalCostCents` from schema and all writes.
3. **Keep:** `microcentsToDisplayCents`, `getUserDailySpendCents` (compute-only), `AI_DAILY_BUDGET_CENTS` env.
4. **Do not** introduce float columns in this ticket.

Optional follow-up (out of scope): SQL view `ai_llm_usage_events_display` with `cost_cents_display` for analytics.

---

## Database changes (architect approval required before migrate)

| Table | Action | Column |
| ----- | ------ | ------ |
| `ai_llm_usage_events` | **Drop** | `costCents` |
| `ai_llm_daily_spends` | **Drop** | `totalCostCents` |

No renames of microcent columns in v1 (avoids wide diff). Document unit in `aiUsageMicrocents.ts` and `.env.example` comment.

**Verification query after migration:**

```sql
-- Should match: SUM(costMicrocents) / 10000 rounded per day vs old totalCostCents
SELECT "userId", "usageDate", "totalCostMicrocents",
       ROUND("totalCostMicrocents"::numeric / 10000) AS display_cents
FROM "ai_llm_daily_spends"
LIMIT 10;
```

---

## Implementation plan

### 1. Investigation doc (this plan)

- [x] Document history, read/write paths, recommendation.

### 2. Code — stop writing cent columns

| File | Change |
| ---- | ------ |
| `src/interactions/aiUsage/recordLlmUsageEvent.ts` | Remove `costCents` from `create` data |
| `src/interactions/aiUsage/incrementUserDailySpendMicrocents.ts` | Remove `totalCostCents` from create/update |
| `prisma/schema.prisma` | Remove `costCents`, `totalCostCents` fields |

### 3. Migration

- `npx prisma migrate dev --create-only --name ale_43_drop_redundant_cost_cents`
- SQL: `ALTER TABLE ... DROP COLUMN "costCents"` / `"totalCostCents"`.
- Apply locally; coordinate shared env deploy with architect.

### 4. Tests

| File | Change |
| ---- | ------ |
| `src/__tests__/interactions/aiUsage/aiUsageBudget.test.ts` | Assert `costMicrocents` / `totalCostMicrocents` only; use `microcentsToDisplayCents` for display expectations |
| `src/__tests__/interactions/aiUsage/aiUsageHelpers.test.ts` | Unchanged (already microcent-focused) |

### 5. Docs

| File | Change |
| ---- | ------ |
| `implementationPlans/ale-21-cost-microcents.md` | Add note: cents columns removed in ALE-43 |
| `commerce-platform-backend/.env.example` | Comment: budget is whole cents; ledger uses microcents (10_000 per cent) |

### 6. Verification

```bash
cd commerce-platform-backend
npm run lint && npm run build && npm test
```

Manual (optional): set `AI_DAILY_BUDGET_CENTS=5`, send several small shopping messages, confirm limit not hit prematurely and block still works after ~111k input tokens equivalent (per existing test math).

---

## Edge cases

| Case | Behavior |
| ---- | -------- |
| Existing rows before drop | Microcent columns already backfilled; dropping cents loses display snapshot — acceptable (recomputable). |
| `AI_DAILY_BUDGET_CENTS=0` | Unlimited; unchanged. |
| Per-event `costCents` was 0, microcents > 0 | After drop, analytics must use microcents — document for anyone using raw SQL. |
| Rounding at day boundary | Budget uses microcent sum; display cents for a day = `round(totalMicrocents/10000)` — same as before. |

---

## Out of scope

- Frontend usage meter / exposing spend via GraphQL.
- Renaming `costMicrocents` → neutral `costAmount`.
- Postgres generated column or `Decimal` type.
- Conquistador or other repos.
- Changing pricing tables or `MICROCENTS_PER_CENT` scale.

---

## TODO

- [x] Architect approval to drop `ai_llm_usage_events.costCents` and `ai_llm_daily_spends.totalCostCents`
- [x] Prisma schema + migration `ale_43_drop_redundant_cost_cents`
- [x] Remove cent column writes in `recordLlmUsageEvent` and `incrementUserDailySpendMicrocents`
- [x] Update `aiUsageBudget.test.ts` (and any factory defaults)
- [x] Update `.env.example` comment + cross-link in `ale-21-cost-microcents.md`
- [x] `npm run lint`, `npm run build`, `npm test` in `commerce-platform-backend`
- [ ] Apply migration on shared environments after approval
