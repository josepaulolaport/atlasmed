# AtlasMed documentation

Source of truth for architecture, feature and spec-driven development documentation.

Root `AGENTS.md` is the canonical AI instruction file **and the only router** — each of its
domain guides carries its own "Required docs" table. Read it before anything here.

## Index

- `specs/` — the authoritative requirements. Specs **0009–0014** carry the current model:
  | Spec | Covers |
  |---|---|
  | `0007-nao-conformidades/` | field suggestions |
  | `0008-explore-ux/` | Explorar / location gating |
  | `0009-territory-clinic-ownership/` | zones, patches, clinic ownership |
  | `0010-verticals-and-profiles/` | verticals, facility profiles, the profile-as-commercial-hub rule |
  | `0011-cadastro-pipeline/` | uploads, review, retention |
  | `0012-cnes-registry-professional-associations/` | the `registry` schema |
  | `0013-potencial-de-mercado/` | products, metrics, market share |
  | `0014-desempenho-e-equipe/` | dashboards and team |
- `architecture/adr/` — decisions that constrain implementation.
- `architecture/current.md` — what exists today.
- `architecture/features/` — feature areas at a product and system level.
- `ops/` — production runbooks.

Product vocabulary and positioning live in root `CONTEXT.md` and `PRODUCT.md`.

## Rules

- Docs describe **observed implementation**, not aspirations. A doc that describes something
  unbuilt is worse than no doc — it is read as truth and acted on.
- Specs are authoritative; when a spec and an older feature doc disagree, the spec wins.
- ADRs record decisions and the alternatives rejected, so they are not silently re-litigated.
- When behaviour changes, update the doc in the **same PR**. Do not defer.
- When a doc becomes wrong, **delete it**. Superseding specs name what they replace.
