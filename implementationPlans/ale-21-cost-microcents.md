# ALE-21 — Sub-cent AI cost ledger (microcents)

## Context

Follow-up to [ALE-21 rate limiting](ale-21-rate-limit-user-ai-usage.md). Per-event `Math.ceil` on fractional cents made almost every LLM call count as 1¢, so a 5¢ daily cap was exhausted after a few chat turns despite negligible real API spend.

## Database changes (architect approval required before apply)

| Table | Column | Type | Notes |
| ----- | ------ | ---- | ----- |
| `ai_llm_usage_events` | `costMicrocents` | Int | Source of truth; 10_000 microcents = 1¢ |
| `ai_llm_daily_spends` | `totalCostMicrocents` | Int | Budget enforcement uses this |

**ALE-43:** Removed `costCents` and `totalCostCents`; display cents are derived in app code via `microcentsToDisplayCents()`.

Migration: `20260518140000_ale_21_cost_microcents` backfills microcents from stored token counts and model pricing.

## Logic

- `estimateCostMicrocents(modelId, inputTokens, outputTokens)` — `round((inputCostCents + outputCostCents) * 10000)`, no per-call `ceil`.
- `AI_DAILY_BUDGET_CENTS` unchanged; compared as `budgetCents * 10000` vs `totalCostMicrocents`.

## TODO

- [x] Schema + migration
- [x] Cost estimation and budget modules
- [x] Unit tests
- [x] Local migration applied + `npm run build` + aiUsage tests pass
- [ ] Apply migration on shared environments after architect approval
- [ ] Commit, push, PR (stack on `ALE-21-have-a-rate-limiting-of-how-many-tokens-can-one-burn`)
