import {
  conformityRecords,
  conformityRequirements,
} from "@atlasmed/database";
import { eq, asc, desc } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  ConformityRecordRow,
  ConformityRepository,
  ConformityRequirementRecord,
} from "../../../application/interfaces/conformity.repository.interface";

type RequirementRow = typeof conformityRequirements.$inferSelect;

function mapRequirement(row: RequirementRow): ConformityRequirementRecord {
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

const recordWithRequirementSelect = {
  id: conformityRecords.id,
  facilityId: conformityRecords.facilityId,
  requirementId: conformityRecords.requirementId,
  status: conformityRecords.status,
  submittedAt: conformityRecords.submittedAt,
  validatedAt: conformityRecords.validatedAt,
  expiresAt: conformityRecords.expiresAt,
  validatedByUserId: conformityRecords.validatedByUserId,
  createdAt: conformityRecords.createdAt,
  updatedAt: conformityRecords.updatedAt,
  requirement: {
    id: conformityRequirements.id,
    slug: conformityRequirements.slug,
    name: conformityRequirements.name,
  },
} as const;

type RecordWithRequirement = {
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
};

function mapRecord(row: RecordWithRequirement): ConformityRecordRow {
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
    const rows = await db
      .select()
      .from(conformityRequirements)
      .where(eq(conformityRequirements.isActive, true))
      .orderBy(asc(conformityRequirements.name));

    return rows.map(mapRequirement);
  }

  async findRecordsByFacility(facilityId: string): Promise<ConformityRecordRow[]> {
    const rows = await db
      .select(recordWithRequirementSelect)
      .from(conformityRecords)
      .innerJoin(
        conformityRequirements,
        eq(conformityRecords.requirementId, conformityRequirements.id)
      )
      .where(eq(conformityRecords.facilityId, facilityId))
      .orderBy(desc(conformityRecords.createdAt));

    return rows.map(mapRecord);
  }

  async createRecord(params: {
    facilityId: string;
    requirementId: string;
    status?: ConformityRecordRow["status"];
  }): Promise<ConformityRecordRow> {
    const [inserted] = await db
      .insert(conformityRecords)
      .values({
        facilityId: params.facilityId,
        requirementId: params.requirementId,
        status: params.status ?? "PENDING",
      })
      .returning({ id: conformityRecords.id });

    const [record] = await db
      .select(recordWithRequirementSelect)
      .from(conformityRecords)
      .innerJoin(
        conformityRequirements,
        eq(conformityRecords.requirementId, conformityRequirements.id)
      )
      .where(eq(conformityRecords.id, inserted.id));

    return mapRecord(record);
  }
}
