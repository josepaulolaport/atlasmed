---
name: managing-atlasmed-linear-tasks
description: Use when working in AtlasMed and the user asks to create, open, publish, prepare, merge, or finish a pull request, or to create, link, move, or describe a Linear task for delivery work.
---

# Managing AtlasMed Linear Tasks

## Purpose

Keep every AtlasMed PR connected to a PM-readable Linear task. The task describes the customer or business outcome—not implementation—and is assigned to the current user.

## Before Opening a PR — Mandatory Gate

When the user asks to create, open, publish, send, or prepare a PR:

1. Look for a known Linear task in the conversation, branch, commits, or PR context.
2. If none is known, **ask before opening the PR**:

   > Antes de abrir o PR, você quer: **(1)** criar uma tarefa no Linear, **(2)** vincular/mover uma tarefa existente, ou **(3)** seguir sem tarefa?

   Do not open the PR until the user chooses.
3. If the user chooses an existing task, resolve its identifier, add the PR as a Linear link, and move it to **In Review**.
4. If the user chooses a new task, create it following the rules below, add the PR as a link, and set it to **In Review**.
5. If the user explicitly chooses no task, open the PR without creating or moving a Linear task.

## Creating the Task

Use Linear MCP. Resolve the assignee with `linear_get_user("me")`; create the issue in **Atlasmed Engineering** with `assignee: "me"`.

Write the title and description in Brazilian Portuguese for a product manager:

- State the user, business, operational, quality, or delivery outcome.
- Include only: **Contexto**, **Objetivo/Escopo**, **Impacto esperado**, and **Critérios de aceite** when applicable.
- Describe what changes for users or the team and how success is observable.
- Be concise and use plain language.

Never include implementation-only detail unless the user explicitly requests it: file paths, class/function names, algorithm choices, infrastructure/tooling internals, shell commands, test counts, or debugging chronology.

Use the relevant Linear status by name. If a status is unavailable, list the team statuses and ask the user rather than guessing.

## Existing Tasks

For an existing task:

- Preserve its title, description, assignee, priority, and labels unless the user explicitly asks to change them.
- Add the PR link without removing existing links.
- Move it to **In Review** when its PR is opened.

## After Merge — Mandatory Completion

When the user asks to merge/finish a PR, or confirms it was merged:

1. Confirm the PR was merged if that fact is not supplied by trusted tool output.
2. Find the linked Linear task.
3. Move that task to **Done**.
4. If no linked task is known, ask for its Linear identifier; do not guess or create a new task after merge.

## Pressure Scenarios

| Situation | Required action |
| --- | --- |
| “Abra o PR” with no task in context | Ask create / link-existing / skip before opening PR. |
| “Use ATLAS-123 e abra o PR” | Link the PR to ATLAS-123 and move it to In Review; preserve its existing content and assignee. |
| “O PR foi mergeado” with known task | Move the linked task to Done. |
| “O PR foi mergeado” without known task | Ask for the Linear task identifier. |

## Checklist

Before PR: task choice confirmed → Portuguese PM copy if creating → assigned to `me` → PR linked → In Review.

After merge: merge confirmed → linked task identified → Done.
