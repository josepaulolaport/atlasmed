import type { RelationshipLevel } from "@atlasmed/database";
import {
  facilityProfessionals,
  professionals,
  facilities,
} from "@atlasmed/database";
import { eq, and, or, isNull, isNotNull, ilike, sql, asc, type SQL } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  FacilityProfessionalRecord,
  FacilityProfessionalRepository,
  FacilityProfessionalWithProfessionalRecord,
  FacilityProfessionalView,
} from "../../../application/interfaces/facility-professional.repository.interface";

const LEGACY_OCCUPATION_CODE = "LEGACY";

type AssociationRow = typeof facilityProfessionals.$inferSelect;

function mapAssociation(association: AssociationRow): FacilityProfessionalRecord {
  return {
    id: association.id,
    professionalId: association.professionalId,
    facilityId: association.facilityId,
    occupationCode: association.occupationCode,
    specialtyLabel: association.specialtyLabel,
    isPartner: association.isPartner,
    isPrescriber: association.isPrescriber,
    isBuyer: association.isBuyer,
    isDecisionMaker: association.isDecisionMaker,
    relationshipLevel: association.relationshipLevel as RelationshipLevel | null,
    notes: association.notes,
    sourceActive: association.sourceActive,
    sourceFirstSeenAt: association.sourceFirstSeenAt,
    sourceLastSeenAt: association.sourceLastSeenAt,
    confirmedAt: association.confirmedAt,
    confirmedByUserId: association.confirmedByUserId,
    endedAt: association.endedAt,
    endedByUserId: association.endedByUserId,
    endReason: association.endReason,
    createdAt: association.createdAt,
    updatedAt: association.updatedAt,
  };
}

function buildViewConditions(facilityId: string, view: FacilityProfessionalView): SQL[] {
  const base: SQL[] = [
    eq(facilityProfessionals.facilityId, facilityId),
    isNull(facilityProfessionals.endedAt),
  ];

  switch (view) {
    case "source":
      return [...base, eq(facilityProfessionals.sourceActive, true)];
    case "confirmed":
      return [...base, isNotNull(facilityProfessionals.confirmedAt)];
    case "pending":
      return [
        ...base,
        eq(facilityProfessionals.sourceActive, true),
        isNull(facilityProfessionals.confirmedAt),
      ];
    case "all":
      return [
        ...base,
        or(
          eq(facilityProfessionals.sourceActive, true),
          isNotNull(facilityProfessionals.confirmedAt)
        ) as SQL,
      ];
  }
}

const associationColumns = {
  id: facilityProfessionals.id,
  professionalId: facilityProfessionals.professionalId,
  facilityId: facilityProfessionals.facilityId,
  occupationCode: facilityProfessionals.occupationCode,
  specialtyLabel: facilityProfessionals.specialtyLabel,
  isPartner: facilityProfessionals.isPartner,
  isPrescriber: facilityProfessionals.isPrescriber,
  isBuyer: facilityProfessionals.isBuyer,
  isDecisionMaker: facilityProfessionals.isDecisionMaker,
  relationshipLevel: facilityProfessionals.relationshipLevel,
  notes: facilityProfessionals.notes,
  sourceActive: facilityProfessionals.sourceActive,
  sourceFirstSeenAt: facilityProfessionals.sourceFirstSeenAt,
  sourceLastSeenAt: facilityProfessionals.sourceLastSeenAt,
  confirmedAt: facilityProfessionals.confirmedAt,
  confirmedByUserId: facilityProfessionals.confirmedByUserId,
  endedAt: facilityProfessionals.endedAt,
  endedByUserId: facilityProfessionals.endedByUserId,
  endReason: facilityProfessionals.endReason,
  createdAt: facilityProfessionals.createdAt,
  updatedAt: facilityProfessionals.updatedAt,
} as const;

