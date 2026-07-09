---
name: start-task
category: procedure
description: Create a task-scoped git worktree + branch following AGENTS.md conventions. Handles branch naming, worktree location, hook install, initial env setup. Use when starting any non-trivial task, especially when running multiple AI agents in parallel.
appliesTo:
  concerns: [ci-cd, configuration]
autoAttach: manual
combinesWith: [keep-docs-current, finish-task]
conflictsWith: []
---

## Attach when
- Starting a new task that will produce a PR.
- Spinning up a parallel agent while another task is in flight.
- User says "start a branch", "new worktree", "let's begin task X".

## Load in addition
- Root `AGENTS.md` § Branch and merge workflow (the naming + worktree location contract).

## Do (max 10 steps)

1. **Classify the type.** Pick ONE from the locked vocabulary:
   - `feature/` new capability
   - `fix/` bug fix
   - `refactor/` restructure w/o behavior change
   - `chore/` tooling, deps, config, meta
   - `docs/` docs-only
   - `spec/` new spec / ADR / product doc
   - `experiment/` throwaway (auto-delete after 7 days)

2. **Derive the slug.** Kebab-case, ≤ 40 chars, no ticket IDs. Describe the change, not the effort.
   - Good: `registry-cards`, `facility-detail-tabs`, `ai-context-routing`
   - Bad: `misc-improvements`, `wip`, `PROJ-1234`

3. **Compose the branch name:** `<type>/<slug>-YYYYMMDD` (today's date at creation time).

4. **Sync main first.**
   ```bash
   cd /Users/josepaulolaport/Documents/projects/atlasmed   # or wherever the main repo lives
   git checkout main
   git pull origin main
   ```

5. **Create the worktree.** Sibling of the main repo:
   ```bash
   git worktree add ../atlasmed-worktrees/<slug> -b <type>/<slug>-YYYYMMDD
   cd ../atlasmed-worktrees/<slug>
   ```
   Never nest worktrees inside the main repo.

6. **Install hooks in the worktree.** Each worktree has its own hook path.
   ```bash
   ./scripts/install-git-hooks.sh
   ```

7. **Install workspace deps.** From the worktree root:
   ```bash
   bun install
   ```
   Bun symlinks per-workspace `node_modules` — the install is fast; do not skip.

8. **Point AI at the worktree.** All subsequent edits, greps, and reads for this task run from the worktree path, not from the main repo. If using Claude Code sessions in parallel, each session should `cd` into its own worktree at start.

9. **Announce.** Output:
   ```
   Worktree: ../atlasmed-worktrees/<slug>
   Branch:   <type>/<slug>-YYYYMMDD
   ```
   User can then invoke the task itself with the correct working directory.

10. **First commit.** For any task with ≥1 file change, commit an initial `chore: scaffold` or a real first commit immediately. Empty branches age quickly and get force-deleted by the weekly cleanup.

## Rules (non-negotiable)

- Branch name MUST match `^(feature|fix|refactor|chore|docs|spec|experiment)/[a-z0-9][a-z0-9-]{0,39}-[0-9]{8}$`. The pre-commit hook rejects otherwise.
- Worktrees live at `../atlasmed-worktrees/<slug>`. Never inside the main repo.
- Install hooks in every new worktree — hooks are per worktree, not per repo.
- Do not skip `bun install` — workspace resolution fails silently otherwise.
- Never start a task by branching off another feature branch. Always off `origin/main`.

## Docs to update after

- N/A — this skill is orchestration only.
