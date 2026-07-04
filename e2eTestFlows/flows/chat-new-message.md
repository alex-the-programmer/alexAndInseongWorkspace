# Flow: chat-new-message

**Priority:** P0  
**Auth:** signed-in  
**Preconditions:** Authenticated session; backend running with GraphQL reachable.

## Cases

### chat-new-message-01: Send user message

- **Steps:**
  1. Open `/chat` or existing `/chat/:id`
  2. Type a short message in composer (e.g. `What cleanser do you recommend?`)
  3. Click **Send message**
- **Assertions:**
  - User message bubble appears in thread with submitted text
  - Composer clears or is ready for next input
- **Notes:** Does not assert assistant reply content (see `chat-agent-response`).

### chat-new-message-02: New chat creates thread

- **Steps:**
  1. From `/chat/:id`, click **New chat**
- **Assertions:**
  - URL updates to a new `/chat/:id`
  - Empty or fresh thread state (no prior messages from previous chat)
