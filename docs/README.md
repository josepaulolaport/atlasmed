# Atlasmed Documentation

This directory is the source of truth for Atlasmed product, architecture, feature, and spec-driven development documentation.

## Index

- `product/overview.md` — product vision, users, and core capabilities.
- `architecture/current.md` — current implementation architecture (what exists today).
- `architecture/target.md` — target architecture for the full platform.
- `architecture/features/` — feature areas at a product and system level.
- `architecture/adr/` — architecture decision records.
- `specs/` — spec-driven development requirements, designs, and task plans.
- `ai/` — AI context routing and integration-task guides.

Root `AGENTS.md` is the canonical AI instruction file for the monorepo.

## Documentation Rules

- Current-state docs describe observed implementation, not aspirations.
- Target docs describe intended direction and must call out gaps from current state.
- Feature docs explain behavior and domain language.
- Specs use requirements, design, and task plans before implementation starts.
- ADRs record decisions that constrain implementation.
- Do not document unbuilt redesigns as current truth.
