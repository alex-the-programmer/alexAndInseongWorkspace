# Flow: chat-thread-management

**Priority:** P1  
**Auth:** signed-in  
**Preconditions:** User has at least two chats (or create via **New chat**).

## Cases

### chat-thread-management-01: Switch chat from list

- **Steps:**
  1. Open **My chats** (mobile drawer) or sidebar list (desktop)
  2. Select a different chat
- **Assertions:**
  - URL updates to selected `/chat/:id`
  - Message list reflects selected thread

### chat-thread-management-02: Rename chat

- **Steps:**
  1. Click **Rename** on active chat
  2. Enter new title, click **Save**
- **Assertions:**
  - Chat list shows new title
- **Notes:** Desktop vs mobile UI may differ.

### chat-thread-management-03: Delete chat with confirmation

- **Steps:**
  1. Click **Delete chat**
  2. Confirm in **Delete chat confirmation** dialog
- **Assertions:**
  - Chat removed from list; navigates to another chat or empty state

### chat-summary-01: Sidebar synopsis avoids K-beauty boilerplate (ALE-42)

- **Steps:**
  1. Chat about gentle cleanser → **New chat**
  2. Poll sidebar for generated synopsis
- **Assertions:** Synopsis does not start with “K-beauty” / “Korean skincare”
- **Spec:** `playwright/tests/chat/chat-summary.spec.ts`
