-- Rename legacy permission grant resources to canonical names.
UPDATE "permissions"
SET "resource" = 'FACILITY'
WHERE "resource" = 'CLINIC';

UPDATE "permissions"
SET "resource" = 'PROFESSIONAL'
WHERE "resource" = 'DOCTOR';
