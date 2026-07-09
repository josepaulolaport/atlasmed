@AGENTS.md

## Claude-specific instruction

Use `AGENTS.md` at repo root as the source of truth.

When working inside a subdirectory, ALSO read the nearest nested `AGENTS.md` before editing. Claude Code auto-loads `CLAUDE.md` at every level up the tree, and each of ours simply imports the matching `AGENTS.md`.

Do not duplicate project context here. If a rule belongs to the whole project, it lives in `AGENTS.md`. If it belongs to one area, it lives in that area's `AGENTS.md`.

Skills live under `skills/` at repo root. See `.claude/skills/loader/SKILL.md` for the bridge that lets Claude Code discover them.
