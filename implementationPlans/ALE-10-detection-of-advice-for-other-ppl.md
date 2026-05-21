# ALE-10 — Detection of Advice for Other People

## Context

When a user asks for skincare advice on behalf of someone else (e.g. "my friend Sarah has oily skin, what should she use?"), the app currently treats the message like any first-person request, which causes two problems:

1. Facts about a third person get extracted and stored in the logged-in user's memory, polluting their profile.
2. The agent gives advice for someone who isn't using the app, which is a weaker experience than if that person asked themselves.

This ticket introduces:
- Detection of "advice for other person" intent
- A new `UserEvent` system (starting with the `ADVICE_FOR_OTHER_USER` type) for tracking session-level signals
- Memory protection: skip fact extraction when advising for another person
- Agent pivot: redirect the user to share the app link and bring the conversation back to themselves
- A share prompt UI in the frontend

---

## Database Changes

**Requires architect approval before applying.**

### New enum: `UserEventType`
```prisma
enum UserEventType {
  ADVICE_FOR_OTHER_USER
}
```

### New model: `UserEvent`
```prisma
model UserEvent {
  id        BigInt        @id @default(autoincrement())
  userId    BigInt
  chatId    BigInt?
  eventType UserEventType
  metadata  Json?
  createdAt DateTime      @default(now())

  user User @relation(fields: [userId], references: [id])
  chat Chat? @relation(fields: [chatId], references: [id])

  @@index([userId, eventType])
  @@index([chatId])
}
```

### Relations to add
- `User` model: add `userEvents UserEvent[]`
- `Chat` model: add `userEvents UserEvent[]`

**Migration command:** `npx prisma migrate dev --name "add-user-events"`

---

## Implementation Steps

### 1. Prisma schema + migration
File: `commerce-platform-backend/prisma/schema.prisma`

Add enum, model, and relations as described above. Run migration.

---

### 2. New interaction: `createUserEvent`
File: `commerce-platform-backend/src/interactions/userEvents/createUserEvent.ts`

Simple Prisma write — creates a `UserEvent` row. Signature:
```ts
createUserEvent({
  userId: bigint,
  chatId?: bigint,
  eventType: UserEventType,
  metadata?: Record<string, unknown>,
}): Promise<void>
```

---

### 3. New interaction: `detectAdviceForOtherUser`
File: `commerce-platform-backend/src/interactions/chat/detectAdviceForOtherUser.ts`

Makes a single fast LLM call (gpt-4o-mini, `max_tokens: 10`, JSON mode or boolean structured output) to classify whether the user message is asking for advice on behalf of another person.

- Returns `{ detected: boolean }`
- Skip detection if `openingOnly` (the fixed opening system turn is never "advice for other person")
- Examples that should fire: "my friend has acne", "asking for my sister", "she has dry skin", "for my mom", "on behalf of a friend"
- Examples that should NOT fire: "I have acne", "my skin is dry", "do you have something for me"

Prompt pattern (short + decisive):
```
Classify whether the following message is asking for skincare advice on behalf of someone else (a friend, family member, or any third party), rather than for the message author themselves.

Reply with valid JSON: {"detected": true} or {"detected": false}.

User message:
<message>
```

Log the result as `[ShoppingAgent] advice-for-other detection`.

---

### 4. Modify `invokeShoppingAgent.ts`
File: `commerce-platform-backend/src/interactions/chat/invokeShoppingAgent.ts`

**Add to `InvokeShoppingAgentResult` type:**
```ts
adviceForOtherUser: boolean;
```

**Before the `agent.generate()` call:**
1. Call `detectAdviceForOtherUser(userMessage)` (skip if `openingOnly`)
2. If `detected`:
   - Call `createUserEvent({ userId: internalUserId, chatId, eventType: "ADVICE_FOR_OTHER_USER" })`
   - Append an extra system instruction to `systemWithTurn`:
     ```
     IMPORTANT: The user appears to be asking for advice on behalf of someone else (friend, family member, etc.).
     Do NOT give skincare recommendations for that other person.
     Instead:
     1. Warmly acknowledge they're looking out for someone they care about.
     2. Explain that for the best personalized experience, that person should use the app themselves — it only takes a minute and their results will be tailored to their own skin.
     3. Gently pivot the conversation back to the current user: ask a discovery question about their own skin.
     Keep the tone warm, not scolding.
     ```

**After the agent returns, in the memory sync block:**
- If `detected`, skip `extractFactsFromChatTurn` + `upsertMemoryFacts` + `refreshUserMemorySnapshot`. Log `[ShoppingAgent] memory sync skipped — advice for other user`.

**Return:**
```ts
return {
  text,
  productCards,
  comparison,
  ctaButtons: ...,
  adviceForOtherUser: detected,
  ...assistantMeta,
};
```

---

### 5. Update shoppingAgent instructions
File: `commerce-platform-backend/src/agents/shoppingAgent.ts`

Add a paragraph to the agent's `instructions` string as a fallback (the injected system context in step 4 is the primary signal, but this trains the base behavior):

```
When a user asks for advice on behalf of another person (friend, mom, partner, etc.), do not recommend products for that person. Instead, acknowledge their care for that person, explain that the app works best when the person uses it directly themselves for tailored recommendations, and redirect the conversation back to the user's own skin.
```

---

