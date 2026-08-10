# AtlasMed Linear PM Task Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repository-local skill that ensures AtlasMed PR work is represented by a Portuguese, PM-oriented Linear task assigned to the current user.

**Architecture:** A single local `SKILL.md` at `.mux/skills/` provides the trigger conditions, mandatory Linear workflow, copy rules, and pressure scenarios. It treats PR opening and merge completion as explicit workflow gates: the former creates/links and moves a task to In Review; the latter moves the linked task to Done.

**Tech Stack:** Agent Skills Markdown/YAML; Linear MCP tools.

---

### Task 1: Create and validate the AtlasMed Linear task skill

**Files:**
- Create: `.mux/skills/managing-atlasmed-linear-tasks/SKILL.md`
- Create: `docs/superpowers/plans/2026-08-10-atlasmed-linear-pm-task-skill.md`

- [ ] **Step 1: Establish the baseline pressure scenario**

Dispatch a read-only agent without the new skill using this prompt:

```text
User asks: "Open a PR for the completed AtlasMed change." No Linear issue was mentioned.
Describe the next action you would take.
```

Expected baseline failure: it opens the PR without first asking whether to create, link, or intentionally skip a Linear task.

- [ ] **Step 2: Write the local skill**

Create `.mux/skills/managing-atlasmed-linear-tasks/SKILL.md` with frontmatter that triggers on requests to create/open/publish PRs and merge/finish PRs in AtlasMed. Require the skill to:

```text
- ask create/link/skip before opening a PR when no task is known;
- use Portuguese, outcome-oriented PM copy with problem, impact, scope, and acceptance criteria;
- omit implementation details such as file paths, algorithms, commands, classes, and test internals;
- resolve assignee as `me`, use the Atlasmed Engineering team, attach/link the PR, and set In Review;
- preserve an existing task's description and assignee unless asked to change them;
- move the known linked task to Done only after merge is confirmed or requested;
- ask for the task identifier when a merge has no known linked task.
```

Include concise pressure scenarios for opening a PR with no task, linking an existing task, and confirming a merge.

- [ ] **Step 3: Verify discovery and workflow compliance**

Use `agent_skill_list` to confirm the new local skill appears. Then dispatch a read-only agent with this scenario:

```text
User asks: "Open a PR for the completed AtlasMed change." No Linear issue was mentioned.
Describe the required next action.
```

Expected: it asks whether to create a task, link/move an existing task, or explicitly proceed without one; it does not open the PR first.

- [ ] **Step 4: Self-review and commit**

Confirm the skill contains Portuguese PM-copy rules, mandatory `me` assignment, PR link handling, In Review transition, Done-after-merge transition, and no automatic status guess for an unknown task. Commit both files:

```bash
git add .mux/skills/managing-atlasmed-linear-tasks/SKILL.md \
  docs/superpowers/plans/2026-08-10-atlasmed-linear-pm-task-skill.md
git commit -m "chore: add AtlasMed Linear task skill"
```
