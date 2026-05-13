# PR Review Workflow

When a developer shares a PR link and asks to "work through the comments", "review the PR comments", or similar, follow this exact two-phase process. It keeps analysis and implementation cleanly separated so the developer can steer each fix before any code changes.

## Phase 1 — Analysis and recommendations
- Always do analysis before any code changes. Do not modify files in Phase 1.
- Fetch PR metadata and all review comments via the `gh` CLI:
  - `gh pr view <N> --repo <owner>/<repo> --json number,title,headRefName,baseRefName,body,author`
  - `gh api repos/<owner>/<repo>/pulls/<N>/comments --paginate --jq '[.[] | {id, user: .user.login, path, line, original_line, in_reply_to_id, body}]'` for line-anchored review comments
  - `gh api repos/<owner>/<repo>/issues/<N>/comments --paginate --jq '[.[] | {id, user: .user.login, body}]'` for PR-level comments
- Check out the PR branch locally in the relevant repo so you can read the actual files on that branch. Each repo in the workspace is a separate git repo — `cd` into the right one.
- Identify the current developer once at the start via `gh api user --jq '.login'` and treat their replies as authoritative for this workflow.
- Classify each comment before analyzing:
  - Skip threads where the PR author has already replied with `addressed`, `resolved`, a screenshot showing the fix, or similar acknowledgement.
  - Detect duplicates. Bots (e.g. `cursor[bot]`) often re-raise the same concern as a human reviewer. Treat these as one underlying issue — one analysis, but still post a short pointer reply on each duplicate thread.
- For each remaining unresolved comment, produce a focused analysis. **Every analysis must contain all three labeled fields in this order — do not skip or merge them:**
  - **Issue**: Whether the issue is real and what its concrete impact is in the current code. Quote relevant lines when it helps.
  - **Origin**: Explicitly labeled as either **Pre-existing** (present on `main` before this PR) or **Introduced by this PR**. Determine this with `git log --oneline origin/main..HEAD -- <file>` plus `git blame` on the exact lines. If a fix would require changing code the PR didn't touch, it's pre-existing. When genuinely ambiguous (e.g. a refactor that moved code), say "Pre-existing, surfaced by this PR" and explain.
  - **Recommendation**: One of **Fix** (worth doing in this PR), **Optional** (nice-to-have, safe to skip), **Don't fix** (out of scope / intentional / would introduce a different bug), or **Fix short-term here, separate ticket for proper fix** (for architectural concerns that can't be fully resolved in this PR). If recommending not to fix, say exactly why.
- Post the analysis as a reply to the exact thread. Use a JSON payload file to avoid shell-escaping issues with code snippets:
```bash
cat <<'EOF' > /tmp/reply.json
{"body":"**Analysis**\n\n<issue description>\n\n**Origin**: Pre-existing | Introduced by this PR | Pre-existing, surfaced by this PR\n\n**Recommendation**: Fix | Optional | Don't fix | Short-term fix here, separate ticket — <one-line rationale>"}
EOF
gh api --method POST repos/<owner>/<repo>/pulls/<N>/comments/<comment_id>/replies --input /tmp/reply.json --jq '.html_url'
```
- After posting all analyses, stop and present a summary table to the developer with columns: Thread, Reviewer, Origin, Recommendation. Do not start applying fixes until the developer explicitly says what to fix.

## Phase 2 — Applying fixes
- Re-fetch the PR author's replies to pick up their decisions:
  - `gh api repos/<owner>/<repo>/pulls/<N>/comments --paginate --jq '[.[] | select(.user.login == "<author-login>") | {id, in_reply_to_id, path, line, body}]'`
- Interpret reply conventions:
  - "let's fix" / "fix" → apply the fix as analyzed.
  - "apply if safe" → apply only if genuinely low-risk; flag back before applying if there's nontrivial risk.
  - "let's do the short-term fix" → apply the narrower/tactical fix, leave the strategic fix for a follow-up ticket.
  - "this is intentional" / "let's skip" / "let's not fix here" → do not apply; move on.
  - Anything else (questions, pushback) → answer in the thread before touching code.
- Build a consolidated TODO list based on code changes, not threads — multiple threads often collapse into one edit.
- Apply fixes respecting the usual repo rules (layered architecture, no redundant `any` casts, etc.).
- Write or update unit tests for every fix with meaningful behavior. Skip tests only for purely cosmetic changes.
- Run tests for the specific files you touched, not the whole suite. Before dismissing a failing test as pre-existing, verify with `git stash && npx jest <path> && git stash pop`.
- After each fix, post a short reply on the corresponding thread describing what you actually did (exact files, shape of the change, any new tests). For duplicate threads, post a shorter "same fix covers this thread too" reply on the secondary thread(s). Use the same HEREDOC + JSON pattern from Phase 1.
- Never commit or push — leave that to the developer.
- End with a concise summary: files changed, new/updated tests, verification evidence, and anything skipped per the developer's direction.

## General conventions
- Treat `cursor[bot]` comments as lower priority than human reviewers unless the bot catches something a human didn't. Bot comments already marked "addressed" by the PR author are closed — skip them.
- Never dismiss a comment just because it is pre-existing. Always label Origin explicitly and let the developer decide whether to fix it in this PR.
- When a comment points at behavior requiring a cross-repo change, say so explicitly and propose a short-term in-repo mitigation plus a follow-up ticket for the proper fix.
- Don't fix lint/style warnings that existed before the PR unless the developer asks. Do fix any lint warnings you introduce.
