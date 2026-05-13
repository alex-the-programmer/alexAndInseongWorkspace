# Implementation Plans

## Naming
- In plan mode, save the plan to `/implementationPlans/` with a name starting with the Linear ticket number, e.g. `ALE-123-add-prospect-status-to-prospects-page.md`.
- Extract the ticket from the branch name — e.g. branch `ALE-123-add-prospect-status-to-prospects-page` → ticket `ALE-123`. Branch names always start with the Linear ticket. Keep the `ALE-` portion capitalized.
- Plan filenames must be lowercased and hyphenated.
- Occasionally there are large summary plans that start with `Summary-` instead of a ticket number. Individual ticket plans are created off those later.

## Linear tickets
- We use Linear with the `ALE-` prefix (e.g. `ALE-123`).
- Do not create tickets unless explicitly asked.
- When creating tickets, leave the assignee blank unless asked to assign to a specific person.

## TODO list
- When building or updating a plan, maintain an up-to-date TODO list at the bottom of the plan file.
- During implementation, mark items off as you complete them.
- When you finish a TODO item, make sure you created or updated its unit tests and confirmed they pass.
- All database changes must be explicitly called out in implementation plans with exact table and column names — they require architect approval before being applied.
- All permission changes must be explicitly documented in the plan.

## Using plans during implementation
- When unsure why something is done a certain way:
  - Run `git blame` / `git annotate` on the file and see if the relevant line was last changed in a commit whose message starts with a Linear ticket name.
  - Check `/implementationPlans/` for a plan whose filename starts with that same ticket name.
- When asked to review a PR, compare the implementation against the corresponding implementation plan.
