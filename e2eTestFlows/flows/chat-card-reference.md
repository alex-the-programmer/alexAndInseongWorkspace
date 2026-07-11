# Flow: chat-card-reference

**Priority:** P1  
**Auth:** signed-in  
**Preconditions:** Backend with catalog data; prompts tuned per product box type.

## Product box types in chat

| UI box | When it renders | Ordinal order |
| ------ | --------------- | ------------- |
| **Quick compare** | `comparison.items.length >= 2` | Columns 1→N, then discount strip |
| **Top pick** | `comparison.items.length === 1` | Top pick card, then discount strip |
| **Discount strip** | Cards not in `comparison.items` | After compare/top pick in global order |
| **Plain product cards** | No comparison metadata | `productCards` array order |

Follow-up references like “the first one” / “the third one” must resolve against this **global visual order**, not compare finalists only.

## Cases

### chat-card-reference-01: Quick compare — first column (ALE-97)

- **Steps:** hand cream discovery → budget compare prompt
- **Assertions:** Quick compare visible; follow-up mentions `shown-product-1-name`
- **Spec:** `playwright/tests/chat/card-reference-follow-up.spec.ts`

### chat-card-reference-02: Top pick — first card (ALE-97)

- **Steps:** single best cleanser pick under $25
- **Assertions:** Top pick visible; “first one” refers to top pick card
- **Skip when:** compare/table shown instead

### chat-card-reference-03: Discount strip — third card after compare (ALE-97)

- **Steps:** compare three cleansers under $25
- **Assertions:** Compare + discount visible; ≥3 `shown-product-*` names; “third one” refers to first discount card
- **Skip when:** discount strip or third slot missing

### chat-card-reference-04: Plain product cards — first card (ALE-97)

- **Steps:** two hand creams in cards without compare table
- **Assertions:** No Quick compare / Top pick; “first one” refers to first card
- **Skip when:** compare or top pick appears

## Notes

- Use `shown-product-{n}-name` test ids (global visual order).
- Grep `[agent-response-review]` after runs; do not assert exact assistant prose.
