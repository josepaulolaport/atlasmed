---
name: keep-docs-current
category: cross-cutting
description: After any code change, update matching AGENTS.md and docs/ files. Every skill declares "Docs to update after" — this skill enforces that step runs.
appliesTo:
  concerns: [docs]
autoAttach: on-any-code-change
combinesWith: []
conflictsWith: []
---

## Attach when
- Any code change touches source files (`apps/**`, `packages/**`).
- Any change alters a public convention, contract, or pattern.

## Do
1. Collect the "Docs to update after" sections from every skill that ran this task.
2. For each named file, decide: does the change alter the current text?
3. If yes, edit the doc in the same PR as the code.
4. If no, skip it — do not touch docs cosmetically.
5. If the change introduced a new concept not covered by any listed doc, add a note to root `AGENTS.md` or the nearest AGENTS.md and open a follow-up for a fuller doc.

## Rules
- Docs update is part of the PR, not a follow-up.
- Do not paste code snippets that will rot — link file paths instead.
- Do not duplicate content across AGENTS.md files — reference upward.
- If tests or types express the same rule the doc would, prefer code over prose.

## Docs to update after
- N/A — this skill IS the update step.
