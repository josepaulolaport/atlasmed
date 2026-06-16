# Spec 0003: Territory Management Requirements

## User Story

As a sales manager, I want to define territories and assign users, clinics, and doctors to them, so that field activity, access control, routing, and analytics reflect real commercial coverage.

## Acceptance Criteria

1. WHEN a territory is created THEN the system SHALL associate it with an organization.
2. WHEN a manager assigns a user to a territory THEN the system SHALL grant that user access according to role and assignment rules.
3. WHEN a clinic is assigned to a territory THEN the system SHALL use that assignment in access checks and coverage analytics.
4. WHEN a user lists clinics or doctors THEN the system SHALL filter results by territory scope where applicable.
5. WHEN a territory assignment changes THEN the system SHALL audit the change and invalidate affected access caches.
6. IF a manager has reports but no territory assignment THEN the system SHALL follow an explicit product rule for whether that manager can access report data.
