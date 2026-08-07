import { facilityRepresentatives } from "@atlasmed/database";
import { eq, and, isNull, asc, ilike, or, count } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  FacilityRepresentativeListPage,
  FacilityRepresentativeRecord,
  FacilityRepresentativeRepository,
  FacilityRepresentativeRoleFlags,
  FacilityRepresentativeRolePatch,
} from "../../../application/interfaces/facility-representative.repository.interface";
import { contactTypeFromRoles } from "../../../application/interfaces/facility-representative.repository.interface";

type RepresentativeRow = typeof facilityRepresentatives.$inferSelect;

function mapRoles(row: RepresentativeRow): FacilityRepresentativeRoleFlags {
  return {
    isPartner: row.isPartner,
    isAdministrator: row.isAdministrator,
    isDecisionMaker: row.isDecisionMaker,
    isBuyer: row.isBuyer,
    isBiller: row.isBiller,
    isSecretary: row.isSecretary,
  };
}

function mapRepresentative(row: RepresentativeRow): FacilityRepresentativeRecord {
  return {
    id: row.id,
    facilityId: row.facilityId,
    representativeName: row.representativeName,
    roleTitle: row.roleTitle,
    email: row.email,
    phone: row.phone,
    taxId: row.taxId,
    contactType: row.contactType,
    ...mapRoles(row),
    confirmedAt: row.confirmedAt,
    confirmedByUserId: row.confirmedByUserId,
    endedAt: row.endedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function resolveRoles(
  patch: FacilityRepresentativeRolePatch | undefined,
  existing?: FacilityRepresentativeRoleFlags
): FacilityRepresentativeRoleFlags {
  return {
    isPartner: patch?.isPartner ?? existing?.isPartner ?? false,
    isAdministrator: patch?.isAdministrator ?? existing?.isAdministrator ?? false,
    isDecisionMaker: patch?.isDecisionMaker ?? existing?.isDecisionMaker ?? false,
    isBuyer: patch?.isBuyer ?? existing?.isBuyer ?? false,
    isBiller: patch?.isBiller ?? existing?.isBiller ?? false,
    isSecretary: patch?.isSecretary ?? existing?.isSecretary ?? false,
  };
}

export class DrizzleFacilityRepresentativeRepository
  implements FacilityRepresentativeRepository
{
  async findByIdForFacility(
    facilityId: number,
    representativeId: number
  ): Promise<FacilityRepresentativeRecord | null> {
    const [representative] = await db
      .select()
      .from(facilityRepresentatives)
      .where(
        and(
          eq(facilityRepresentatives.facilityId, facilityId),
          eq(facilityRepresentatives.id, representativeId),
          isNull(facilityRepresentatives.endedAt)
        )
      )
      .limit(1);

    return representative ? mapRepresentative(representative) : null;
  }

  async findActiveByFacility(params: {
    facilityId: number;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<FacilityRepresentativeListPage> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;
    const search = params.search?.trim();

    const conditions = [
      eq(facilityRepresentatives.facilityId, params.facilityId),
      isNull(facilityRepresentatives.endedAt),
    ];

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(facilityRepresentatives.representativeName, pattern),
          ilike(facilityRepresentatives.roleTitle, pattern),
          ilike(facilityRepresentatives.email, pattern),
          ilike(facilityRepresentatives.phone, pattern)
        )!
      );
    }

    const where = and(...conditions);

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(facilityRepresentatives)
        .where(where)
        .orderBy(asc(facilityRepresentatives.representativeName))
        .offset(skip)
        .limit(limit),
      db
        .select({ total: count() })
        .from(facilityRepresentatives)
        .where(where),
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    return {
      items: rows.map(mapRepresentative),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async createManual(params: {
    facilityId: number;
    representativeName: string;
    roleTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    contactType?: "PROFESSIONAL" | "DECISOR" | "COMPRADOR";
    roles?: FacilityRepresentativeRolePatch;
    confirmedByUserId: number;
  }): Promise<FacilityRepresentativeRecord> {
    const now = new Date();
    const roles = resolveRoles(params.roles);
    const contactType = params.contactType ?? contactTypeFromRoles(roles);
    const [representative] = await db
      .insert(facilityRepresentatives)
      .values({
        facilityId: params.facilityId,
        representativeName: params.representativeName,
        roleTitle: params.roleTitle ?? null,
        email: params.email ?? null,
        phone: params.phone ?? null,
        contactType,
        ...roles,
        confirmedAt: now,
        confirmedByUserId: params.confirmedByUserId,
      })
      .returning();

    return mapRepresentative(representative!);
  }

  async updateManual(params: {
    facilityId: number;
    representativeId: number;
    representativeName?: string;
    roleTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    contactType?: "PROFESSIONAL" | "DECISOR" | "COMPRADOR";
    roles?: FacilityRepresentativeRolePatch;
  }): Promise<FacilityRepresentativeRecord | null> {
    const existing = await this.findByIdForFacility(
      params.facilityId,
      params.representativeId
    );
    if (!existing) return null;

    const roles =
      params.roles !== undefined
        ? resolveRoles(params.roles, existing)
        : mapRolesFromRecord(existing);
    const contactType =
      params.contactType ??
      (params.roles !== undefined ? contactTypeFromRoles(roles) : existing.contactType);

    const [representative] = await db
      .update(facilityRepresentatives)
      .set({
        ...(params.representativeName !== undefined
          ? { representativeName: params.representativeName }
          : {}),
        ...(params.roleTitle !== undefined ? { roleTitle: params.roleTitle } : {}),
        ...(params.email !== undefined ? { email: params.email } : {}),
        ...(params.phone !== undefined ? { phone: params.phone } : {}),
        contactType,
        ...roles,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(facilityRepresentatives.facilityId, params.facilityId),
          eq(facilityRepresentatives.id, params.representativeId),
          isNull(facilityRepresentatives.endedAt)
        )
      )
      .returning();

    return representative ? mapRepresentative(representative) : null;
  }
}

function mapRolesFromRecord(
  row: FacilityRepresentativeRecord
): FacilityRepresentativeRoleFlags {
  return {
    isPartner: row.isPartner,
    isAdministrator: row.isAdministrator,
    isDecisionMaker: row.isDecisionMaker,
    isBuyer: row.isBuyer,
    isBiller: row.isBiller,
    isSecretary: row.isSecretary,
  };
}
