import { prisma } from "../../../../infrastructure/database/prisma.client";
import { MOCK_REGISTRY_PROVIDER } from "../../application/interfaces/registry-source.port";

export async function cleanupMockRegistryData(): Promise<void> {
  const mockClinics = await prisma.facility.findMany({
    where: { sourceProvider: MOCK_REGISTRY_PROVIDER },
    select: { id: true },
  });
  const mockDoctors = await prisma.professional.findMany({
    where: { sourceProvider: MOCK_REGISTRY_PROVIDER },
    select: { id: true },
  });

  const facilityIds = mockClinics.map((c) => c.id);
  const professionalIds = mockDoctors.map((d) => d.id);

  if (facilityIds.length > 0 || professionalIds.length > 0) {
    await prisma.ingestionSuggestion.deleteMany({
      where: {
        OR: [
          ...(facilityIds.length > 0 ? [{ facilityId: { in: facilityIds } }] : []),
          ...(professionalIds.length > 0 ? [{ professionalId: { in: professionalIds } }] : []),
        ],
      },
    });

    await prisma.facilityProfessional.deleteMany({
      where: {
        OR: [
          ...(facilityIds.length > 0 ? [{ facilityId: { in: facilityIds } }] : []),
          ...(professionalIds.length > 0 ? [{ professionalId: { in: professionalIds } }] : []),
        ],
      },
    });
  }

  await prisma.ingestionRun.deleteMany({
    where: { sourceProvider: MOCK_REGISTRY_PROVIDER },
  });

  await prisma.professional.deleteMany({
    where: { sourceProvider: MOCK_REGISTRY_PROVIDER },
  });

  await prisma.facility.deleteMany({
    where: { sourceProvider: MOCK_REGISTRY_PROVIDER },
  });
}
