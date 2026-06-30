# Spec 0002: Facility and Professional CRM Requirements

## User Story

As a healthcare commercial user, I want to manage facilities, professionals, and their relationships, so that field teams can plan visits, maintain accurate records, and act on trusted healthcare relationship data.

## Acceptance Criteria

1. WHEN a user lists facilities THEN the system SHALL return only facilities visible to the user's organization and scope.
2. WHEN a user opens a facility THEN the system SHALL show facility details, associated professionals, registry provenance, relationship status, consultant assignment, healthcare provider shares, and conformity records.
3. WHEN a user lists professionals THEN the system SHALL return only professionals visible to the user's organization and scope.
4. WHEN a user opens a professional THEN the system SHALL show professional details, associated facilities, specialty, provenance, and relationship status.
5. WHEN registry data conflicts with manually maintained CRM data THEN the system SHALL preserve manual edits and surface reviewable suggestions (including `FACILITY_FIELD_UPDATE`); approving address changes SHALL trigger geocoding.
6. WHEN a suggestion is approved or rejected THEN the system SHALL audit the decision and update affected facility/professional relationships according to the suggestion type; facility deactivation approvals SHALL set `deletedAt`.
7. IF a facility or professional is soft-deleted THEN the system SHALL hide it from normal lists while preserving audit and historical relationship data.
8. WHEN a user views registry panels on a facility THEN the system SHALL expose read-only registry projections (`/facilities/:id/registry/*`) separate from CRM truth.
9. WHEN a user confirms registry-sourced professionals or representatives THEN the system SHALL record confirmation with occupation code or external key as applicable.
10. WHEN an admin manages commercial catalogs THEN the system SHALL provide CRUD for sectors, products, and healthcare providers, plus facility payer share assignment.

## API Reference

See [Spec 38 — Registry Ingestion](../../apps/api/specs/38-registry-ingestion.md) for ingestion, registry read, confirm, catalog, and conformity endpoint details.
