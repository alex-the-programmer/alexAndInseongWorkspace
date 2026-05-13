# Development Workflow

## Commits
- All commit messages must start with the Linear ticket name, e.g. `ALE-123 add prospect status to prospects page`.
- Extract the ticket from the branch name — branch names always start with the Linear ticket.
- Do not commit automatically — leave committing to the developer.

## Branches
- All repos in this workspace use `main` as their primary branch.
- Create new feature branches off the latest `main`.
- When a change touches multiple repos, create matching branches in each affected repo.

## Pull requests
- Create PRs against `main` for all repos in this workspace.
- When asked to create a PR, do it for every repo that has changes.
