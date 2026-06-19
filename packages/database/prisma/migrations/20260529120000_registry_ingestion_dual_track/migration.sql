-- AlterEnum AuditEventType
ALTER TYPE "AuditEventType" ADD VALUE 'REGISTRY_INGESTION_COMPLETED';
ALTER TYPE "AuditEventType" ADD VALUE 'REGISTRY_SUGGESTION_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE 'REGISTRY_SUGGESTION_REJECTED';
ALTER TYPE "AuditEventType" ADD VALUE 'DOCTOR_CLINIC_CONFIRMED';
ALTER TYPE "AuditEventType" ADD VALUE 'DOCTOR_CLINIC_ASSOCIATION_ENDED';
ALTER TYPE "AuditEventType" ADD VALUE 'DOCTOR_CLINIC_MANUAL_ASSOCIATED';
ALTER TYPE "AuditEventType" ADD VALUE 'CLINIC_REACTIVATED';

-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "IngestionSuggestionType" AS ENUM ('CLINIC_REMOVAL', 'CLINIC_REACTIVATION', 'DOCTOR_CLINIC_REMOVAL');
CREATE TYPE "IngestionSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'SUPERSEDED');

-- AlterTable clinics
ALTER TABLE "clinics" ADD COLUMN "sourceProvider" TEXT;
ALTER TABLE "clinics" ADD COLUMN "externalSourceId" TEXT;
ALTER TABLE "clinics" ADD COLUMN "sourceContentHash" TEXT;
ALTER TABLE "clinics" ADD COLUMN "sourceFirstSeenAt" TIMESTAMP(3);
ALTER TABLE "clinics" ADD COLUMN "sourceLastSeenAt" TIMESTAMP(3);
ALTER TABLE "clinics" ADD COLUMN "sourcePresent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clinics" ADD COLUMN "sourceTracked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clinics" ADD COLUMN "manuallyEditedAt" TIMESTAMP(3);

-- AlterTable doctors
ALTER TABLE "doctors" ADD COLUMN "sourceProvider" TEXT;
ALTER TABLE "doctors" ADD COLUMN "externalSourceId" TEXT;
ALTER TABLE "doctors" ADD COLUMN "sourceContentHash" TEXT;
ALTER TABLE "doctors" ADD COLUMN "sourceFirstSeenAt" TIMESTAMP(3);
ALTER TABLE "doctors" ADD COLUMN "sourceLastSeenAt" TIMESTAMP(3);
ALTER TABLE "doctors" ADD COLUMN "sourcePresent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "doctors" ADD COLUMN "sourceTracked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "doctors" ADD COLUMN "manuallyEditedAt" TIMESTAMP(3);

-- CreateTable doctor_clinic_associations
CREATE TABLE "doctor_clinic_associations" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "sourceActive" BOOLEAN NOT NULL DEFAULT false,
    "sourceFirstSeenAt" TIMESTAMP(3),
    "sourceLastSeenAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "endedAt" TIMESTAMP(3),
    "endedByUserId" TEXT,
    "endReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_clinic_associations_pkey" PRIMARY KEY ("id")
);

-- Migrate existing doctor_clinics rows as confirmed associations
INSERT INTO "doctor_clinic_associations" (
    "id",
    "doctorId",
    "clinicId",
    "sourceActive",
    "confirmedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "doctorId",
    "clinicId",
    false,
    "createdAt",
    "createdAt",
    "createdAt"
FROM "doctor_clinics";

-- DropTable doctor_clinics
DROP TABLE "doctor_clinics";

-- CreateIndex clinics source
CREATE UNIQUE INDEX "clinics_sourceProvider_externalSourceId_key" ON "clinics"("sourceProvider", "externalSourceId");
CREATE INDEX "clinics_sourceProvider_sourcePresent_idx" ON "clinics"("sourceProvider", "sourcePresent");

-- CreateIndex doctors source
CREATE UNIQUE INDEX "doctors_sourceProvider_externalSourceId_key" ON "doctors"("sourceProvider", "externalSourceId");
CREATE INDEX "doctors_sourceProvider_sourcePresent_idx" ON "doctors"("sourceProvider", "sourcePresent");

-- CreateIndex doctor_clinic_associations
CREATE INDEX "doctor_clinic_associations_doctorId_idx" ON "doctor_clinic_associations"("doctorId");
CREATE INDEX "doctor_clinic_associations_clinicId_idx" ON "doctor_clinic_associations"("clinicId");
CREATE INDEX "doctor_clinic_associations_clinicId_sourceActive_endedAt_idx" ON "doctor_clinic_associations"("clinicId", "sourceActive", "endedAt");
CREATE INDEX "doctor_clinic_associations_clinicId_confirmedAt_endedAt_idx" ON "doctor_clinic_associations"("clinicId", "confirmedAt", "endedAt");
CREATE UNIQUE INDEX "doctor_clinic_associations_doctorId_clinicId_key" ON "doctor_clinic_associations"("doctorId", "clinicId");

-- AddForeignKey doctor_clinic_associations
ALTER TABLE "doctor_clinic_associations" ADD CONSTRAINT "doctor_clinic_associations_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doctor_clinic_associations" ADD CONSTRAINT "doctor_clinic_associations_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable ingestion_runs
CREATE TABLE "ingestion_runs" (
    "id" TEXT NOT NULL,
    "sourceProvider" TEXT NOT NULL,
    "status" "IngestionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "stats" JSONB,
    "error" TEXT,

    CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable ingestion_suggestions
CREATE TABLE "ingestion_suggestions" (
    "id" TEXT NOT NULL,
    "ingestionRunId" TEXT NOT NULL,
    "type" "IngestionSuggestionType" NOT NULL,
    "status" "IngestionSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "clinicId" TEXT,
    "doctorId" TEXT,
    "associationId" TEXT,
    "reason" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "suggestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNote" TEXT,

    CONSTRAINT "ingestion_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex ingestion
CREATE INDEX "ingestion_runs_sourceProvider_startedAt_idx" ON "ingestion_runs"("sourceProvider", "startedAt");
CREATE INDEX "ingestion_runs_status_idx" ON "ingestion_runs"("status");
CREATE INDEX "ingestion_suggestions_status_type_idx" ON "ingestion_suggestions"("status", "type");
CREATE INDEX "ingestion_suggestions_clinicId_status_idx" ON "ingestion_suggestions"("clinicId", "status");
CREATE INDEX "ingestion_suggestions_ingestionRunId_idx" ON "ingestion_suggestions"("ingestionRunId");

-- AddForeignKey ingestion_suggestions
ALTER TABLE "ingestion_suggestions" ADD CONSTRAINT "ingestion_suggestions_ingestionRunId_fkey" FOREIGN KEY ("ingestionRunId") REFERENCES "ingestion_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingestion_suggestions" ADD CONSTRAINT "ingestion_suggestions_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ingestion_suggestions" ADD CONSTRAINT "ingestion_suggestions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ingestion_suggestions" ADD CONSTRAINT "ingestion_suggestions_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "doctor_clinic_associations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
