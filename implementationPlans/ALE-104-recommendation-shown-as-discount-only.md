# ALE-104 — Recommendations shown as discount-only strip

## Context

[Linear ALE-104](https://linear.app/dewly/issue/ALE-104/i-did-not-get-any-recommendation-and-instead-just-discount-options)

**Bug (Jul 2026, reported by Inseong):** User asked for product recommendations in chat but the UI showed only the **“Want to try something close with a discount?”** strip — no **Quick compare**, **Top pick**, or neutral product-card group. Primary picks were mislabeled as discount alternatives.

**Branch:** `ALE-104-recommendation-not-discount-only`

**Repos:** `commerce-platform-frontend` (primary fix)

**Database changes:** None.

## Prior tickets (partial fixes — gap remained)

| Ticket | What shipped | What ALE-104 still fixes |
| ------ | ------------ | ------------------------ |
| [ALE-65](ALE-65-create-a-new-landing-page.md) ([Linear](https://linear.app/dewly/issue/ALE-65)) | Single-item compare → **Top pick**; discount strip excludes comparison finalists (`8d7bbf1`) | Only applies when `comparison` metadata exists — not when enrichment is `productCards` only |
| [ALE-18](ALE-18-fix-recommendation-of-similar-products.md) ([Linear](https://linear.app/dewly/issue/ALE-18)) | Documented duplicate-SKU bug; mitigated by hiding discount strip when all cards are finalists | Explicitly noted `productCards` only (no comparison) → **all cards under discount header** — left open |
| [ALE-14](ALE-14-remove-redundant-info-from-the-agent-responses.md) | Claimed discount cards “exclude compared ids” | Frontend never rendered a plain **cards** box; misclassification when `comparison` is null |
| [ALE-97](ALE-97-resolve-card-references-in-follow-ups.md) | `listShownProductSlots` + `shown-product-{n}-name` test ids | Rendering logic in `chatMessageList.tsx` did not use `listShownProductSlots` until ALE-104 |

**Conclusion:** ALE-65 and ALE-18 improved compare/top-pick/discount behavior **when comparison metadata is present**. ALE-104 closes the remaining path where `comparison` is absent and every card was mislabeled as a discount alternative.

---

## Root cause

When `comparison` is **null/empty**, `chatMessageList.tsx` treated every `productCard` as a discount alternative (`!comparedProductIds.has(id)` is true for all). `lib/shownProductOrder.ts` already modeled a plain **`cards`** box — the UI never rendered it.

---

## Fix (shipped)

**File:** `commerce-platform-frontend/components/chatMessageList.tsx`

- Derive top pick / discount / plain card groups from `listShownProductSlots(cards, comparison)`.
- Render plain recommendations under **“Options for you”** (`data-testid="shown-product-cards-group"`).
- Show discount strip only for slots with `box === "discount"`.

**File:** `playwright/helpers/comparisonCards.ts`

- Detect plain cards via `shown-product-cards-group` test id (not by inferring from discount header).

---

## Tests

| Test | File |
| ---- | ---- |
| `chatMessageList` plain cards, no discount header | `src/__tests__/components/chatMessageList.test.tsx` |
| `chat-recommendation-boxes-01` E2E | `playwright/tests/chat/recommendation-boxes.spec.ts` |
| Flow doc | `e2eTestFlows/flows/chat-recommendation-boxes.md` |

---

## TODO

- [x] Add failing `chatMessageList` unit test (plain cards, no discount header)
- [x] Add `chat-recommendation-boxes-01` flow doc + Playwright spec
- [x] Refactor `chatMessageList.tsx` to use `listShownProductSlots`
- [x] Add plain product-card group UI + `shown-product-cards-group` test id
- [x] Update `comparisonCards.ts` helper for plain-cards detection
- [x] Run `npm test` in frontend
- [ ] Run affected Playwright spec when backend/agent available
- [ ] Manual QA (repro + ALE-97 + ALE-18 regression)
