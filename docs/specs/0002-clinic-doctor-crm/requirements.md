# Spec 0002: Clinic and Doctor CRM Requirements

## User Story

As a healthcare commercial user, I want to manage clinics, physicians, and their relationships, so that field teams can plan visits, maintain accurate records, and act on trusted healthcare relationship data.

## Acceptance Criteria

1. WHEN a user lists clinics THEN the system SHALL return only clinics visible to the user's organization and scope.
2. WHEN a user opens a clinic THEN the system SHALL show clinic details, associated doctors, registry provenance, and relevant relationship status.
3. WHEN a user lists doctors THEN the system SHALL return only doctors visible to the user's organization and scope.
4. WHEN a user opens a doctor THEN the system SHALL show doctor details, associated clinics, specialty, provenance, and relationship status.
5. WHEN registry data conflicts with manually maintained CRM data THEN the system SHALL preserve manual edits and surface reviewable suggestions.
6. WHEN a suggestion is approved or rejected THEN the system SHALL audit the decision and update affected clinic/doctor relationships according to the suggestion type.
7. IF a clinic or doctor is soft-deleted THEN the system SHALL hide it from normal lists while preserving audit and historical relationship data.
