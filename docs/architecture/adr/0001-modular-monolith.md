# ADR 0001: Continue With a Modular Monolith

## Status

Accepted

## Context

Atlasmed already uses a monorepo with a Bun/Elysia backend and clear module directories for access, clinic, doctor, and registry ingestion. The product needs more domains, but the current team benefits from simpler deployment and shared TypeScript boundaries.

## Decision

Continue with a modular monolith. Enforce domain boundaries through module structure, application use-cases, repository interfaces, explicit composition, and domain events for cross-domain side effects.

## Consequences

- Avoid microservices until operational or organizational pressure justifies them.
- Keep domain access explicit instead of reaching across modules directly.
- Use tests and documentation to protect boundaries.
