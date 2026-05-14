# Development Workflow

## Commits
- All commit messages must start with the Linear ticket name, e.g. `ALE-123 add prospect status to prospects page`.
- Extract the ticket from the branch name — branch names always start with the Linear ticket.

## Branches
- All repos in this workspace use `main` as their primary branch.
- Create new feature branches off the latest `main`.
- When a change touches multiple repos, create matching branches in each affected repo.

## Pull requests
- Create PRs against `main` for all repos in this workspace. 
- Always create the PRs at the end of our initial implementation after you're done writing and running unit tests. 
- When creating a PR, do it for every repo that has changes.
- After you create a PR, report the link to it back to the chat so that I can open it. 
