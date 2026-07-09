# CONCERNS.md

Canonical concerns vocabulary. All software-generic — no domain-specific concerns.

Skills declare `appliesTo.concerns: [...]` from this list. Typos or unregistered concerns will silently fail to attach. Adding a new concern requires editing this file first (open a PR).

## Presentation

| Concern | Attach when task involves |
|---|---|
| `styling` | CSS, Tailwind classes, palette, tokens |
| `layout` | Structure, spacing, grid/flex, responsive |
| `interaction` | Hover, click, focus, animation, transitions |
| `accessibility` | ARIA, keyboard nav, contrast, screen readers |

## Data / state

| Concern | Attach when task involves |
|---|---|
| `data-fetching` | API calls, cache revalidation, SWR/query patterns |
| `state-management` | React state, contexts, stores, reducers |
| `forms` | Form controls, validation, submission handlers |
| `serialization` | DTOs, mapping, contract shape, JSON schemas |
| `caching` | Memoization, Redis, CDN, invalidation |
| `real-time` | WebSocket, SSE, live updates |

## Business

| Concern | Attach when task involves |
|---|---|
| `authorization` | Permission checks, role gates, CASL rules |
| `business-logic` | Use-cases, domain rules, workflows |
| `domain-model` | Entities, schema shape, relationships |

## Infra

| Concern | Attach when task involves |
|---|---|
| `persistence` | DB writes, migrations, indexes, transactions |
| `messaging` | Queues, event buses, pub/sub |
| `configuration` | Env vars, feature flags, runtime config |
| `integration` | Third-party APIs, external services |
| `data-pipeline` | ETL, imports, batch or streaming ingestion |
| `background-jobs` | Temporal workflows, cron, deferred tasks |
| `notifications` | Email, SMS, push, in-app messaging |

## Cross-cutting

| Concern | Attach when task involves |
|---|---|
| `security` | Secrets, tokens, injection, XSS, CSRF |
| `performance` | Latency, memory, bundle size, N+1 queries |
| `observability` | Logs, traces, metrics |
| `audit` | Immutable compliance logs (distinct from observability) |
| `compliance` | Regulatory (LGPD, GDPR, HIPAA), data retention |
| `testing` | Unit, integration, e2e, fixtures |
| `docs` | AGENTS.md, docs/, README, comments |
| `error-handling` | Error paths, retries, fallbacks, boundaries |
| `api-contract` | Versioning, breaking changes, deprecation |
| `rate-limiting` | Throttling, abuse control |
| `dependency` | Adding/upgrading packages, security patches |
| `ci-cd` | Pipeline changes, build automation |
| `deployment` | Release, rollback, feature-flag rollout |

## Device / client

| Concern | Attach when task involves |
|---|---|
| `offline-first` | Offline-capable flows, conflict resolution |
| `device-sensors` | GPS, camera, accelerometer, mic |

## Meta

| Concern | Attach when task involves |
|---|---|
| `refactor` | Restructure without behavior change |

## Rules for skills

- `appliesTo.concerns` must use entries from this file. Skills using unregistered concerns silently fail to attach.
- A skill may declare `appliesTo.concerns: []` — then it never auto-attaches by concern; only by manual invoke or by procedure/domain match.
- Concerns describe WHAT the task deals with. Domain describes WHICH app. Do not smuggle domain into concerns.

## Adding a new concern

1. Confirm no existing concern covers the case.
2. Confirm the concern is generic (applies to more than one project).
3. Add row here with 1-liner "Attach when."
4. Update every skill that should now attach on it.
5. Open PR — reviewers check for overlap with existing concerns.
