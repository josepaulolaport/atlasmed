import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  ConformityRecordRow,
  ConformityRepository,
  ConformityRequirementRecord,
} from "../../../application/interfaces/conformity.repository.interface";

function mapRequirement(row: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sectorId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ConformityRequirementRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sectorId: row.sectorId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapRecord(row: {
  id: string;
  facilityId: string;
  requirementId: string;
  status: ConformityRecordRow["status"];
  submittedAt: Date | null;
  validatedAt: Date | null;
  expiresAt: Date | null;
  validatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  requirement: { id: string; slug: string; name: string };
}): ConformityRecordRow {
  return {
    id: row.id,
    facilityId: row.facilityId,
    requirementId: row.requirementId,
    status: row.status,
    submittedAt: row.submittedAt,
    validatedAt: row.validatedAt,
    expiresAt: row.expiresAt,
    validatedByUserId: row.validatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    requirement: row.requirement,
  };
}

export class PrismaConformityRepository implements ConformityRepository {
  async findActiveRequirements(): Promise<ConformityRequirementRecord[]> {
    const requirements = await prisma.conformityRequirement.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    return requirements.map(mapRequirement);
  }

  async findRecordsByFacility(facilityId: string): Promise<ConformityRecordRow[]> {
    const records = await prisma.conformityRecord.findMany({
      where: { facilityId },
      include: {
        requirement: {
          select: { id: true, slug: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return records.map(mapRecord);
  }

  async createRecord(params: {
    facilityId: string;
    requirementId: string;
    status?: ConformityRecordRow["status"];
  }): Promise<ConformityRecordRow> {
    const record = await prisma.conformityRecord.create({
      data: {
        facilityId: params.facilityId,
        requirementId: params.requirementId,
        status: params.status ?? "PENDING",
      },
      include: {
        requirement: {
          select: { id: true, slug: true, name: true },
        },
      },
    });

    return mapRecord(record);
  }
}
