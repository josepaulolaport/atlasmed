-- Canonical commercial territory role types expected by the API
-- (manager_zone / patch). Legacy country/region rows may still exist.
INSERT INTO "territory_types" (
  "id",
  "slug",
  "name",
  "description",
  "can_have_boundary",
  "assigns_clinics",
  "assignable_to_users",
  "assignable_to_managers",
  "block_sibling_overlap",
  "sort_order",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  'tt_manager_zone',
  'manager_zone',
  'Zona de gerente',
  'Manager coverage zone. Contains rep patches. Does not assign clinics directly.',
  true,
  false,
  false,
  true,
  true,
  10,
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "territory_types" WHERE "slug" = 'manager_zone'
);

INSERT INTO "territory_types" (
  "id",
  "slug",
  "name",
  "description",
  "can_have_boundary",
  "assigns_clinics",
  "assignable_to_users",
  "assignable_to_managers",
  "block_sibling_overlap",
  "sort_order",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  'tt_patch',
  'patch',
  'Patch de representante',
  'Rep patch. Contained in a manager zone. Assigns clinics via PIP membership.',
  true,
  true,
  true,
  false,
  true,
  20,
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "territory_types" WHERE "slug" = 'patch'
);
