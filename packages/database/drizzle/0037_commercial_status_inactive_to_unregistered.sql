-- Repair DBs that applied the first 0035 draft (INACTIVE → CLOSED).
-- Legacy INACTIVE meant pré-cadastro, not relationship-end.
-- Idempotent: no-op when no CLOSED rows remain.
UPDATE "facility_vertical_profiles"
SET "commercial_status" = 'UNREGISTERED'
WHERE "commercial_status" = 'CLOSED';
