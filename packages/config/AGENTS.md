# packages/config/AGENTS.md

## Scope

Shared runtime configuration: env parsing, feature flags, per-service defaults.

## Rules

- Env vars validated with Zod at startup. Fail loudly on missing required values.
- No config value baked at build time — everything read at boot.
- No secret defaulting — production requires explicit values.
- Feature flags are typed. No string-keyed lookups.
