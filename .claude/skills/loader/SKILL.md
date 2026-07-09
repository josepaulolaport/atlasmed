---
name: loader
category: cross-cutting
description: Bridge that points Claude Code at the tool-neutral skills directory at repo root. All AtlasMed skills live in /skills/, not here. Load skills/README.md first, then follow the Task lifecycle in AGENTS.md.
---

# AtlasMed skills loader

The canonical skills directory is `skills/` at the repo root. All skills — domain, procedure, principle, cross-cutting, fullstack — live there. This stub exists only so Claude Code's built-in skills discovery finds an entrypoint.

## What to do when this "skill" fires

1. Open `AGENTS.md` at repo root.
2. Follow § Task lifecycle steps 1–6.
3. Read `skills/CONCERNS.md` to know the concerns vocabulary.
4. Read `skills/README.md` to see the full skill catalog.
5. Select and load skills from `skills/<category>/<name>/SKILL.md` per the rules there.

## Why the redirection

`skills/` at repo root is tool-neutral — Cursor, Cline, Codex, and any other agent can find it. `.claude/skills/loader/` is a Claude-Code-specific shim so Claude's native skill discovery doesn't miss the actual catalog.

Do not put real skill content in `.claude/skills/`. It lives in `skills/`.