### 6. Propagate flag through `sendShoppingMessage`
File: `commerce-platform-backend/src/interactions/chat/sendShoppingMessage.ts`

Update `ShoppingAssistantMessageResult` to include `adviceForOtherUser: boolean`.

Pass the value through from `invokeShoppingAgent` result to the return value.

---

### 7. GraphQL schema changes
File: `commerce-platform-backend/src/graphql/publicSchema.graphql`

Add field to `ShoppingAssistantMessage`:
```graphql
type ShoppingAssistantMessage {
  id: String!
  content: String!
  role: ShoppingChatMessageRole!
  createdAt: DateTime!
  productCards: [ShoppingProductCard!]!
  comparison: ShoppingProductComparison
  ctaButtons: [ChatMessageCta!]!
  adviceForOtherUser: Boolean!   # <-- new
}
```

Run `npm run codegen` in the backend.

---

### 8. Update GraphQL resolver
File: `commerce-platform-backend/src/graphql/publicResolvers.ts`

In the `sendShoppingMessage` resolver, map `adviceForOtherUser` from the interaction result to the returned object.

---

### 9. Frontend: update GraphQL operation
File: `commerce-platform-frontend/graphql/shopOperations.graphql`

Add `adviceForOtherUser` to the `SendShoppingMessage` mutation response fields.

Run `npm run codegen` in the frontend to regenerate types.

---

### 10. Frontend: share card UI
File: `commerce-platform-frontend/components/chatMessageList.tsx`

When a message has `adviceForOtherUser: true`, render a share nudge card below the message content (before product cards):

- Copy-to-clipboard button
- Copies: `"Check out this K-beauty skincare advisor — it gives personalized recommendations based on your skin! Try it at: " + window.location.origin + "/shop"`
- Label: "Copy link to share" with a small clipboard icon
- After clicking: show a "Copied!" confirmation for ~2 seconds

This is a purely additive UI element; no routing changes needed.

---

## Files to Modify / Create

### Backend (`commerce-platform-backend/`)
| Action | Path |
|--------|------|
| Modify | `prisma/schema.prisma` |
| Create | `src/interactions/userEvents/createUserEvent.ts` |
| Create | `src/interactions/chat/detectAdviceForOtherUser.ts` |
| Modify | `src/interactions/chat/invokeShoppingAgent.ts` |
| Modify | `src/interactions/chat/sendShoppingMessage.ts` |
| Modify | `src/agents/shoppingAgent.ts` |
| Modify | `src/graphql/publicSchema.graphql` |
| Modify | `src/graphql/publicResolvers.ts` |

### Frontend (`commerce-platform-frontend/`)
| Action | Path |
|--------|------|
| Modify | `graphql/shopOperations.graphql` |
| Modify | `components/chatMessageList.tsx` |

---

## Verification

1. **Interaction tests:**
   - `src/__tests__/interactions/userEvents/createUserEvent.test.ts` — assert row is written with correct `eventType`, `userId`, `chatId`
   - `src/__tests__/interactions/chat/detectAdviceForOtherUser.test.ts` — mock the LLM; assert `detected: true` for "my friend has acne", `detected: false` for "I have acne"

2. **GraphQL resolver tests:**
   - Update or add a test in `src/__tests__/graphql/` for `sendShoppingMessage` that mocks `invokeShoppingAgent` returning `adviceForOtherUser: true` and asserts the field appears in the response

3. **Run test suite:** `npm test` — all existing tests must still pass

4. **Manual end-to-end:**
   - Start both backend + frontend dev servers
   - Open a chat, type "My friend has oily skin, what should she use?"
   - Confirm: agent response pivots to suggesting the friend use the app directly
   - Confirm: share nudge card appears with a copy button
   - Confirm: clicking copy puts the right URL + text in clipboard
   - Confirm: `UserEvent` row is written in DB with `ADVICE_FOR_OTHER_USER`
   - Confirm: NO new `UserMemoryFact` rows written for that turn (check DB directly or logs)
   - Follow-up with a first-person message, confirm memory extraction resumes normally

---

## TODO

- [ ] Prisma schema: add `UserEventType` enum, `UserEvent` model, relations to `User` + `Chat`
- [ ] Run migration: `add-user-events`
- [ ] Create `src/interactions/userEvents/createUserEvent.ts`
- [ ] Create `src/interactions/chat/detectAdviceForOtherUser.ts`
- [ ] Modify `invokeShoppingAgent.ts`: detection, event creation, memory skip, return flag
- [ ] Modify `sendShoppingMessage.ts`: propagate `adviceForOtherUser`
- [ ] Modify `src/agents/shoppingAgent.ts`: add fallback instruction
- [ ] Modify `publicSchema.graphql`: add `adviceForOtherUser` field
- [ ] Run `npm run codegen` in backend
- [ ] Modify `publicResolvers.ts`: map new field
- [ ] Modify frontend `shopOperations.graphql`: add field to mutation
- [ ] Run `npm run codegen` in frontend
- [ ] Modify `chatMessageList.tsx`: add share nudge card
- [ ] Write interaction tests for `createUserEvent` + `detectAdviceForOtherUser`
- [ ] Write/update GraphQL resolver test for `adviceForOtherUser` field
- [ ] Run `npm test`, confirm all pass
- [ ] Manual end-to-end test
