# ALE-27 Delete chat from My chats sidebar

## Context

[Linear ALE-27](https://linear.app/alexandinseongprojects/issue/ALE-27): let users **delete a chat** from the **My chats** sidebar (desktop sidebar + mobile drawer). Placement is a **trash icon** to the right of **Rename**, as shown in the product mock.

Deletion is **soft delete**: add nullable `deletedAt` on `chats`; list queries hide deleted rows; chat-scoped operations treat deleted chats as gone.

**Product rules:** show an **in-app confirmation modal** (not `window.confirm`) before deleting; users may delete **any chat except the one they are currently viewing** (no trash on the active card).

**Repo scope:** `commerce-platform-backend` (schema + migration + interactions + GraphQL) and `commerce-platform-frontend` (sidebar UI + mutation). No scrapers migration (backend owns DB; scrapers schema is introspected separately if needed later).

**Branch:** `ALE-27-chat-delete` (create matching branches in backend and frontend if not already on ticket branch).

---

## Current state

| Layer | Location | Behavior today |
|-------|----------|----------------|
| DB | `commerce-platform-backend/prisma/schema.prisma` → `Chat` | No `deletedAt`; rows are permanent |
| List | `interactions/chats/listMyChats.ts` | `findMany` for `userId` (+ optional title/synopsis search); order `isPinned desc`, `updatedAt desc` |
| Ownership | `interactions/chats/assertChatOwned.ts` | `findFirst` by `id` + `userId` only |
| Messages | `interactions/chat/getChatMessages.ts` | Separate `findFirst` by `id` + `user.clerkUserId` (no delete check) |
| GraphQL | `publicSchema.graphql` | `myChats`, `renameChat`, `setChatPinned`; no delete mutation |
| UI | `commerce-platform-frontend/components/chatPage.tsx` → `ChatChatsSidebar` | Per-card actions: **Pin**, **Rename** (lines ~256–297); card click navigates to `/chat/[id]` |
| Mobile | Same file | Narrow layout opens same sidebar in drawer via **My chats** button |

There is **no** existing soft-delete pattern on `chats` in this codebase.

---

## Gap analysis

| Area | Today | Target (ALE-27) |
|------|-------|-----------------|
| Storage | Chat rows never removed | `deletedAt` set to `now()` on delete |
| `myChats` | All user chats | Only `deletedAt IS NULL` |
| Pin / rename / messages / cart / send | Work on any owned chat | Fail or no-op on deleted chat (treat as not found) |
| Sidebar actions | Pin, Rename | Pin, Rename, **Delete** (trash icon) on **non-active** chats only |
| Active thread | N/A | **Current chat cannot be deleted** — no trash on active card |
| Delete UX | N/A | **Confirmation dialog** before soft delete runs |

---

## Design decisions

### Soft delete only (locked)

- **Do not** hard-delete `chats` rows (preserves Mastra thread id, cart links, usage events, and allows future “trash / restore” if product wants it).
- `deleteChat` sets `deletedAt = new Date()`; idempotent if already deleted (return success).

### Confirmation dialog before delete (locked)

- Trash click opens an in-app confirm step; mutation runs only after the user taps **Delete** in that UI.
- **Do not** use `window.confirm`, `window.alert`, or any other **native browser dialog** — they break visual consistency and are not acceptable for this feature.
- **Do** use existing app components:
  - Shell: `components/overlayModal.tsx` (`open`, `onClose`, `title`, `ariaLabel`, children) — same pattern as `RoutineSetupModal`, `QuizModal`, etc.
  - Actions: `components/button.tsx` (`variant="outline"` for Cancel; primary/destructive styling for Delete per theme tokens).
- Prefer a small dedicated wrapper, e.g. `components/deleteChatConfirmModal.tsx`, that composes `OverlayModal` + copy + buttons so `chatPage.tsx` stays readable. Not required if inline in `chatPage` stays small.
- Copy (suggested):
  - **Title:** Delete this chat?
  - **Body:** This removes the chat from your list. You can’t undo this yet.
  - **Actions:** Cancel | Delete
- State in `chatPage.tsx`: `deleteConfirmChatId: string | null`; trash sets it; Cancel / backdrop / Escape → `onClose`; Confirm calls `deleteChatMutation` then clears.
- While mutation runs, disable dialog buttons and show loading label on Delete (e.g. “Deleting…”) via `actionChatId` or `isDeleting`.

### Current chat cannot be deleted (locked)

- **Active chat** = `chatIdStr(chat.id) === activeChatId` (same id used for routing and highlight).
- On the **active** card: **do not render** the trash control (preferred over a disabled icon — avoids “why can’t I click this?”).
- On **all other** cards: show trash; click → confirmation dialog → delete.
- Enforcement is **frontend-only** (backend `deleteChat` stays generic). Prevents accidental deletion of the thread the user is viewing; no post-delete navigation logic needed.
- **Single-chat user:** only one card exists and it is always active → no delete affordance until they open another chat (e.g. **New chat**).

### Deleted chat is inaccessible everywhere (locked)

- `listMyChats`: `deletedAt: null` in `where`.
- `assertChatOwnedByUser`: add `deletedAt: null` so pin/rename/delete/summarize/cart paths reject deleted chats.
- `getChatMessages`: add `deletedAt: null` to its `findFirst` (today it does not use `assertChatOwned`).

### GraphQL shape

- Mutation: `deleteChat(chatId: EncodedID!): Boolean!` — same style as `removeRoutineItem`.
- **Do not** expose `deletedAt` on `ShoppingChat` / `Chat` for clients in v1 (deleted chats never appear in queries).

### After delete (frontend)

- User always stays on the **current** thread (only non-active chats are deletable).
- On confirm: `deleteChatMutation` → `refetchChats()` → close dialog. No `router.push` unless the deleted id somehow matched active (should not happen if UI rules are followed).

### Trash control styling

- Reuse the **icon-only** pattern from `routineStepCard.tsx` (trash SVG, `aria-label="Delete chat"`, muted color, `stopPropagation` on click).
- Place in the same flex row as Pin/Rename (`gap: 6`), **after Rename**.
- Render **only when** `idStr && idStr !== activeChatId`.
- Disable when `isActing` (pin/rename/delete in flight on any card).

---

## Database change (architect approval required)

**Table:** `chats`  
**Column:** `deletedAt` — `DateTime`, nullable, mapped as `deletedAt`

Prisma (`commerce-platform-backend/prisma/schema.prisma`):

```prisma
model Chat {
  // ...existing fields...
  deletedAt DateTime? @map("deletedAt")
  // ...
}
```

**Migration:** `npx prisma migrate dev --name "add-chats-deleted-at"` (run only after approval).

**Index (optional, add if explain plans show seq scans):** composite filter for list — e.g. `@@index([userId, deletedAt, isPinned, updatedAt(sort: Desc)])`. Start with existing indexes + `deletedAt: null` filter; add index only if needed.

**Out of scope:** changing `commerce-platform-scrapers` schema (introspection can catch up later).

---

## Implementation plan

### 1. Backend — schema and migration

1. Add `deletedAt` to `Chat` in `schema.prisma`.
2. Generate and apply migration after architect sign-off.
3. Run `npm run codegen` in backend after GraphQL schema changes (step 2).

### 2. Backend — `deleteChat` interaction

**New file:** `src/interactions/chats/deleteChat.ts`

```ts
// ensureUser → assertChatOwnedByUser (must see non-deleted chat)
// prisma.chat.update({ data: { deletedAt: new Date() } })
// if already deletedAt set, return without error (idempotent)
```

**Tests:** `src/__tests__/interactions/chats/deleteChat.test.ts`

- Sets `deletedAt` for owned chat
- Idempotent second delete
- Rejects other user's chat
- After delete, `listMyChats` does not return the chat

### 3. Backend — filter deleted chats everywhere lists/loads chats

| File | Change |
|------|--------|
| `listMyChats.ts` | `where: { userId, deletedAt: null, ...search }` |
| `assertChatOwned.ts` | `where: { id, userId, deletedAt: null }` |
| `getChatMessages.ts` | `where: { id, user: { clerkUserId }, deletedAt: null }` |

**Tests:** extend `listMyChats.test.ts` — deleted chat excluded; extend `assertChatOwned.test.ts` — deleted chat throws.

### 4. Backend — GraphQL

**`src/graphql/publicSchema.graphql`:**

```graphql
type Mutation {
  # ...
  deleteChat(chatId: EncodedID!): Boolean!
}
```

**`src/graphql/publicResolvers.ts`:** wire `deleteChat` → `deleteChat(clerkUserId, chatId)`.

**Tests:**

- `src/__tests__/graphql/deleteChat.mutation.test.ts` (mock interaction, assert args + `true`)
- Optional: extend `myChats.query.test.ts` doc that list interaction filters deleted (interaction test is sufficient)

Run `npm run codegen` in backend.

### 5. Frontend — GraphQL operations

**`graphql/shopOperations.graphql`:**

```graphql
mutation DeleteChat($chatId: EncodedID!) {
  deleteChat(chatId: $chatId)
}
```

Copy/sync `graphql/publicSchema.graphql` if the frontend keeps a mirror. Run frontend codegen (`npm run codegen` or project script that regenerates `lib/graphql.ts`).

### 6. Frontend — sidebar UI, confirm dialog, and handlers

**`components/chatPage.tsx`:**

1. `useDeleteChatMutation` alongside pin/rename mutations.
2. State: `deleteConfirmChatId: string | null` (which chat the dialog is for).
3. `onRequestDeleteChat(chatId: string)` — called from trash click:
   - Guard: if `chatId === activeChatId`, return immediately (defense in depth; trash should not be visible).
   - `setDeleteConfirmChatId(chatId)`.
4. `onConfirmDeleteChat()` — called from dialog **Delete** button:
   - `setActionChatId(deleteConfirmChatId)`
   - `deleteChatMutation({ variables: { chatId: deleteConfirmChatId } })`
   - `refetchChats()`
   - clear `deleteConfirmChatId` and `actionChatId` in `finally`
5. `onCancelDeleteChat()` — dialog Cancel / backdrop / Escape → `setDeleteConfirmChatId(null)`.
6. Render `DeleteChatConfirmModal` (wraps `OverlayModal` + `Button`s — **not** `window.confirm`) when `deleteConfirmChatId != null`.
7. Pass `activeChatId`, `onRequestDeleteChat`, and dialog handlers through `sidebarSharedProps` into `ChatChatsSidebar`.
8. In `ChatChatsSidebar`, trash button after Rename **only if** `idStr !== activeChatId`:
   - `type="button"`
   - `aria-label="Delete chat"`
   - `onClick` → `stopPropagation`; `onRequestDeleteChat(idStr)`
   - disabled when `!idStr || isActing`
   - inline SVG (copy from `routineStepCard` trash path or extract tiny `TrashIcon`)

**Tests:** `src/__tests__/components/chatPageDelete.test.ts` (or extend helpers):

- Pure helper `canDeleteChat(chatId, activeChatId)` → `false` when equal, `true` otherwise.
- Optional: render `ChatChatsSidebar` with two chats, assert trash count is 1 and not on active card.

### 7. Edge cases

| Case | Expected behavior |
|------|-------------------|
| Active chat card | No trash icon; Pin/Rename still available |
| Only one chat | That chat is active → no trash on any card |
| Delete while renaming | Trash hidden on active card; on other cards trash disabled when `isActing` |
| User cancels confirm | Dialog closes; no mutation; list unchanged |
| Delete pinned **non-active** chat | Allowed after confirm; disappears from list; current thread unchanged |
| Switch chat while dialog open | Close dialog on `activeChatId` change (`useEffect`) or keep pending id — prefer **close on route change** to avoid deleting the wrong card |
| Deep link `/chat/[deletedId]` | `chatMessages` fails or returns not found → existing error UI; optional follow-up: redirect to `/chat` on 404 |
| `createNextChat(currentChatId: deleted)` | Ownership assert fails → treat as invalid current chat (existing error path) |
| Search | Deleted chats never match `myChats` |
| API delete of active id (tamper) | Backend still soft-deletes if owned; UI should never send this. Optional follow-up: server guard not required for ALE-27 |

---

## File checklist

**Backend**

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add `deletedAt` on `Chat` |
| `prisma/migrations/*` | New migration |
| `src/interactions/chats/deleteChat.ts` | New |
| `src/interactions/chats/listMyChats.ts` | Filter `deletedAt: null` |
| `src/interactions/chats/assertChatOwned.ts` | Filter `deletedAt: null` |
| `src/interactions/chat/getChatMessages.ts` | Filter `deletedAt: null` |
| `src/graphql/publicSchema.graphql` | `deleteChat` mutation |
| `src/graphql/publicResolvers.ts` | Resolver |
| `src/__tests__/interactions/chats/deleteChat.test.ts` | New |
| `src/__tests__/interactions/chats/listMyChats.test.ts` | + deleted excluded |
| `src/__tests__/interactions/chats/assertChatOwned.test.ts` | + deleted rejected |
| `src/__tests__/graphql/deleteChat.mutation.test.ts` | New |

**Frontend**

| File | Action |
|------|--------|
| `graphql/shopOperations.graphql` | `DeleteChat` mutation |
| `graphql/publicSchema.graphql` | Sync mutation |
| `lib/graphql.ts` | Codegen output |
| `components/deleteChatConfirmModal.tsx` | New (recommended): `OverlayModal` + `Button` confirm UI |
| `components/chatPage.tsx` | Trash (non-active only) + wire modal state/handlers |
| `src/__tests__/components/chatPageDelete.test.ts` | `canDeleteChat` helper (+ optional sidebar render test) |

---

## Verification (manual)

1. Backend + frontend dev servers running; signed-in user with **at least two** chats.
2. **Active** chat card: **no** trash icon; Pin/Rename still work.
3. **Other** chat cards: trash icon to the right of Rename.
4. Click trash on a non-active chat → confirmation dialog; Cancel closes with no change.
5. Confirm delete → card disappears; **current** conversation and URL unchanged.
6. Single-chat account: no trash on the only card.
7. Refresh page → deleted chat does not reappear.
8. Mobile drawer: same rules (no trash on active; confirm on others).
9. `npm run lint && npm run build && npm test` in **both** repos.

---

## TODO

- [x] Architect approval for `chats.deletedAt` column
- [x] Backend: Prisma field + migration
- [x] Backend: `deleteChat` interaction + tests
- [x] Backend: `deletedAt: null` filters in `listMyChats`, `assertChatOwned`, `getChatMessages` + tests
- [x] Backend: GraphQL `deleteChat` + resolver + codegen + graphql test
- [x] Frontend: `DeleteChat` operation + codegen
- [x] Frontend: trash icon on non-active cards only
- [x] Frontend: `DeleteChatConfirmModal` (`OverlayModal` + `Button`; no `window.confirm`) + wired handlers
- [x] Frontend: `canDeleteChat` helper test (and optional sidebar render test)
- [ ] Manual QA per checklist
- [x] `npm run lint`, `npm run build`, `npm test` in backend and frontend
