# Spec 0002: Facility and Person CRM Requirements

## User Story

As a healthcare commercial user, I want to manage facilities, people, and their relationships, so that field teams can plan visits, maintain accurate records, and act on trusted healthcare relationship data.

## Current model (implemented)

- Facilities in `public.facilities`.
- External humans in `public.persons` with optional `person_healthcare_profiles`.
- Facility affiliations in `public.person_facilities` + classifications (`HEALTHCARE_PROFESSIONAL` / `ADMINISTRATIVE_CONTACT`) + role assignments.
- Facility-scoped projections: `/api/v1/facilities/:id/healthcare-professionals` and `…/administrative-contacts`.
- Person-scoped notes / relationship / identity: `/api/v1/persons/:id/*`.
- Explorar list: `/api/v1/healthcare-professionals` (+ specialties facet).
- Role catalog: `/api/v1/person-facility-roles`.
- User-submitted corrections via `public.field_suggestions` (Spec 0007) — not a CNES registry warehouse queue.
- CNES registry warehouse schemas and `/registry/*` READ/confirm endpoints are **removed**.
- Design SoT: [ADR 0004](../../architecture/adr/0004-person-facility-model.md).

## Acceptance Criteria

1. WHEN a user lists facilities THEN the system SHALL return only facilities visible to the user's organization and scope.
2. WHEN a user opens a facility THEN the system SHALL show facility details, associated healthcare professionals and administrative contacts (projections), relationship status where wired, consultant assignment, healthcare provider shares, and conformity / cadastro records as implemented.
3. WHEN a user lists healthcare professionals (Explorar) THEN the system SHALL return only persons with healthcare profiles visible to the user's organization and scope.
4. WHEN a user opens a person THEN the system SHALL show identity/profile fields, associated facilities, specialties/registrations when present, and relationship status where wired.
5. WHEN a user submits a Não Conformidade (field suggestion or deactivation) THEN the system SHALL persist a reviewable suggestion in `field_suggestions` without writing CRM truth until accept; approving address changes SHALL trigger geocoding (Spec 0007).
6. WHEN a suggestion is approved or rejected THEN the system SHALL audit the decision and update affected facility data according to the suggestion type; facility deactivation approvals SHALL soft-deactivate the facility.
7. IF a facility or person is soft-deleted THEN the system SHALL hide it from normal lists while preserving audit and historical relationship data.
8. WHEN a user manages facility healthcare affiliations THEN the system SHALL support create/associate/update and replace-set role assignments via the healthcare-professionals projection as exposed by the API.
9. WHEN a user manages administrative contacts THEN the system SHALL support create/update and replace-set role assignments via the administrative-contacts projection as exposed by the API.
10. WHEN an admin manages commercial catalogs THEN the system SHALL provide CRUD for products and related catalog entities as implemented, plus facility payer share assignment where exposed.

## Related docs

- Feature guide: [Facility and Person CRM](../../architecture/features/clinic-doctor-registry.md)
- Mobile establishment detail: [Spec 0005](../0005-establishment-detail-mobile/requirements.md)
- Não Conformidades: [Spec 0007](../0007-nao-conformidades/requirements.md)
