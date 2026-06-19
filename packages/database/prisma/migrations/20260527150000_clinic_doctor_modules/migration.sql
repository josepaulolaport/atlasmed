-- CreateTable
CREATE TABLE "clinics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "territoryId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "specialty" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_clinics" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_clinics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinics_territoryId_idx" ON "clinics"("territoryId");

-- CreateIndex
CREATE INDEX "clinics_deletedAt_idx" ON "clinics"("deletedAt");

-- CreateIndex
CREATE INDEX "clinics_name_idx" ON "clinics"("name");

-- CreateIndex
CREATE INDEX "doctors_deletedAt_idx" ON "doctors"("deletedAt");

-- CreateIndex
CREATE INDEX "doctors_lastName_firstName_idx" ON "doctors"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "doctor_clinics_doctorId_idx" ON "doctor_clinics"("doctorId");

-- CreateIndex
CREATE INDEX "doctor_clinics_clinicId_idx" ON "doctor_clinics"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_clinics_doctorId_clinicId_key" ON "doctor_clinics"("doctorId", "clinicId");

-- AddForeignKey
ALTER TABLE "doctor_clinics" ADD CONSTRAINT "doctor_clinics_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_clinics" ADD CONSTRAINT "doctor_clinics_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
