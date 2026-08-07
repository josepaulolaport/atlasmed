# Spec 0002: Facility and Professional CRM Requirements

## User Story

As a healthcare commercial user, I want to manage facilities, professionals, and their relationships, so that field teams can plan visits, maintain accurate records, and act on trusted healthcare relationship data.

## Current model (implemented)

- Facilities in `public.facilities`.
- Healthcare people in `public.professionals`, linked via `public.facility_professionals`.
- Administrative / commercial contacts in `public.facility_representatives` (per-facility contact rows; not the same identity table as professionals).
- User-submitted corrections via `public.field_suggestions` (Spec 0007) — not a CNES registry warehouse queue.
- CNES registry warehouse schemas and `/registry/*` / `/facilities/:id/registry/*` READ/confirm endpoints are **removed**.

## Acceptance Criteria

1. WHEN a user lists facilities THEN the system SHALL return only facilities visible to the user's organization and scope.
2. WHEN a user opens a facility THEN the system SHALL show facility details, associated professionals, representatives where applicable, relationship status, consultant assignment, healthcare provider shares, and conformity / cadastro records as implemented.
3. WHEN a user lists professionals THEN the system SHALL return only professionals visible to the user's organization and scope.
4. WHEN a user opens a professional THEN the system SHALL show professional details, associated facilities, specialty (as stored), and relationship status.
5. WHEN a user submits a Não Conformidade (field suggestion or deactivation) THEN the system SHALL persist a reviewable suggestion in `field_suggestions` without writing CRM truth until accept; approving address changes SHALL trigger geocoding (Spec 0007).
6. WHEN a suggestion is approved or rejected THEN the system SHALL audit the decision and update affected facility data according to the suggestion type; facility deactivation approvals SHALL soft-deactivate the facility.
7. IF a facility or professional is soft-deleted THEN the system SHALL hide it from normal lists while preserving audit and historical relationship data.
8. WHEN a user manages facility professionals THEN the system SHALL support association lifecycle (including confirmation / end) and commercial role flags on `facility_professionals` as exposed by the API.
9. WHEN a user manages facility representatives THEN the system SHALL support create/update/end of `facility_representatives` with role flags as exposed by the API.
10. WHEN an admin manages commercial catalogs THEN the system SHALL provide CRUD for products and related catalog entities as implemented, plus facility payer share assignment where exposed.

## Related docs

- Feature guide: [Facility and Professional CRM](../../architecture/features/clinic-doctor-registry.md)
- Mobile establishment detail: [Spec 0005](../0005-establishment-detail-mobile/requirements.md)
- Não Conformidades: [Spec 0007](../0007-nao-conformidades/requirements.md)
