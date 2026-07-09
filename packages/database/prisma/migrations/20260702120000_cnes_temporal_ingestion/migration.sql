-- CNES temporal ingestion: staging/previous registry schemas + ingestion run tracking

CREATE SCHEMA IF NOT EXISTS registry_staging;
CREATE SCHEMA IF NOT EXISTS registry_previous;

CREATE TABLE IF NOT EXISTS registry_staging.states (LIKE registry.states INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.municipalities (LIKE registry.municipalities INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.agreement_types (LIKE registry.agreement_types INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.care_types (LIKE registry.care_types INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.deactivation_reasons (LIKE registry.deactivation_reasons INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.equipment_categories (LIKE registry.equipment_categories INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.equipment_catalog (LIKE registry.equipment_catalog INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.facility_types (LIKE registry.facility_types INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.installation_subtypes (LIKE registry.installation_subtypes INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.physical_installation_types (LIKE registry.physical_installation_types INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.physical_installations (LIKE registry.physical_installations INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.occupations (LIKE registry.occupations INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.professional_councils (LIKE registry.professional_councils INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.service_specialties (LIKE registry.service_specialties INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.service_classifications (LIKE registry.service_classifications INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.maintainers (LIKE registry.maintainers INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.facilities (LIKE registry.facilities INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.professionals (LIKE registry.professionals INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.facility_agreements (LIKE registry.facility_agreements INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.facility_equipment (LIKE registry.facility_equipment INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.facility_physical_installations (LIKE registry.facility_physical_installations INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.facility_representatives (LIKE registry.facility_representatives INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.facility_services (LIKE registry.facility_services INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.facility_professionals (LIKE registry.facility_professionals INCLUDING ALL);
CREATE TABLE IF NOT EXISTS registry_staging.professional_workload (LIKE registry.professional_workload INCLUDING ALL);

CREATE TYPE "IngestionRunPhase" AS ENUM (
  'DISCOVERING',
  'DOWNLOADING',
  'PARSING',
  'LOADING',
  'VALIDATING',
  'RECONCILING',
  'PROMOTING',
  'SYNCING',
  'FAILED'
);

CREATE TYPE "IngestionDiffScope" AS ENUM ('WAREHOUSE', 'CRM');

ALTER TYPE "IngestionSuggestionType" ADD VALUE IF NOT EXISTS 'PROFESSIONAL_FIELD_UPDATE';

ALTER TABLE "ingestion_runs"
  ADD COLUMN IF NOT EXISTS "phase" "IngestionRunPhase",
  ADD COLUMN IF NOT EXISTS "phaseStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "temporalWorkflowId" TEXT,
  ADD COLUMN IF NOT EXISTS "referenceAno" INTEGER,
  ADD COLUMN IF NOT EXISTS "referenceMes" INTEGER,
  ADD COLUMN IF NOT EXISTS "promotedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "validationReport" JSONB,
  ADD COLUMN IF NOT EXISTS "archiveManifest" JSONB;

CREATE INDEX IF NOT EXISTS "ingestion_runs_temporalWorkflowId_idx"
  ON "ingestion_runs"("temporalWorkflowId");

CREATE TABLE IF NOT EXISTS "ingestion_diffs" (
  "id" TEXT NOT NULL,
  "ingestionRunId" TEXT NOT NULL,
  "scope" "IngestionDiffScope" NOT NULL,
  "entityType" TEXT NOT NULL,
  "externalSourceId" TEXT,
  "diffType" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ingestion_diffs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ingestion_diffs_ingestionRunId_idx"
  ON "ingestion_diffs"("ingestionRunId");

CREATE INDEX IF NOT EXISTS "ingestion_diffs_scope_entityType_idx"
  ON "ingestion_diffs"("scope", "entityType");

ALTER TABLE "ingestion_diffs"
  ADD CONSTRAINT "ingestion_diffs_ingestionRunId_fkey"
  FOREIGN KEY ("ingestionRunId") REFERENCES "ingestion_runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
