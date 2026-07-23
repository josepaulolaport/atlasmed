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
    sourceProvider: row.sourceProvider,
    externalSourceKey: row.externalSourceKey,
    sourceActive: row.sourceActive,
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
  async findByFacilityAndExternalKey(
    facilityId: string,
    externalKey: string
  ): Promise<FacilityRepresentativeRecord | null> {
    const [representative] = await db
      .select()
      .from(facilityRepresentatives)
      .where(
        and(
          eq(facilityRepresentatives.facilityId, facilityId),
          eq(facilityRepresentatives.externalSourceKey, externalKey),
          isNull(facilityRepresentatives.endedAt)
        )
      )
      .limit(1);

    return representative ? mapRepresentative(representative) : null;
  }

  async findByIdForFacility(
    facilityId: string,
    representativeId: string
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
    facilityId: string;
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

  async upsertFromRegistry(params: {
    facilityId: string;
    externalSourceKey: string;
    representativeName: string;
    roleTitle?: string | null;
    email?: string | null;
    taxId?: string | null;
  }): Promise<FacilityRepresentativeRecord> {
    const [representative] = await db
      .insert(facilityRepresentatives)
      .values({
        facilityId: params.facilityId,
        externalSourceKey: params.externalSourceKey,
        representativeName: params.representativeName,
        roleTitle: params.roleTitle ?? null,
        email: params.email ?? null,
        taxId: params.taxId ?? null,
        sourceActive: true,
        sourceProvider: "registry",
      })
      .onConflictDoUpdate({
        target: [
          facilityRepresentatives.facilityId,
          facilityRepresentatives.externalSourceKey,
        ],
        set: {
          representativeName: params.representativeName,
          roleTitle: params.roleTitle ?? null,
          email: params.email ?? null,
          taxId: params.taxId ?? null,
          sourceActive: true,
          updatedAt: new Date(),
        },
      })
      .returning();

    return mapRepresentative(representative!);
  }

  async confirm(params: {
    facilityId: string;
    externalSourceKey: string;
    confirmedByUserId: string;
  }): Promise<FacilityRepresentativeRecord> {
    const [representative] = await db
      .update(facilityRepresentatives)
      .set({
        confirmedAt: new Date(),
        confirmedByUserId: params.confirmedByUserId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(facilityRepresentatives.facilityId, params.facilityId),
          eq(facilityRepresentatives.externalSourceKey, params.externalSourceKey)
        )
      )
      .returning();

    return mapRepresentative(representative!);
  }

  async createManual(params: {
    facilityId: string;
    representativeName: string;
    roleTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    contactType?: "PROFESSIONAL" | "DECISOR" | "COMPRADOR";
    roles?: FacilityRepresentativeRolePatch;
    confirmedByUserId: string;
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
        sourceActive: false,
        sourceProvider: null,
        externalSourceKey: null,
        confirmedAt: now,
        confirmedByUserId: params.confirmedByUserId,
        manuallyEditedAt: now,
      })
      .returning();

    return mapRepresentative(representative!);
  }

  async updateManual(params: {
    facilityId: string;
    representativeId: string;
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
        manuallyEditedAt: new Date(),
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

  async endSourceRepresentative(params: {
    facilityId: string;
    externalSourceKey: string;
    endedByUserId: string;
    endReason?: string;
  }): Promise<FacilityRepresentativeRecord | null> {
    const [existing] = await db
      .select()
      .from(facilityRepresentatives)
      .where(
        and(
          eq(facilityRepresentatives.facilityId, params.facilityId),
          eq(facilityRepresentatives.externalSourceKey, params.externalSourceKey),
          isNull(facilityRepresentatives.endedAt)
        )
      )
      .limit(1);

    if (!existing) return null;

    const [representative] = await db
      .update(facilityRepresentatives)
      .set({
        endedAt: new Date(),
        sourceActive: false,
        updatedAt: new Date(),
      })
      .where(eq(facilityRepresentatives.id, existing.id))
      .returning();

    return mapRepresentative(representative!);
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
