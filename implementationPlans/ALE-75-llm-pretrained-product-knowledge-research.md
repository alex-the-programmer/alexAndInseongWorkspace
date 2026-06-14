# ALE-75 Research: gpt-4.1-mini pretrained product knowledge vs scraped catalog data

## Context

**Linear:** [ALE-75](https://linear.app/dewly/issue/ALE-75/research-gpt-41-mini-pretrained-product-knowledge-vs-scraped-catalog)

**Question:** Does `gpt-4.1-mini` (the model we use for several LLM paths) already know product ingredients and other properties from pretraining, or do we need to send scraped catalog data to the LLM?

**Answer (empirical):** **We need scraped catalog data.** Pretrained knowledge alone is unreliable for SKU-level ingredients and PDP-specific claims. The model is somewhat useful for high-level product category/format guesses but frequently invents plausible generic K-beauty actives.

**Status:** Research complete (2026-06-13). No product code changes required; benchmark scripts and fixtures retained for re-runs.

**Repos:**

| Repo | Scope |
|------|--------|
| `commerce-platform-backend` | Benchmark scripts, fixtures, ingredient resolution reused for ground truth |

**Related prior art:**

- [ALE-15 ingredients display in product cards](./ale-15-ingredients-display-in-product-cards.md) — established principle that ingredient display must come from `product_seller_specs`, not LLM training knowledge.

---

## Research goals

1. Select a random sample of real catalog products that **have scraped ingredient data** in Postgres.
2. Call the LLM in a **blind one-shot** (product name only — no DB, no tools, no ingredient context).
3. Compare LLM-reported ingredients and product descriptions against scraped ground truth.
4. Decide whether sending product data to the LLM is necessary for ingredient-led shopping flows.

---

## Methodology

### Sample selection

- **Size:** 50 products
- **Seed:** 42 (reproducible shuffle)
- **Source:** `products` joined to `product_seller_specs` / `seller_specs` where ingredient-like `stringValue` exists
- **Filter:** Resolved `topIngredients` must have **≥2** non-solvent actives via existing `resolveTopIngredientsFromSpecs` pipeline
- **Ground truth fields:** `displayName`, `brand`, `category`, `topIngredients`, `allInciTokens` (first 15 INCI tokens), `productDescription` (from `SK description` or OY PDP description specs)

Script: `commerce-platform-backend/scripts/llmIngredientKnowledgeSample.ts`

### Blind LLM evaluation

- **Model:** `gpt-4.1-mini`
- **Input:** `prompt-input.json` containing only `{ sampleId, displayName }` per product
- **No access:** Prisma, catalog tools, ingredient resolvers, or scraped PDP text
- **Prompt:** Ask for ingredients, product description, what it does, confidence, and notes — from training knowledge only
- **Batches:** 10 products per API call (5 calls total)

Script: `commerce-platform-backend/scripts/llmIngredientKnowledgeTest.ts`

### Comparison scoring

| Dimension | Verdict | Rule |
|-----------|---------|------|
| **Ingredients** | correct | ≥67% of ground-truth top-3 ingredients fuzzy-match an LLM-listed ingredient |
| | partial | 34–66% match |
| | wrong | <34% match or empty LLM list |
| **Description** | plausible | ≥25% significant-word overlap between scraped PDP description and LLM description + whatItDoes |
| | partial | 10–24% overlap |
| | wrong | <10% overlap |
| | unknown | No scraped description available |

Fuzzy ingredient match: normalized substring or ≥50% token overlap on significant tokens (see `scripts/lib/llmIngredientKnowledge/compareLogic.ts`).

Script: `commerce-platform-backend/scripts/llmIngredientKnowledgeCompare.ts`

### Artifacts (on disk)

| File | Purpose |
|------|---------|
| `scripts/fixtures/llm-ingredient-knowledge/ground-truth.json` | Scraped reference data |
| `scripts/fixtures/llm-ingredient-knowledge/prompt-input.json` | Name-only LLM input |
| `scripts/fixtures/llm-ingredient-knowledge/llm-responses.json` | Raw model output |
| `scripts/fixtures/llm-ingredient-knowledge/comparison.json` | Machine-readable scores |
| `scripts/fixtures/llm-ingredient-knowledge/comparison.md` | Human-readable per-product table |

---

## Results summary (n=50, seed=42)

### Aggregate scores

| Metric | Correct / Plausible | Partial | Wrong / Unknown |
|--------|---------------------|---------|-----------------|
| **Main ingredients** (top-3 scraped vs LLM) | **1 (2%)** | 5 (10%) | 44 (88%) |
| **Product description** (vs scraped PDP) | **5 (10%)** | 17 (34%) | 26 (52%) + 2 unknown |

### Secondary INCI check

Re-scored branded products only (excluded 8 `Unknown brand — GA…` internal SKUs) using first 3 non-solvent tokens from parsed INCI:

| Verdict | Count |
|---------|------:|
| correct | 1 |
| partial | 3 |
| wrong | 38 |

Conclusion unchanged: INCI-level accuracy is very poor even when ground truth uses parsed INCI instead of featured-ingredient copy.

---

## Representative examples

| Product | Outcome | Notes |
|---------|---------|-------|
| medicube PDRN Pink Collagen Gel Mask | ✓ ingredients, plausible description | Hero marketing actives (PDRN, collagen) align with LLM guesses |
| frommedi TXA Niacinamide Brightening Mask | ~ partial ingredients | TXA + niacinamide theme correct; missed alpha-arbutin |
| SNP Gold Collagen Daily Mask | ~ partial ingredients | Collagen/gold theme partially matched |
| Dermatory Hyaluron Moisture Embo Pad | ✗ ingredients | LLM guessed generic HA stack; actual top actives differ |
| Isntree Hyaluronic Acid Mask 10P | ✗ ingredients | Category guess reasonable; INCI wrong (ground truth row also had polluted featured copy) |
| Unknown brand — GA210001052 | ✗ ingredients | LLM correctly returned empty / unknown |
| Dr.G Black Snail Retinol 3P Set | ✗ ingredients, plausible description | Line-level snail+retinol guess; wrong INCI vs scrape |

---

## Observed patterns

1. **Generic K-beauty template hallucination** — Many responses list a similar stack: niacinamide, panthenol, centella, hyaluronic acid, beta-glucan, adenosine — regardless of actual formula.
2. **Hero active theming** — When a product name or marketing prominently features an active (PDRN, tranexamic acid, collagen), the model often gets the *theme* right but not the full INCI list.
3. **Category > SKU** — Model is better at identifying product *format* (sheet mask, toner pad, nose strip) than specific ingredients or PDP claims.
4. **Obscure / exclusive SKUs** — Olive Young exclusives, multi-SKU sets, and internal `GA…` product codes: model admits ignorance or stays vague.
5. **Ground truth caveats** — Some scraped `topIngredients` rows contain marketing narrative rather than clean INCI (featured-ingredient spec misparsed). This makes strict scoring conservative in both directions; INCI-based re-score still shows ~90% wrong.

---

## Product / engineering implications

| Data type | Rely on LLM pretraining? | Recommendation |
|-----------|--------------------------|----------------|
| Exact / main ingredients | **No** | Keep `getProductTopIngredients` + `enrichShoppingProductCardsWithIngredients` pipeline |
| Ingredient-led compare / hero actives | **No** | Ground in tool output + scraped specs (per ALE-15) |
| Product category / format | **Sometimes** | Useful for conversational framing only; verify via catalog |
| PDP-specific benefits, sets, exclusives | **No** | Pass scraped descriptions and specs via agent tools |
| Unknown / internal SKUs | **No** | Model will not know; catalog scrape is essential |

**Do not remove** catalog context from the shopping agent to save tokens — the empirical miss rate on ingredients is ~88–98% depending on scoring method.

---

## How to re-run

```bash
cd commerce-platform-backend

# 1. Sample products from DB (requires DATABASE_URL)
npx dotenv-cli -e .env -e .env.local -- tsx scripts/llmIngredientKnowledgeSample.ts

# 2. Blind LLM call (requires OPENAI_API_KEY — use .env.local; empty key in .env overrides if loaded last)
npx dotenv-cli -e .env.local -- tsx scripts/llmIngredientKnowledgeTest.ts

# 3. Compare and write comparison.md
npx tsx scripts/llmIngredientKnowledgeCompare.ts
```

**Env vars:**

| Variable | Default | Purpose |
|----------|---------|---------|
| `LLM_INGREDIENT_KNOWLEDGE_SAMPLE_SIZE` | 50 | Sample count |
| `LLM_INGREDIENT_KNOWLEDGE_SEED` | 42 | Reproducible shuffle |
| `LLM_INGREDIENT_KNOWLEDGE_MODEL` | gpt-4.1-mini | Model under test |
| `LLM_INGREDIENT_KNOWLEDGE_SLEEP_MS` | 300 | Pause between API batches |

---

## Optional follow-ups (not in scope for ALE-75)

- [ ] Tighten sample filter: exclude `Unknown brand` / internal GA SKUs; require `ingredientSource: "inci"` for cleaner ground truth
- [ ] Re-run with `gpt-4o-mini` (shopping agent model) for apples-to-apples comparison
- [ ] Add LLM-as-judge for description quality (beyond keyword overlap)
- [ ] Track benchmark over time as catalog grows or model version changes

---

## TODO

- [x] Design benchmark methodology (blind name-only LLM vs scraped ground truth)
- [x] Implement sample / test / compare scripts
- [x] Run benchmark on 50 products (seed=42)
- [x] Document findings in implementation plan
- [x] Create Linear ticket ALE-75
