# ALE-86 — Backfill E2E regression tests for LLM/agent bug fixes

## Context

[Linear ALE-86](https://linear.app/dewly/issue/ALE-86/backfill-e2e-regression-tests-for-llmagent-bug-fixes)

After [ALE-85](ALE-85-shopping-agent-false-off-topic-redirect.md) we have a proven pattern for agent regression E2E:

- **Flow case** in `e2eTestFlows/flows/` with repro steps + expected heuristics
- **Playwright spec** with `test.slow()`, fresh chat per run, structural asserts
- **`captureAgentResponseReview()`** logs `[agent-response-review]` JSON for post-run analysis
- **Cursor rule** (`.cursor/rules/e2e-automation.mdc`) + skills (`playwright-e2e`, `run-e2e-automation`)

**Goal:** Cover previously shipped LLM/agent bugs so regressions are caught locally before merge.

**Repos:** `commerce-platform-frontend` (specs), workspace `e2eTestFlows/` (flow docs). Backend changes only if we add test-only hooks (unlikely).

**Database changes:** None.

**Prerequisites:** ALE-85 merged ✅; Playwright scaffold (ALE-82) ✅.

---

## Testing approach (locked)

### Pattern per bug fix

1. Read the original `implementationPlans/ALE-*.md` — extract **repro conversation**, **failure symptom**, **expected UI**.
2. Add a **flow case id** (`chat-*-NN`) documenting prompts, asserts, and review heuristics.
3. Implement spec using shared helpers:
   - `waitForChatComposer`, **New chat** with URL change (isolate thread)
   - `captureAgentResponseReview` for agent turns
   - New helpers as needed (see §Shared helpers)
4. **Assert structure + heuristics**, never exact LLM copy.
5. Log `[agent-response-review]` every agent turn; document expected `verdict` in flow notes.
6. Run locally (`run-e2e-automation` skill); grep logs after run.

### What E2E can vs cannot catch

| Can catch reliably | Hard / flaky — mitigate |
| ------------------ | ------------------------ |
| Forbidden phrases (off-topic redirect, deferral stub) | Exact product SKUs in cards |
| UI structure: cards, Quick compare, Share nudge, CTAs | Full compare table content |
| Absence of product cards when policy says none (ALE-10) | Whether a specific product is the “right” pick |
| Prose length / markdown heading patterns (ALE-14) | Ingredient accuracy |
| Multi-turn flows with stable prompts (ALE-40) | Catalog data gaps (missing PDP URL) |

Use `test.fixme()` + documented smoke prompt when catalog/agent variance blocks a case; prefer **deterministic multi-turn scripts** over open-ended discovery.

### Priority tiers

| Tier | When | Tickets |
| ---- | ---- | ------- |
| **P1** | High-user-impact chat bugs, clear repro | ALE-10, ALE-40, ALE-41, ALE-45, ALE-6 |
| **P2** | Important but harder to stabilize | ALE-14, ALE-18, ALE-42 |
| **Deferred** | Poor E2E fit or non-chat LLM | ALE-37 (dup ALE-45), summarization-only edge cases |

---

## Ticket → E2E case mapping

### Already covered

| Ticket | Bug summary | E2E case | Spec file | Status |
| ------ | ----------- | -------- | --------- | ------ |
| [ALE-85](ALE-85-shopping-agent-false-off-topic-redirect.md) | Off-topic redirect on skincare advice | `chat-agent-response-03` | `playwright/tests/chat/skincare-advice-on-topic.spec.ts` | ✅ Shipped |

---

### P1 — implement in ALE-86 phase 1

#### ALE-10 — Advice for other person

| | |
| --- | --- |
| **Plan** | [ALE-10-detection-of-advice-for-other-ppl.md](ALE-10-detection-of-advice-for-other-ppl.md) |
| **Repro** | `My friend has oily skin, what should she use?` |
| **Failure** | Product recommendations for third party; no share pivot |
| **New case** | `chat-advice-for-other-01` |
| **Flow file** | `e2eTestFlows/flows/chat-advice-for-other.md` (new) |
| **Spec file** | `playwright/tests/chat/advice-for-other.spec.ts` (new) |

**Assertions:**

- `ShareNudgeCard` visible (share copy / invite friend to use app)
- **No** product cards on that turn (`productCardCount === 0`)
- `[agent-response-review]`: `hasOffTopicRedirect: false`; assistant mentions sharing app / they should sign up themselves (heuristic: `/share|friend|themselves|use the app/i`)
- Does **not** recommend specific products for the friend (no `$` price cards)

**Setup:** Signed-in E2E user; fresh chat.

---

#### ALE-40 — Incomplete responses (deferral without delivery)

| | |
| --- | --- |
| **Plan** | [ALE-40-incomplete-responses.md](ALE-40-incomplete-responses.md) |
| **Repro** | Turn 1: `which moisturizers would you recommend` → Turn 2: `dry skin, around $30` |
| **Failure** | “Just a moment!” with **no** product cards |
| **New case** | `chat-product-delivery-01` |
| **Flow file** | Extend `e2eTestFlows/flows/chat-product-cards.md` or new `chat-product-delivery.md` |
| **Spec file** | `playwright/tests/chat/product-delivery.spec.ts` (new) |

**Assertions:**

- After turn 2, `[agent-response-review]` on final turn:
  - `heuristics.hasDeferralStub: false` (new heuristic — matches `isShoppingDeferralAssistantText` patterns: “just a moment”, “let me find”)
  - `productCardCount >= 1` **OR** `heuristics.isSubstantive && !hasDeferralStub` (allow discovery follow-up only if no deferral)
- Structural: at least one card link with price pattern **or** Quick compare region

**Notes:** `test.slow()`; 120s+ timeout; two-turn script. Extend `agentResponseReview.ts` with `hasDeferralStub`.

---

#### ALE-41 — Comparison returns plain text instead of cards

| | |
| --- | --- |
| **Plan** | [ALE-41-comparison-returns-plain-text-instead-of-cards.md](ALE-41-comparison-returns-plain-text-instead-of-cards.md) |
| **Repro** | Single-turn: `Recommend a gentle cleanser for sensitive skin under $25` (or ALE-40 turn-2 prompt if more reliable) |
| **Failure** | Long compare prose; no cards / no Quick compare |
| **New case** | `chat-product-cards-01` (implement existing stub in flow doc) |
| **Flow file** | `e2eTestFlows/flows/chat-product-cards.md` |
| **Spec file** | `playwright/tests/chat/product-cards.spec.ts` (new) |

**Assertions:**

- `productCardCount >= 1`
- If assistant text length > 400 chars, cards **must** exist (no “prose-only compare”)
- Optional: Quick compare visible when `comparison` has 2+ items (structural — table or “Top pick” group)
- Log full review for manual quality check

**Notes:** May need prompt tuning after 2–3 local runs; document winning prompt in flow file.

---

#### ALE-45 (+ ALE-37 duplicate) — Agent ignores skin quiz / memory

| | |
| --- | --- |
| **Plan** | [ALE-45-agent-ignores-skin-quiz-and-user-memory.md](ALE-45-agent-ignores-skin-quiz-and-user-memory.md) |
| **Repro** | User with **completed quiz** (budget set) asks `recommend a moisturizer for me` |
| **Failure** | Re-asks budget / skin type already in quiz |
| **New case** | `chat-known-profile-01` |
| **Flow file** | `e2eTestFlows/flows/chat-known-profile.md` (new) |
| **Spec file** | `playwright/tests/chat/known-profile.spec.ts` (new) |

**Assertions:**

- **Precondition:** `resetE2eUserData()` then complete skin quiz via existing `skinQuiz` helper (reuse `playwright/helpers/skinQuiz.ts`) with budget answer
- Fresh chat → send recommend prompt
- `[agent-response-review]`: `heuristics.reAsksKnownBudget: false` (new — detect budget discovery questions when quiz has budget)
- Prefer product cards or on-topic guidance without “what’s your budget?”

**Notes:** Most setup-heavy case; consider `test.describe.configure({ timeout: 180_000 })`.

---

#### ALE-6 — Opening nudge when quiz/routine missing

| | |
| --- | --- |
| **Plan** | [ale-6-nudge-users-to-complete-skin-quiz-and-routine.md](ale-6-nudge-users-to-complete-skin-quiz-and-routine.md) |
| **Repro** | New user (no quiz, no routine) starts chat |
| **Failure** | Generic product discovery with no quiz/routine CTA |
| **New case** | `chat-opening-nudge-01` |
| **Flow file** | Extend `e2eTestFlows/flows/chat-agent-response.md` or new `chat-opening-nudge.md` |
| **Spec file** | `playwright/tests/chat/opening-nudge.spec.ts` (new) |

**Assertions:**

- `resetE2eUserData()` before test
- New chat → wait for **opening** assistant message (greeting)
- CTA button **Take the Skin Quiz** and/or routine link visible (`getByRole('button', { name: /Skin Quiz/i })`)
- `[agent-response-review]`: mentions quiz or routine path; `productCardCount === 0` on opening

**Notes:** Overlaps `chat-product-cards-02`; can share setup helper.

---

### P2 — implement in ALE-86 phase 2

#### ALE-14 — Redundant prose when cards exist

| | |
| --- | --- |
| **Plan** | [ALE-14-remove-redundant-info-from-the-agent-responses.md](ALE-14-remove-redundant-info-from-the-agent-responses.md) |
| **Repro** | Same as ALE-41 delivery turn (cards present) |
| **Failure** | `###` headings / numbered SKU list in prose **and** cards below |
| **New case** | `chat-prose-dedup-01` |
| **Spec file** | `playwright/tests/chat/prose-dedup.spec.ts` or extend `product-cards.spec.ts` |

**Assertions:**

- When `productCardCount >= 1`: `heuristics.hasMarkdownSkuList: false` (new — `/^#{1,3}\s/m`, numbered product blocks)
- Assistant text length < 600 chars when cards + compare present (soft warn in review, hard fail if > 1200)

---

#### ALE-18 — Discount cards duplicate compare finalists

| | |
| --- | --- |
| **Plan** | [ALE-18-fix-recommendation-of-similar-products.md](ALE-18-fix-recommendation-of-similar-products.md) |
| **Repro** | Compare turn with 2–3 finalists + discount strip |
| **Failure** | Same product appears in Quick compare and “Want to try something close with a discount?” |
| **New case** | `chat-discount-cards-01` |
| **Spec file** | `playwright/tests/chat/discount-cards.spec.ts` |

**Assertions:**

- If Quick compare visible: discount section either **hidden** OR cards in discount section have **distinct** product names from compare rows (DOM scrape — structural)
- **Notes:** Low priority; may `test.skip` until stable compare prompt from ALE-41 case

---

#### ALE-42 — Redundant “K-beauty” in chat history summaries

| | |
| --- | --- |
| **Plan** | [ALE-42-reduce-redundant-k-beauty-in-chat-summaries.md](ALE-42-reduce-redundant-k-beauty-in-chat-summaries.md) |
| **Repro** | Have a short chat → **New chat** → previous chat synopsis in sidebar |
| **Failure** | Synopsis starts with “K-beauty” / “Korean skincare” |
| **New case** | `chat-summary-01` |
| **Flow file** | Extend `e2eTestFlows/flows/chat-thread-management.md` |
| **Spec file** | `playwright/tests/chat/chat-summary.spec.ts` |

**Assertions:**

- Not live agent bubble — sidebar synopsis text after `createNextChat`
- `heuristics.synopsisStartsWithKbeautyBoilerplate: false` (regex on sidebar card text)
- **Notes:** Summary generates async — `expect.poll` on sidebar; 60s timeout

---

### Excluded from E2E backfill (document only)

| Ticket | Reason |
| ------ | ------ |
| ALE-78, ALE-79, ALE-80 | Catalog dedup / ingest — no chat UI |
| ALE-81 | Dev audit page — separate P2 flow (`dev-retailer-audit.md`) |
| ALE-75 | LLM pretrained knowledge research — not a user bug |
| ALE-42 agent live chat | Summarization agent only — covered by `chat-summary-01` if at all |
| ale-21 rate limit | Backend budget — no UI symptom in chat |

---

## Shared helpers to add (ALE-86)

Extend `playwright/helpers/agentResponseReview.ts`:

| Helper / heuristic | Used by |
| ------------------ | ------- |
| `hasDeferralStub` | ALE-40 |
| `hasMarkdownSkuList` | ALE-14 |
| `reAsksKnownBudget` | ALE-45 |
| `synopsisStartsWithKbeautyBoilerplate` | ALE-42 |
| `startFreshChat(page)` | All chat specs — extract from ALE-85 spec |

New `playwright/helpers/chatTurn.ts`:

```typescript
export async function startFreshChat(page: Page): Promise<void>
export async function sendChatMessage(page: Page, message: string): Promise<void>
```

Reuse `playwright/helpers/resetE2eUserData.ts`, `skinQuiz.ts`, `routineSetup.ts` for profile-dependent cases.

---

## File plan (summary)

| File | Action |
| ---- | ------ |
| `e2eTestFlows/flows/chat-advice-for-other.md` | New |
| `e2eTestFlows/flows/chat-known-profile.md` | New |
| `e2eTestFlows/flows/chat-product-delivery.md` | New (or extend product-cards) |
| `e2eTestFlows/flows/chat-product-cards.md` | Update — implement 01 |
| `e2eTestFlows/flows/chat-agent-response.md` | Update — opening nudge case |
| `e2eTestFlows/flows/chat-thread-management.md` | Update — summary case |
| `e2eTestFlows/index.md` | Add new flows |
| `playwright/helpers/agentResponseReview.ts` | Extend heuristics |
| `playwright/helpers/chatTurn.ts` | New |
| `playwright/tests/chat/*.spec.ts` | 6–8 new spec files |
| `.cursor/skills/playwright-e2e/examples-bug-fix-tdd.md` | Link ALE-86 cases |

---

## Implementation phases

### Phase 1 — P1 chat regressions (target: 5 specs)

1. Extract `startFreshChat` helper from ALE-85 spec
2. ALE-10 `chat-advice-for-other-01`
3. ALE-40 `chat-product-delivery-01` (+ `hasDeferralStub`)
4. ALE-41 `chat-product-cards-01`
5. ALE-6 `chat-opening-nudge-01`
6. ALE-45 `chat-known-profile-01` (depends on quiz helper)

### Phase 2 — P2 polish

7. ALE-14 `chat-prose-dedup-01`
8. ALE-42 `chat-summary-01`
9. ALE-18 `chat-discount-cards-01` (optional / skip if flaky)

### Phase 3 — Hardening

- Run full `playwright/tests/chat/` folder locally
- Document stable prompts in each flow file after tuning
- Update `run-e2e-automation` skill with “regression suite” one-liner

---

## Test plan (acceptance)

- [x] Each P1 ticket has a flow case + spec + `[agent-response-review]` logging
- [x] `npx playwright test playwright/tests/chat/ --project=chromium` green locally
- [x] Grep log shows `verdict: pass` for each case on current `main`
- [x] `e2eTestFlows/index.md` updated
- [x] No exact LLM string assertions in specs

---

## TODO

- [x] Extract `startFreshChat` / `sendChatMessage` helpers
- [x] Extend `agentResponseReview` heuristics (`hasDeferralStub`, etc.)
- [x] Phase 1: ALE-10, ALE-40, ALE-41, ALE-6, ALE-45 specs
- [x] Phase 2: ALE-14, ALE-42, ALE-18 specs
- [x] Update `e2eTestFlows/index.md` and flow markdown files
- [x] Run full chat E2E suite; document stable prompts
- [ ] Link ALE-86 in PR when shipping
