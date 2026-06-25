-- Country territories are top-level regions (not root).
UPDATE "territories"
SET
  "nodeType" = 'region',
  "regionSlug" = COALESCE("regionSlug", "countryCode", SPLIT_PART("code", '-', 1)),
  "countryCode" = COALESCE("countryCode", SPLIT_PART("code", '-', 1))
WHERE "nodeType" = 'root';

DROP INDEX IF EXISTS "territories_country_root_key";

CREATE UNIQUE INDEX "territories_country_region_key"
  ON "territories" ("countryCode")
  WHERE "nodeType" = 'region' AND "parentId" IS NULL AND "isActive" = true;
