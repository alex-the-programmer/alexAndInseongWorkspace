# Flow: routine-add-product

**Priority:** P1  
**Auth:** signed-in  
**Preconditions:** User has at least one routine step slot; catalog has searchable products.

## Cases

### routine-add-product-01: Open product lookup and add

- **Steps:**
  1. On `/skincare-routine`, find a step with **Add** control
  2. Open product lookup, search for a known brand (e.g. `COSRX`)
  3. Select a product from results
- **Assertions:**
  - Step shows added product name (brand · product pattern)
  - **Remove step** or product remove control available
- **Notes:** Requires DB with catalog; search UX may be combobox — use `getByRole('combobox')` or label from implementation.

### routine-add-product-02: Remove product confirmation

- **Steps:**
  1. Remove a catalog product from a step
  2. Confirm in **Remove routine product confirmation** dialog
- **Assertions:**
  - Product removed from step; slot returns to empty/add state
- **Notes:** P1; depends on routine-add-product-01 setup.
