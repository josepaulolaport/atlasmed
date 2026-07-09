---
name: finish-task
category: procedure
description: Ship a task-scoped worktree branch. Squash-merge PR, delete branch (local + remote), prune worktree, run weekly cleanup. Use when the task is done and reviewed.
appliesTo:
  concerns: [ci-cd, deployment]
autoAttach: manual
combinesWith: [start-task, keep-docs-current]
conflictsWith: []
---

## Attach when
- Task work is complete, reviewed, and ready to merge.
- User says "finish", "ship it", "merge and clean up".

## Load in addition
- Root `AGENTS.md` § Branch and merge workflow.

## Do (max 10 steps)

1. **From inside the worktree**, confirm the tree is clean and the branch is up to date:
   ```bash
   git status                                    # must be clean
   git fetch origin main
   git log origin/main..HEAD --oneline           # confirm your commits are present
   ```

2. **Rebase or merge main if drifted.** Prefer rebase for a clean history:
   ```bash
   git rebase origin/main
   ```
   Resolve conflicts. Re-run typecheck / build after rebase.

3. **Push the branch** (if not already):
   ```bash
   git push -u origin <branch>
   ```
   The pre-push hook blocks direct pushes to `main`.

4. **Open the PR** via `gh`:
   ```bash
   gh pr create --title "<Title matching branch intent>" --body "$(cat <<'BODY'
   ## Summary
   - <bullet 1>
   - <bullet 2>

   ## Test plan
   - [ ] Typecheck
   - [ ] Build
   - [ ] Manual smoke of feature X

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   BODY
   )"
   ```

5. **Wait for CI to go green** and reviewer approval. Do not squash-merge on red CI.

6. **Squash-merge via GitHub UI or CLI:**
   ```bash
   gh pr merge --squash --delete-branch
   ```
   `--delete-branch` removes the remote branch. The default merge commit message summarizes the branch — verify it before confirming.

7. **Return to the main repo dir**, sync main:
   ```bash
   cd /Users/josepaulolaport/Documents/projects/atlasmed
   git checkout main
   git pull origin main
   ```

8. **Prune the worktree:**
   ```bash
   git worktree remove ../atlasmed-worktrees/<slug>
   git worktree prune
   ```
   If the worktree has uncommitted changes, `git worktree remove` refuses — investigate before forcing.

9. **Delete the local branch** (if it still exists):
   ```bash
   git branch -d <branch>                        # -d only, never -D unless intentional
   ```

10. **Weekly cleanup (run whenever ≥ 1 week since last):**
    ```bash
    git fetch --prune
    git worktree prune
    git branch --merged main | grep -v '^\* main$' | xargs -r git branch -d
    ```
    For `experiment/` branches older than 7 days: `git branch -D` regardless of merge status.

## Rules (non-negotiable)

- Squash-merge only. Never fast-forward or merge-commit into main.
- Delete branch on merge (local + remote). No exceptions.
- Never `git worktree remove --force` without first inspecting what would be lost.
- Never force-push to `main`. Pre-push hook blocks it — do not bypass with `--no-verify`.
- CI must be green before merge. Red CI + merge = ban.

## Docs to update after

- If new work exposed a gap in `docs/architecture/*` or an app AGENTS.md, update in the same PR (via `cross-cutting/keep-docs-current`). Do not defer.
