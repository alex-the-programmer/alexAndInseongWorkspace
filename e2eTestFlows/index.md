# E2E test flows — index

Catalog for **ALE-82** Playwright tests. Implementation plan: [`implementationPlans/ALE-82-introduce-playwright-e2e-frontend.md`](../implementationPlans/ALE-82-introduce-playwright-e2e-frontend.md)  
Pages graph: [`pages-graph.md`](pages-graph.md)  
Setup: [`SETUP.md`](SETUP.md)

## Priority summary

| Priority | Flow | File | Cases |
|----------|------|------|-------|
| **P0** | Email/password sign-in | [`auth-sign-in.md`](flows/auth-sign-in.md) | 3 |
| **P0** | Sign out | [`auth-sign-out.md`](flows/auth-sign-out.md) | 1 |
| **P0** | Floating nav Chat ↔ Routine | [`nav-floating-pill.md`](flows/nav-floating-pill.md) | 3 |
| **P0** | Send chat message | [`chat-new-message.md`](flows/chat-new-message.md) | 2 |
| **P0** | Routine page loads | [`routine-view.md`](flows/routine-view.md) | 3 |
| **P1** | Landing (signed out) | [`landing-signed-out.md`](flows/landing-signed-out.md) | 3 |
| **P1** | Landing redirect (signed in) | [`landing-signed-in-redirect.md`](flows/landing-signed-in-redirect.md) | 1 |
| **P1** | Agent turn completes | [`chat-agent-response.md`](flows/chat-agent-response.md) | 3 |
| **P1** | Advice for other user | [`chat-advice-for-other.md`](flows/chat-advice-for-other.md) | 1 |
| **P1** | Product delivery (no deferral) | [`chat-product-delivery.md`](flows/chat-product-delivery.md) | 1 |
| **P1** | Known profile / quiz | [`chat-known-profile.md`](flows/chat-known-profile.md) | 1 |
| **P1** | Opening quiz nudge | [`chat-opening-nudge.md`](flows/chat-opening-nudge.md) | 1 |
| **P1** | Chat thread CRUD | [`chat-thread-management.md`](flows/chat-thread-management.md) | 4 |
| **P1** | Add/remove routine product | [`routine-add-product.md`](flows/routine-add-product.md) | 2 |
| **P1** | Skin quiz (initial + retake) | [`skin-quiz-complete.md`](flows/skin-quiz-complete.md) | 4 |
| **P1** | Routine setup (initial + repeat) | [`routine-setup.md`](flows/routine-setup.md) | 3 |
| **P2** | Product cards in chat | [`chat-product-cards.md`](flows/chat-product-cards.md) | 4 |
| **P2** | Local retailer card audit | [`dev-retailer-audit.md`](flows/dev-retailer-audit.md) | 2 |

**Phase 3 implement order:** all P0 → P1 → P2.

## Agent assertion policy

Playwright asserts **UI structure** (bubbles, cards, loading settled), not exact LLM wording.

**LLM / agent cases** also log `[agent-response-review]` JSON per turn (`playwright/helpers/agentResponseReview.ts`). After a run, grep that marker and compare `verdict` + `heuristics` to the flow case notes. Long-term quality evals → **Langfuse** (future).

## Playwright selectors reference

See discovery notes in implementation plan Phase 1 and `pages-graph.md`. Prefer `getByRole` with labels from the flow steps.
