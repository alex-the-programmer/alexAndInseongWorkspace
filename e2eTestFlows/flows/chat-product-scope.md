# Flow: chat-product-scope

**Ticket:** [ALE-91](https://linear.app/dewly/issue/ALE-91/search-issue)

**Preconditions:** `resetE2eUserData()` + `resetE2eAiUsageBudget()`; signed-in E2E user.

---

### chat-product-scope-01: Broad sensitive-skin request must not pivot to face masks

**Steps:**

1. Start a fresh chat (`startFreshChat`)
2. Send the sensitive-skin landing starter verbatim:
   > My skin is dry and reacts to almost everything. Can you recommend gentle, fragrance-free Korean products?
3. Wait for assistant turn(s) to settle

**Assertions:**

- No assistant reply after the user message contains `face mask` / `face masks` (user did not ask for masks)
- `[agent-response-review]` verdict is not `fail` for `expectNoUnpromptedMaskFraming`
- If product cards render, none have `mask` in the product name (heuristic)

**Notes:**

- Reproduces ALE-91 screenshot: agent incorrectly framed a broad gentle-products ask as a face-mask search.
- Quiz/routine CTA buttons on the first assistant turn are **out of scope** (ALE-6 / product clarification).
- Post-run: `grep '[agent-response-review]'` and confirm `heuristics.hasUnpromptedMaskFraming` is false.
