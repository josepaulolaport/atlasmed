# packages/observability/AGENTS.md

## Scope

Structured logging, distributed tracing, metrics helpers used across `apps/api`, `apps/workers`, and shared packages.

## Rules

- Log structured JSON — never freeform strings for production paths.
- Never log secrets, tokens, or password hashes.
- Trace names describe the operation, not the caller.
- Metrics live in a bounded cardinality set — never include user IDs or request IDs as label values.
- Errors flow through a single reporter with severity + fingerprint.

## Anti-patterns

- Do not `console.log` in service code — use the logger.
- Do not bypass tracing to "make it faster" — profile first.
