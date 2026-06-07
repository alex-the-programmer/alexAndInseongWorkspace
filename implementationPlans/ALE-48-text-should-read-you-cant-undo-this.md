# ALE-48 Text should read "You can't undo this"

## Context

[Linear ALE-48](https://linear.app/dewly/issue/ALE-48/text-should-read-you-cant-undo-this): update the **body copy** in the chat deletion confirmation modal.

The ticket screenshot shows the modal with title **Delete this chat?** and body text that should read:

> This removes the chat from your list. You can't undo this.

**Current copy** in `deleteChatConfirmModal.tsx` ends with **"yet"**:

> This removes the chat from your list. You can't undo this **yet**.

**Target copy** (per ticket):

> This removes the chat from your list. You can't undo this.

No other modal strings change for this ticket (title **Delete this chat?** and buttons **Cancel** / **Delete** stay as-is).

**Repo scope:** `commerce-platform-frontend` only.

**Related work:** [ALE-27](ALE-27-chat-delete.md) — shipped the delete modal and trash affordance; ALE-48 is a follow-up copy fix on that UI.

**Branch:** `alexmtruecar/ale-48-text-should-read-you-cant-undo-this` (per Linear) or `ALE-48-text-should-read-you-cant-undo-this` (team convention).

**Database changes:** None.

---

## Current state

| Location | Shipped |
| -------- | ------- |
| `commerce-platform-frontend/components/deleteChatConfirmModal.tsx` | Body: `This removes the chat from your list. You can't undo this.` |
| `commerce-platform-frontend/src/__tests__/components/deleteChatConfirmModal.test.tsx` | Asserts updated copy |

**PR:** https://github.com/alex-the-programmer/commerce-platform-frontend/pull/14 (merged)

---

## Gap analysis

| Area | Today | Target (ALE-48) |
| ---- | ----- | ----------------- |
| Modal body | `…You can't undo this yet.` | `…You can't undo this.` |
| Title / buttons | Unchanged | Unchanged |
| Backend / GraphQL | N/A | No changes |

---

## Implementation plan

### 1. Update modal copy

**File:** `commerce-platform-frontend/components/deleteChatConfirmModal.tsx`

Change the `<p>` body string from:

```tsx
This removes the chat from your list. You can&apos;t undo this yet.
```

to:

```tsx
This removes the chat from your list. You can&apos;t undo this.
```

### 2. Update test

**File:** `commerce-platform-frontend/src/__tests__/components/deleteChatConfirmModal.test.tsx`

Update the `getByText` assertion in **shows title, body copy, and actions when open** to match the new string (no `yet`).

### 3. Verification

```bash
cd commerce-platform-frontend
npm run lint && npm run build
npm test -- --testPathPattern=deleteChatConfirmModal
```

**Manual:** Open delete confirm on a non-active chat in My chats → body matches ticket copy exactly.

---

## File checklist

| File | Action |
| ---- | ------ |
| `components/deleteChatConfirmModal.tsx` | Remove ` yet` from body copy |
| `src/__tests__/components/deleteChatConfirmModal.test.tsx` | Update expected body text |

---

## TODO

- [x] Update `deleteChatConfirmModal.tsx` body copy
- [x] Update `deleteChatConfirmModal.test.tsx` assertion
- [x] `npm run build`, `npm test` in frontend
- [x] Manual QA: confirm modal text matches screenshot / ticket
