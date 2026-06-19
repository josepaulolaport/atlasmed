import { prisma } from "../../../../infrastructure/database/prisma.client";
import { MOCK_REGISTRY_PROVIDER } from "../../application/interfaces/registry-source.port";

export async function cleanupMockRegistryData(): Promise<void> {
  const mockClinics = await prisma.clinic.findMany({
    where: { sourceProvider: MOCK_REGISTRY_PROVIDER },
    select: { id: true },
  });
  const mockDoctors = await prisma.doctor.findMany({
    where: { sourceProvider: MOCK_REGISTRY_PROVIDER },
    select: { id: true },
  });

  const clinicIds = mockClinics.map((c) => c.id);
  const doctorIds = mockDoctors.map((d) => d.id);

  if (clinicIds.length > 0 || doctorIds.length > 0) {
    await prisma.ingestionSuggestion.deleteMany({
      where: {
        OR: [
          ...(clinicIds.length > 0 ? [{ clinicId: { in: clinicIds } }] : []),
          ...(doctorIds.length > 0 ? [{ doctorId: { in: doctorIds } }] : []),
        ],
      },
    });

    await prisma.doctorClinicAssociation.deleteMany({
      where: {
        OR: [
          ...(clinicIds.length > 0 ? [{ clinicId: { in: clinicIds } }] : []),
          ...(doctorIds.length > 0 ? [{ doctorId: { in: doctorIds } }] : []),
        ],
      },
    });
  }

  await prisma.ingestionRun.deleteMany({
    where: { sourceProvider: MOCK_REGISTRY_PROVIDER },
  });

  await prisma.doctor.deleteMany({
    where: { sourceProvider: MOCK_REGISTRY_PROVIDER },
  });

  await prisma.clinic.deleteMany({
    where: { sourceProvider: MOCK_REGISTRY_PROVIDER },
  });
}
