# Development Workflow

## Commits
- All commit messages must start with the Linear ticket name, e.g. `ALE-123 add prospect status to prospects page`.
- Extract the ticket from the branch name — branch names always start with the Linear ticket.

## Branches
- All repos in this workspace use `main` as their primary branch.
- Create new feature branches off the latest `main`.
- When a change touches multiple repos, create matching branches in each affected repo.

## Pre-push validation
- Before committing or pushing, run the repo's checks and fix all failures. Do not push broken code.
- **Backends** (`commerce-platform-backend`, `conquistador`, `car-finding-concierge`): `npm run lint` then `npm run build`. Run `npm test` when behavior changed.
- **Frontends**: `npm run lint`, `npm run build`, and tests when applicable.
- If a repo has no `lint` script, use `npm run build` (which must include typechecking).

## Pull requests
- Create PRs against `main` for all repos in this workspace. 
- Always create the PRs at the end of our initial implementation after you're done writing and running unit tests. 
- When creating a PR, do it for every repo that has changes.
- After you create a PR, report the link to it back to the chat so that I can open it. 