export class PrismaFacilityProfessionalRepository
  implements FacilityProfessionalRepository
{
  async findByProfessionalAndFacility(
    professionalId: string,
    facilityId: string,
    occupationCode = LEGACY_OCCUPATION_CODE
  ): Promise<FacilityProfessionalRecord | null> {
    const [association] = await db
      .select()
      .from(facilityProfessionals)
      .where(
        and(
          eq(facilityProfessionals.facilityId, facilityId),
          eq(facilityProfessionals.professionalId, professionalId),
          eq(facilityProfessionals.occupationCode, occupationCode)
        )
      )
      .limit(1);

    return association ? mapAssociation(association) : null;
  }

  async findActiveWithProfessional(
    facilityId: string,
    professionalId: string,
    occupationCode = LEGACY_OCCUPATION_CODE
  ) {
    const [row] = await db
      .select({
        ...associationColumns,
        professional: {
          id: professionals.id,
          firstName: professionals.firstName,
          lastName: professionals.lastName,
          fullName: professionals.fullName,
          socialName: professionals.socialName,
          taxId: professionals.taxId,
          birthDate: professionals.birthDate,
          mobilePhone: professionals.mobilePhone,
          landlinePhone: professionals.landlinePhone,
          email: professionals.email,
          websiteUrl: professionals.websiteUrl,
          imageUrl: professionals.imageUrl,
          primarySpecialtyLabel: professionals.primarySpecialtyLabel,
          crmCouncil: professionals.crmCouncil,
          crmNumber: professionals.crmNumber,
          crmState: professionals.crmState,
          favoriteTeam: professionals.favoriteTeam,
          favoriteSport: professionals.favoriteSport,
          hobbies: professionals.hobbies,
          notes: professionals.notes,
          createdAt: professionals.createdAt,
          updatedAt: professionals.updatedAt,
        },
      })
      .from(facilityProfessionals)
      .innerJoin(professionals, eq(facilityProfessionals.professionalId, professionals.id))
      .where(
        and(
          eq(facilityProfessionals.facilityId, facilityId),
          eq(facilityProfessionals.professionalId, professionalId),
          eq(facilityProfessionals.occupationCode, occupationCode),
          isNull(facilityProfessionals.endedAt),
          isNull(professionals.deletedAt)
        )
      )
      .limit(1);

    if (!row) return null;

    return {
      association: mapAssociation(row),
      professional: row.professional,
    };
  }

  async findActiveByFacilityWithProfessionals(params: {
    facilityId: string;
    view: FacilityProfessionalView;
    page: number;
    limit: number;
    search?: string;
  }): Promise<{
    associations: FacilityProfessionalWithProfessionalRecord[];
    total: number;
  }> {
    const conditions = buildViewConditions(params.facilityId, params.view);
    conditions.push(isNull(professionals.deletedAt));

    if (params.search) {
      const pattern = `%${params.search}%`;
      conditions.push(
        or(
          ilike(professionals.firstName, pattern),
          ilike(professionals.lastName, pattern),
          ilike(professionals.primarySpecialtyLabel, pattern),
        ) as SQL
      );
    }

    const where = and(...conditions);
    const skip = (params.page - 1) * params.limit;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          ...associationColumns,
          professional: {
            id: professionals.id,
            firstName: professionals.firstName,
            lastName: professionals.lastName,
            fullName: professionals.fullName,
            specialty: professionals.primarySpecialtyLabel,
            crmNumber: professionals.crmNumber,
            crmState: professionals.crmState,
            createdAt: professionals.createdAt,
            updatedAt: professionals.updatedAt,
          },
        })
        .from(facilityProfessionals)
        .innerJoin(professionals, eq(facilityProfessionals.professionalId, professionals.id))
        .where(where)
        .orderBy(asc(professionals.lastName), asc(professionals.firstName))
        .offset(skip)
        .limit(params.limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(facilityProfessionals)
        .innerJoin(professionals, eq(facilityProfessionals.professionalId, professionals.id))
        .where(where),
    ]);

    return {
      associations: rows.map((row) => ({
        ...mapAssociation(row),
        professional: row.professional,
      })),
      total: count,
    };
  }

  async findActiveSourceAssociationsByProvider(sourceProvider: string): Promise<
    Array<{
      association: FacilityProfessionalRecord;
      professionalExternalSourceId: string;
      facilityExternalSourceId: string;
    }>
  > {
    const rows = await db
      .select({
        ...associationColumns,
        professionalExternalSourceId: professionals.externalSourceId,
        facilityExternalSourceId: facilities.externalSourceId,
      })
      .from(facilityProfessionals)
      .innerJoin(professionals, eq(facilityProfessionals.professionalId, professionals.id))
      .innerJoin(facilities, eq(facilityProfessionals.facilityId, facilities.id))
      .where(
        and(
          isNull(facilityProfessionals.endedAt),
          eq(facilityProfessionals.sourceActive, true),
          eq(professionals.sourceProvider, sourceProvider),
          eq(professionals.sourceTracked, true),
          eq(facilities.sourceProvider, sourceProvider),
          eq(facilities.sourceTracked, true)
        )
      );

    return rows
      .filter((row) => row.professionalExternalSourceId && row.facilityExternalSourceId)
      .map((row) => ({
        association: mapAssociation(row),
        professionalExternalSourceId: row.professionalExternalSourceId!,
        facilityExternalSourceId: row.facilityExternalSourceId!,
      }));
  }

  async confirmAssociation(params: {
    professionalId: string;
    facilityId: string;
    occupationCode?: string;
    confirmedByUserId: string;
  }): Promise<FacilityProfessionalRecord> {
    const now = new Date();
    const occupationCode = params.occupationCode ?? LEGACY_OCCUPATION_CODE;

    const [association] = await db
      .insert(facilityProfessionals)
      .values({
        professionalId: params.professionalId,
        facilityId: params.facilityId,
        occupationCode,
        confirmedAt: now,
        confirmedByUserId: params.confirmedByUserId,
      })
      .onConflictDoUpdate({
        target: [
          facilityProfessionals.facilityId,
          facilityProfessionals.professionalId,
          facilityProfessionals.occupationCode,
        ],
        set: {
          confirmedAt: now,
          confirmedByUserId: params.confirmedByUserId,
          endedAt: null,
          endedByUserId: null,
          endReason: null,
          updatedAt: now,
        },
      })
      .returning();

    return mapAssociation(association);
  }

  async manuallyAssociate(params: {
    professionalId: string;
    facilityId: string;
    occupationCode?: string;
    confirmedByUserId: string;
  }): Promise<FacilityProfessionalRecord> {
    return this.confirmAssociation(params);
  }

  async endAssociation(params: {
    professionalId: string;
    facilityId: string;
    occupationCode?: string;
    endedByUserId: string;
    endReason: string;
  }): Promise<FacilityProfessionalRecord | null> {
    const existing = await this.findByProfessionalAndFacility(
      params.professionalId,
      params.facilityId,
      params.occupationCode
    );

    if (!existing || existing.endedAt) return null;

    return this.endAssociationById({
      facilityProfessionalId: existing.id,
      endedByUserId: params.endedByUserId,
      endReason: params.endReason,
    });
  }

  async updateAssociationRoles(params: {
    professionalId: string;
    facilityId: string;
    occupationCode?: string;
    data: {
      isPartner?: boolean;
      isPrescriber?: boolean;
      isBuyer?: boolean;
      isDecisionMaker?: boolean;
      relationshipLevel?: RelationshipLevel | null;
      specialtyLabel?: string | null;
      notes?: string | null;
    };
  }): Promise<FacilityProfessionalRecord | null> {
    const existing = await this.findByProfessionalAndFacility(
      params.professionalId,
      params.facilityId,
      params.occupationCode
    );

    if (!existing || existing.endedAt) return null;

    const setData: Partial<typeof facilityProfessionals.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (params.data.isPartner !== undefined) setData.isPartner = params.data.isPartner;
    if (params.data.isPrescriber !== undefined) setData.isPrescriber = params.data.isPrescriber;
    if (params.data.isBuyer !== undefined) setData.isBuyer = params.data.isBuyer;
    if (params.data.isDecisionMaker !== undefined) setData.isDecisionMaker = params.data.isDecisionMaker;
    if (params.data.relationshipLevel !== undefined) {
      setData.relationshipLevel = params.data.relationshipLevel as string | null;
    }
    if (params.data.specialtyLabel !== undefined) setData.specialtyLabel = params.data.specialtyLabel;
    if (params.data.notes !== undefined) setData.notes = params.data.notes;

    const [association] = await db
      .update(facilityProfessionals)
      .set(setData)
      .where(eq(facilityProfessionals.id, existing.id))
      .returning();

    return mapAssociation(association);
  }

  async upsertSourceAssociation(params: {
    professionalId: string;
    facilityId: string;
    occupationCode?: string;
    sourceLastSeenAt: Date;
  }): Promise<{ association: FacilityProfessionalRecord; created: boolean }> {
    const occupationCode = params.occupationCode ?? LEGACY_OCCUPATION_CODE;

    const [existing] = await db
      .select()
      .from(facilityProfessionals)
      .where(
        and(
          eq(facilityProfessionals.facilityId, params.facilityId),
          eq(facilityProfessionals.professionalId, params.professionalId),
          eq(facilityProfessionals.occupationCode, occupationCode)
        )
      )
      .limit(1);

    if (existing) {
      const [association] = await db
        .update(facilityProfessionals)
        .set({
          sourceActive: true,
          sourceLastSeenAt: params.sourceLastSeenAt,
          sourceFirstSeenAt: existing.sourceFirstSeenAt ?? params.sourceLastSeenAt,
          endedAt: null,
          endedByUserId: null,
          endReason: null,
          updatedAt: new Date(),
        })
        .where(eq(facilityProfessionals.id, existing.id))
        .returning();

      return { association: mapAssociation(association), created: false };
    }

    const [association] = await db
      .insert(facilityProfessionals)
      .values({
        professionalId: params.professionalId,
        facilityId: params.facilityId,
        occupationCode,
        sourceActive: true,
        sourceFirstSeenAt: params.sourceLastSeenAt,
        sourceLastSeenAt: params.sourceLastSeenAt,
      })
      .returning();

    return { association: mapAssociation(association), created: true };
  }

  async markSourceInactive(params: {
    facilityProfessionalId: string;
    sourceLastSeenAt: Date;
  }): Promise<FacilityProfessionalRecord> {
    const [association] = await db
      .update(facilityProfessionals)
      .set({
        sourceActive: false,
        sourceLastSeenAt: params.sourceLastSeenAt,
        updatedAt: new Date(),
      })
      .where(eq(facilityProfessionals.id, params.facilityProfessionalId))
      .returning();

    return mapAssociation(association);
  }

  async restoreSourceActive(facilityProfessionalId: string): Promise<FacilityProfessionalRecord> {
    const [association] = await db
      .update(facilityProfessionals)
      .set({ sourceActive: true, updatedAt: new Date() })
      .where(eq(facilityProfessionals.id, facilityProfessionalId))
      .returning();

    return mapAssociation(association);
  }

  async endAssociationById(params: {
    facilityProfessionalId: string;
    endedByUserId: string;
    endReason: string;
  }): Promise<FacilityProfessionalRecord> {
    const [association] = await db
      .update(facilityProfessionals)
      .set({
        endedAt: new Date(),
        endedByUserId: params.endedByUserId,
        endReason: params.endReason,
        sourceActive: false,
        updatedAt: new Date(),
      })
      .where(eq(facilityProfessionals.id, params.facilityProfessionalId))
      .returning();

    return mapAssociation(association);
  }

  async createConfirmedAssociations(params: {
    professionalId: string;
    facilityIds: string[];
    occupationCode?: string;
    confirmedByUserId?: string;
  }): Promise<void> {
    const now = new Date();
    const occupationCode = params.occupationCode ?? LEGACY_OCCUPATION_CODE;

    for (const facilityId of params.facilityIds) {
      await db
        .insert(facilityProfessionals)
        .values({
          professionalId: params.professionalId,
          facilityId,
          occupationCode,
          confirmedAt: now,
          confirmedByUserId: params.confirmedByUserId ?? null,
        })
        .onConflictDoUpdate({
          target: [
            facilityProfessionals.facilityId,
            facilityProfessionals.professionalId,
            facilityProfessionals.occupationCode,
          ],
          set: {
            confirmedAt: now,
            confirmedByUserId: params.confirmedByUserId ?? null,
            endedAt: null,
            endedByUserId: null,
            endReason: null,
            updatedAt: now,
          },
        });
    }
  }
}
