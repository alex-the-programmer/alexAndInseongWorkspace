# ALE-39 Show full description in a tooltip on hover

## Context

[Linear ALE-39](https://linear.app/alexandinseongprojects/issue/ALE-39/we-need-to-show-a-full-description-in-a-tooltip-on-hover): when chat history text is **truncated** in the UI, hovering should reveal the **full** text in a tooltip.

The ticket includes a product screenshot (sidebar chat cards). Code review maps this to the **My chats** sidebar in Commerce Platform: `synopsis` is shortened for display via `formatChatSynopsis` with **no** hover affordance today.

**Repo scope:** `commerce-platform-frontend` only. Synopsis text is already stored in full on `Chat.synopsis` from the backend (`summarizeChatForHistoryCard`); no API or schema changes.

**Related work:**

- [ALE-42](ALE-42-reduce-redundant-k-beauty-in-chat-summaries.md) — improves synopsis *content* server-side; display truncation in the sidebar remains intentional for card density.
- [ALE-27](ALE-27-chat-delete.md) — sidebar card layout (Pin / Rename / Delete); tooltip must not block those controls.

**Branch:** `alexmtruecar/ale-39-we-need-to-show-a-full-description-in-a-tooltip-on-hover` (per Linear) or `ALE-39-full-description-tooltip-on-hover` (team convention).

**Database changes:** None.

---

## Current state

| Layer | Location | Behavior today |
| ----- | -------- | -------------- |
| Data | GraphQL `Chat.synopsis` | Full string (Zod cap **280** chars at write time in backend) |
| Display helper | `components/chatPage.tsx` → `formatChatSynopsis` | Returns `"No summary yet."` if empty; else truncates at **180** chars (`177` + `…`) |
| Sidebar UI | `ChatChatsSidebar` in same file (~line 426–434) | Renders `{formatChatSynopsis(chat)}` in a muted `<div>` with **no** `title` / tooltip |
| Chat title | Same card (~line 247–258) | Single-line **CSS** ellipsis (`whiteSpace: nowrap`, `textOverflow: ellipsis`) — also hides overflow with no tooltip |
| `nextActionDescription` | Same card (~line 461–474) | Rendered **in full** (not truncated) — out of scope unless product revisits |
| Tooltip primitive | — | **No** `components/tooltip.tsx` in this repo; `shoppingProductCard.tsx` uses native `title` for badge tooltips only |
| Tests | `src/__tests__/components/chatPageHelpers.test.ts` | Mirrors `formatChatSynopsis` / `formatChatTitle`; no truncation-tooltip behavior |

```54:57:commerce-platform-frontend/components/chatPage.tsx
function formatChatSynopsis(chat: Pick<Chat, "synopsis">) {
  const synopsis = chat.synopsis?.trim();
  if (!synopsis) return "No summary yet.";
  return synopsis.length > 180 ? `${synopsis.slice(0, 177)}…` : synopsis;
}
```

---

## Gap analysis

| Area | Today | Target (ALE-39) |
| ---- | ----- | ----------------- |
| Truncated synopsis | User sees `…` with no way to read the rest without opening the chat | Hover shows **full synopsis** in a styled tooltip |
| Non-truncated synopsis | Same as full text | **No** tooltip (avoid noise) |
| Empty synopsis | `"No summary yet."` placeholder | **No** tooltip |
| Tooltip UX | N/A | Readable multiline copy; does not steal clicks from card navigation |
| Mobile | N/A | Accept v1 limitation: hover tooltips are desktop-first; no new tap-to-expand scope unless product asks |

---

## Design decisions

### Scope: synopsis first (locked)

- Primary deliverable is **`Chat.synopsis`** in the sidebar — this is the only place we **programmatically** truncate with `formatChatSynopsis`.
- **Optional stretch (same PR if trivial):** native `title={formatChatTitle(chat)}` on the title row when not editing, so CSS-ellipsized titles are readable on hover. No new component required for that row.

### Do not change truncation length (locked)

- Keep **180** display characters so sidebar density stays the same; only add the hover affordance.
- Do **not** move K-beauty or summary cleanup into the frontend (see ALE-42).

### Prefer a small multiline `Tooltip` component over native `title` for synopsis (locked)

- Native `title` is poor for **multiline** synopsis (no width control, inconsistent delay, weak styling).
- Port the pattern from `conquistador-platform-frontend/components/tooltip.tsx` (portal + delayed show) but change tooltip body styles:
  - `whiteSpace: "normal"`, `maxWidth: ~min(320px, 90vw)`, `lineHeight: 1.4`
  - Optional `maxHeight` + `overflowY: auto` for edge cases near the 280-char backend cap
- **Do not** copy `whiteSpace: "nowrap"` from Conquistador — it is wrong for paragraph synopsis text.

### Only mount tooltip when truncated (locked)

- Refactor display logic so the UI knows `{ displayText, fullText, isTruncated }`.
- Wrap synopsis in `<Tooltip content={fullText}>` only when `isTruncated && fullText`.
- `cursor: help` (or default) on truncated synopsis only.

### Pointer events (locked)

- Tooltip overlay uses `pointerEvents: "none"` (same as Conquistador).
- Wrapper is `display: block` / `width: 100%` so hover target is the synopsis line, not an inline sliver.

---

## Proposed implementation

### 1. Extract chat display helpers

Create `commerce-platform-frontend/lib/chatDisplay.ts` (keeps `chatPage.tsx` smaller and matches existing test mirroring pattern):

```ts
export const CHAT_SYNOPSIS_DISPLAY_MAX_CHARS = 180;

export function getChatSynopsisDisplay(chat: { synopsis?: string | null }): {
  displayText: string;
  fullText: string | null;
  isTruncated: boolean;
} {
  const synopsis = chat.synopsis?.trim() ?? "";
  if (!synopsis) {
    return { displayText: "No summary yet.", fullText: null, isTruncated: false };
  }
  if (synopsis.length <= CHAT_SYNOPSIS_DISPLAY_MAX_CHARS) {
    return { displayText: synopsis, fullText: synopsis, isTruncated: false };
  }
  return {
    displayText: `${synopsis.slice(0, CHAT_SYNOPSIS_DISPLAY_MAX_CHARS - 3)}…`,
    fullText: synopsis,
    isTruncated: true,
  };
}

// formatChatSynopsis(chat) → getChatSynopsisDisplay(chat).displayText (thin wrapper for compat)
```

- Update `chatPage.tsx` to import helpers; remove duplicated inline `formatChatSynopsis` if moved.

### 2. Add `components/tooltip.tsx`

- Client component; copy structure from Conquistador `tooltip.tsx` (delay **400ms**, portal to `document.body`, reposition on scroll/resize).
- Add optional prop `multiline?: boolean` (default `false` for future reuse) — when `true`, apply multiline styles above.
- Export `Tooltip` with props: `content: string`, `children`, `side?`, `fullWidth?`, `multiline?`.
- Guard: if `!content.trim()`, render `children` only.

### 3. Wire sidebar synopsis

In `ChatChatsSidebar` card body:

```tsx
const { displayText, fullText, isTruncated } = getChatSynopsisDisplay(chat);
const synopsisEl = (
  <div style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 6, lineHeight: 1.4 }}>
    {displayText}
  </div>
);
return isTruncated && fullText ? (
  <Tooltip content={fullText} multiline side="top">
    {synopsisEl}
  </Tooltip>
) : (
  synopsisEl
);
```

- Ensure tooltip does not wrap the entire card (only synopsis) so Pin/Rename/Delete remain clickable.

### 4. Optional: chat title native tooltip

On the title `<div>` (when `!isEditing`):

```tsx
title={formatChatTitle(chat)}
```

Low cost; helps when title is ellipsized by CSS.

### 5. Tests

| File | Cases |
| ---- | ----- |
| `src/__tests__/lib/chatDisplay.test.ts` (new) | empty synopsis; short; exactly 180; 181+ truncated flag and display length |
| `src/__tests__/components/chatPageHelpers.test.ts` | Update to import from `@/lib/chatDisplay` **or** delete duplicated mirrors and rely on `chatDisplay.test.ts` |
| `src/__tests__/components/tooltip.test.tsx` (optional) | Renders children; does not portal when content empty — only if quick with RTL |

Run: `npm test` in `commerce-platform-frontend`.

### 6. Pre-push

```bash
cd commerce-platform-frontend
npm run lint
npm run build
npm test
```

---

## Manual test plan

- [ ] Sidebar: chat with synopsis **&lt; 180** chars — no tooltip on hover over synopsis.
- [ ] Sidebar: chat with synopsis **&gt; 180** chars — hover synopsis shows **full** text; display line still truncated with `…`.
- [ ] Empty synopsis — shows “No summary yet.”, no tooltip.
- [ ] Truncated synopsis — card still navigates on click; Pin/Rename/Delete still work; tooltip does not block clicks.
- [ ] Narrow / mobile drawer: same sidebar component; note hover limitation on touch devices (acceptable v1).
- [ ] Dark/light theme: tooltip readable (uses `theme.colors.textPrimary` background like Conquistador).
- [ ] (Stretch) Long chat title — browser native tooltip shows full title on hover.

---

## Out of scope

- Backend / summarization prompt changes (ALE-42).
- Showing full synopsis inline without hover (would break sidebar density).
- Touch “long press to preview” unless product requests.
- `nextActionDescription` tooltip (not truncated today).
- Shopping product cards / routine recommendation tooltips (separate tickets unless screenshot targets those).
- Sharing `Tooltip` across repos (Conquistador/CFC) — copy into commerce frontend only for this ticket.

---

## Risks / notes

- **Z-index:** Tooltip uses max z-index portal; verify it appears above mobile drawer overlay (`ChatChatsSidebar` in drawer) — raise only if QA finds clipping.
- **Accessibility:** v1 is hover-only; follow-up could add `aria-describedby` + focus-visible for keyboard users (not required for ALE-39 unless requested).

---

## TODO

- [x] Create branch `ALE-39-full-description-tooltip-on-hover` from latest `main` in `commerce-platform-frontend`
- [x] Add `lib/chatDisplay.ts` + unit tests
- [x] Add `components/tooltip.tsx` (multiline-capable)
- [x] Wire synopsis tooltip in `ChatChatsSidebar` (`chatPage.tsx`)
- [x] Optional: `title` on truncated chat title row
- [x] Run `npm run lint`, `npm run build`, `npm test` (build + tests pass; repo lint has pre-existing failures unrelated to this ticket)
- [ ] Manual QA per checklist above
- [x] Open PR against `main` for `commerce-platform-frontend` — https://github.com/alex-the-programmer/commerce-platform-frontend/pull/10
