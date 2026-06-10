# ALE-50 [Bug] When deleting a product, ask a confirmation

## Context

[Linear ALE-50](https://linear.app/dewly/issue/ALE-50/bug-when-deleting-a-product-ask-a-confirmation): on the signed-in `/skincare-routine` page, tapping the **trash icon** on a routine step card **immediately** calls `removeRoutineItem` with no confirmation. That is too easy to trigger by accident.

**Goal:** Show an in-app confirmation modal before removing a manual routine product, using the **same UX pattern** as chat deletion ([ALE-27](ALE-27-chat-delete.md) / `DeleteChatConfirmModal`).

**Repo scope:** `commerce-platform-frontend` only. The `removeRoutineItem` GraphQL mutation and backend interaction already exist — no schema, migration, or API changes.

**Branch:** `ALE-50-routine-product-delete-confirmation` (frontend only; create off latest `main`).

**Related work:**

- [ALE-27](ALE-27-chat-delete.md) — shipped `DeleteChatConfirmModal` + `OverlayModal` + trash affordance pattern for chats.
- [ALE-48](ALE-48-text-should-read-you-cant-undo-this.md) — finalized chat modal body copy (`You can't undo this.` without `yet`). Mirror that tone for routine copy.

**Database changes:** None.

**PR:** https://github.com/alex-the-programmer/commerce-platform-frontend/pull/15

---

## Current state

| Layer | Location | Behavior today |
|-------|----------|----------------|
| UI card | `components/routineStepCard.tsx` | Trash button (`aria-label="Remove step"`) calls `onRemove` on click |
| Page | `components/skincareRoutinePage.tsx` | `onRemove={() => void handleRemove(String(item.id))}` — **no confirm step** |
| Mutation | `handleRemove` → `useRemoveRoutineItemMutation` | Deletes item, then `refetch()` |
| Confirm pattern (chat) | `components/deleteChatConfirmModal.tsx` | `OverlayModal` + Cancel / Delete; loading state `Deleting…`; **no** `window.confirm` |
| Internal removes | `lib/applyRoutineRecommendation.ts` | Calls `removeRoutineItem` when applying/dismissing recommendations — **programmatic**, not user trash |

There is **no** confirmation modal for routine product removal today.

---

## Gap analysis

| Area | Today | Target (ALE-50) |
|------|-------|-----------------|
| Trash on `RoutineStepCard` | Immediate `removeRoutineItem` | Open confirm modal first |
| Confirm UX | N/A | In-app modal (`OverlayModal`), same shell as chat delete |
| Native dialogs | N/A | **Do not** use `window.confirm` / `window.alert` |
| Backend / GraphQL | `removeRoutineItem` works | Unchanged |
| Recommendation apply/dismiss | Removes recommended rows internally | **Out of scope** — not triggered by trash on manual cards |

---

## Design decisions

### Confirm before user-initiated trash only (locked)

- Only the **manual routine step trash** on `/skincare-routine` needs confirmation.
- **Do not** add confirmation to `applyRoutineRecommendation` / recommendation dismiss flows — those are explicit “Apply” / “Dismiss” actions with different intent.

### Reuse chat delete modal pattern, not a generic abstraction (locked)

- Add a **dedicated** `RemoveRoutineItemConfirmModal` that mirrors `DeleteChatConfirmModal` structure (props: `open`, `onClose`, `onConfirm`, `isRemoving`).
- **Do not** extract a shared `ConfirmDeleteModal` in this ticket — keeps diff small and matches how chat shipped.
- Compose with existing `OverlayModal` + `Button` (`variant="outline"` for Cancel).

### Copy (locked)

Align with chat modal voice ([ALE-48](ALE-48-text-should-read-you-cant-undo-this.md)):

| Element | Copy |
|---------|------|
| Title | **Remove this product?** |
| Body | This removes the product from your routine. You can't undo this. |
| Cancel | Cancel |
| Confirm | **Remove** (loading: **Removing…**) |

Use **Remove** (not Delete) on the primary button — matches `removeRoutineItem`, card `aria-label="Remove step"`, and routine vocabulary. Chat keeps **Delete** for chats.

`ariaLabel` on dialog: `Remove routine product confirmation`.

**Do not** include the product name in the modal for v1 (chat delete also omits chat title) — keeps implementation simple. Optional follow-up if design wants personalized copy.

### State and handlers in `skincareRoutinePage.tsx` (locked)

```ts
removeConfirmItemId: string | null
```

| Handler | Behavior |
|---------|----------|
| `onRequestRemoveItem(routineItemId)` | Set `removeConfirmItemId` (called from trash via `RoutineStepCard.onRemove`) |
| `onCancelRemoveItem()` | Clear `removeConfirmItemId` (Cancel, backdrop, Escape via `OverlayModal`) |
| `onConfirmRemoveItem()` | If id set: call existing `handleRemove(id)`, then clear id in `finally` |

While `removeLoading` is true, disable modal buttons and show **Removing…** on the primary action (same as chat `isDeleting`).

### Close dialog on context change (locked)

- When user switches **AM/PM** slot (`slot` state changes), clear `removeConfirmItemId` so they cannot confirm removal of a card that is no longer visible.
- Optional: clear if the item id disappears from `currentItems` after refetch (edge case; `finally` clear after confirm is sufficient for happy path).

### `RoutineStepCard` API (locked)

- **No prop rename required.** Keep `onRemove`; parent wires it to `onRequestRemoveItem` instead of `handleRemove`.
- Trash stays disabled when `disabled={isMutating}` (unchanged).

---

## Implementation plan

### 1. New confirm modal component

**New file:** `commerce-platform-frontend/components/removeRoutineItemConfirmModal.tsx`

Mirror `deleteChatConfirmModal.tsx`:

- `OverlayModal` with `maxWidth={440}`
- Body `<p>` with muted text styling from theme
- Footer: `Button variant="outline"` Cancel + styled primary **Remove** button (copy destructive button styles from chat modal)
- Props: `open`, `onClose`, `onConfirm`, `isRemoving`

### 2. Wire modal in routine page

**File:** `components/skincareRoutinePage.tsx`

1. `import RemoveRoutineItemConfirmModal from "@/components/removeRoutineItemConfirmModal"`
2. `const [removeConfirmItemId, setRemoveConfirmItemId] = useState<string | null>(null)`
3. `onRequestRemoveItem` / `onCancelRemoveItem` / `onConfirmRemoveItem` callbacks (see design decisions)
4. `useEffect(() => setRemoveConfirmItemId(null), [slot])`
5. Change card wiring:

```tsx
onRemove={() => onRequestRemoveItem(String(item.id))}
```

6. Render modal near bottom of page JSX (same placement pattern as `DeleteChatConfirmModal` in `chatPage.tsx`):

```tsx
<RemoveRoutineItemConfirmModal
  open={removeConfirmItemId != null}
  onClose={onCancelRemoveItem}
  onConfirm={() => void onConfirmRemoveItem()}
  isRemoving={removeLoading}
/>
```

`handleRemove` stays the single place that calls the mutation + refetch.

### 3. Tests

**New file:** `src/__tests__/components/removeRoutineItemConfirmModal.test.tsx`

Mirror `deleteChatConfirmModal.test.tsx`:

- Renders nothing when closed
- Shows dialog title, body, Cancel, Remove when open
- Cancel → `onClose`
- Remove → `onConfirm`
- `isRemoving` disables buttons and shows **Removing…**

**Optional (recommended):** extend `src/__tests__/components/skincareRoutinePage.test.tsx`:

- Mock `RemoveRoutineItemConfirmModal` or render real modal
- Assert trash click does **not** call `removeRoutineItemMutation` until confirm
- Assert confirm calls mutation once

Pure helper test is **not** required (unlike `canDeleteChat` — no active-item guard here).

### 4. Verification

```bash
cd commerce-platform-frontend
npm run lint && npm run build
npm test -- --testPathPattern="removeRoutineItemConfirmModal|skincareRoutinePage"
```

**Manual QA:**

1. Sign in; open `/skincare-routine` with at least one manual step in AM or PM.
2. Click trash on a step → confirmation modal appears; routine list unchanged.
3. Cancel / backdrop / Escape → modal closes; step still present.
4. Click trash again → **Remove** → step disappears; list refetches.
5. While removing, buttons disabled and label **Removing…**.
6. Switch AM/PM while modal open → modal closes (or is not confirmable for wrong context).
7. Applying a recommendation still works without extra confirm on internal removes.

---

## File checklist

| File | Action |
|------|--------|
| `components/removeRoutineItemConfirmModal.tsx` | **New** — confirm UI |
| `components/skincareRoutinePage.tsx` | Modal state, handlers, wire trash → request remove |
| `src/__tests__/components/removeRoutineItemConfirmModal.test.tsx` | **New** — modal unit tests |
| `src/__tests__/components/skincareRoutinePage.test.tsx` | Optional — integration test for confirm gate |

**No changes:** `routineStepCard.tsx`, backend, GraphQL operations, `applyRoutineRecommendation.ts`.

---

## Out of scope

- Generic/shared destructive confirm component
- Product name in modal body
- Confirmation on recommendation dismiss / apply flows
- Undo / soft-delete for routine items
- Chat or other surfaces (already have chat confirm)

---

## TODO

- [x] Create branch `ALE-50-routine-product-delete-confirmation` off latest `main`
- [x] Add `RemoveRoutineItemConfirmModal` (mirror `DeleteChatConfirmModal`)
- [x] Wire confirm flow in `skincareRoutinePage.tsx` (+ close on slot change)
- [x] Unit tests for confirm modal
- [x] Optional: skincareRoutinePage integration test (trash gated behind confirm)
- [x] `npm run build`, `npm test` in frontend (`npm run lint` has pre-existing failures on `main`)
- [ ] Manual QA per checklist
- [x] Open PR against `main` in `commerce-platform-frontend`
