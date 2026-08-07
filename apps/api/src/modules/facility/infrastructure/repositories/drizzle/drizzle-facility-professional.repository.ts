import {
  facilityProfessionals,
  professionals,
} from "@atlasmed/database";
import {
  eq,
  and,
  or,
  isNull,
  isNotNull,
  ilike,
  sql,
  asc,
  desc,
  type SQL,
} from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  FacilityProfessionalRecord,
  FacilityProfessionalRepository,
  FacilityProfessionalWithProfessionalRecord,
  FacilityProfessionalView,
} from "../../../application/interfaces/facility-professional.repository.interface";

const LEGACY_OCCUPATION_CODE = "LEGACY";

type AssociationRow = {
  id: number;
  professionalId: number;
  facilityId: number;
  occupationCode: string;
  specialtyLabel: string | null;
  isPartner: boolean;
  isPrescriber: boolean;
  isBuyer: boolean;
  isDecisionMaker: boolean;
  notes: string | null;
  confirmedAt: Date | null;
  confirmedByUserId: number | null;
  endedAt: Date | null;
  endedByUserId: number | null;
  endReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

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
    notes: association.notes,
    confirmedAt: association.confirmedAt,
    confirmedByUserId: association.confirmedByUserId,
    endedAt: association.endedAt,
    endedByUserId: association.endedByUserId,
    endReason: association.endReason,
    createdAt: association.createdAt,
    updatedAt: association.updatedAt,
  };
}

function buildViewConditions(facilityId: number, view: FacilityProfessionalView): SQL[] {
  const base: SQL[] = [
    eq(facilityProfessionals.facilityId, facilityId),
    isNull(facilityProfessionals.endedAt),
  ];

  switch (view) {
    case "confirmed":
      return [...base, isNotNull(facilityProfessionals.confirmedAt)];
    case "all":
      return base;
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
  notes: facilityProfessionals.notes,
  confirmedAt: facilityProfessionals.confirmedAt,
  confirmedByUserId: facilityProfessionals.confirmedByUserId,
  endedAt: facilityProfessionals.endedAt,
  endedByUserId: facilityProfessionals.endedByUserId,
  endReason: facilityProfessionals.endReason,
  createdAt: facilityProfessionals.createdAt,
  updatedAt: facilityProfessionals.updatedAt,
} as const;

export class DrizzleFacilityProfessionalRepository
  implements FacilityProfessionalRepository
{
  async findByProfessionalAndFacility(
    professionalId: number,
    facilityId: number,
    occupationCode?: string
  ): Promise<FacilityProfessionalRecord | null> {
    const conditions: SQL[] = [
      eq(facilityProfessionals.facilityId, facilityId),
      eq(facilityProfessionals.professionalId, professionalId),
    ];

    // When occupation is omitted, match any code (CNES uses MED/etc., not only LEGACY).
    if (occupationCode !== undefined) {
      conditions.push(eq(facilityProfessionals.occupationCode, occupationCode));
    }

    const [association] = await db
      .select()
      .from(facilityProfessionals)
      .where(and(...conditions))
      .orderBy(
        sql`case when ${facilityProfessionals.endedAt} is null then 0 else 1 end`,
        desc(facilityProfessionals.updatedAt)
      )
      .limit(1);

    return association ? mapAssociation(association) : null;
  }

  async findActiveWithProfessional(
    facilityId: number,
    professionalId: number,
    occupationCode?: string
  ) {
    const conditions: SQL[] = [
      eq(facilityProfessionals.facilityId, facilityId),
      eq(facilityProfessionals.professionalId, professionalId),
      isNull(facilityProfessionals.endedAt),
      isNull(professionals.deletedAt),
    ];

    if (occupationCode !== undefined) {
      conditions.push(eq(facilityProfessionals.occupationCode, occupationCode));
    }

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
          imageBlurhash: professionals.imageBlurhash ?? null,
          primarySpecialtyLabel: professionals.primarySpecialtyLabel,
          crmCouncil: professionals.crmCouncil,
          crmNumber: professionals.crmNumber,
          crmState: professionals.crmState,
          favoriteTeam: professionals.favoriteTeam,
          favoriteSport: professionals.favoriteSport,
          languages: professionals.languages,
          hobbies: professionals.hobbies,
          createdAt: professionals.createdAt,
          updatedAt: professionals.updatedAt,
        },
      })
      .from(facilityProfessionals)
      .innerJoin(professionals, eq(facilityProfessionals.professionalId, professionals.id))
      .where(and(...conditions))
      .orderBy(desc(facilityProfessionals.updatedAt))
      .limit(1);

    if (!row) return null;

    return {
      association: mapAssociation(row),
      professional: row.professional,
    };
  }

  async findActiveByFacilityWithProfessionals(params: {
    facilityId: number;
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

    const [rows, countRows] = await Promise.all([
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
            mobilePhone: professionals.mobilePhone,
            landlinePhone: professionals.landlinePhone,
            email: professionals.email,
            birthDate: professionals.birthDate,
            favoriteTeam: professionals.favoriteTeam,
            hobbies: professionals.hobbies,
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
      total: countRows[0]?.count ?? 0,
    };
  }

  async confirmAssociation(params: {
    professionalId: number;
    facilityId: number;
    occupationCode?: string;
    confirmedByUserId: number;
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

    return mapAssociation(association!);
  }

  async manuallyAssociate(params: {
    professionalId: number;
    facilityId: number;
    occupationCode?: string;
    confirmedByUserId: number;
  }): Promise<FacilityProfessionalRecord> {
    return this.confirmAssociation(params);
  }

  async endAssociation(params: {
    professionalId: number;
    facilityId: number;
    occupationCode?: string;
    endedByUserId: number;
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
    professionalId: number;
    facilityId: number;
    occupationCode?: string;
    data: {
      isPartner?: boolean;
      isPrescriber?: boolean;
      isBuyer?: boolean;
      isDecisionMaker?: boolean;
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
    if (params.data.specialtyLabel !== undefined) setData.specialtyLabel = params.data.specialtyLabel;
    if (params.data.notes !== undefined) setData.notes = params.data.notes;

    const [association] = await db
      .update(facilityProfessionals)
      .set(setData)
      .where(eq(facilityProfessionals.id, existing.id))
      .returning();

    return mapAssociation(association!);
  }

  async endAssociationById(params: {
    facilityProfessionalId: number;
    endedByUserId: number;
    endReason: string;
  }): Promise<FacilityProfessionalRecord> {
    const [association] = await db
      .update(facilityProfessionals)
      .set({
        endedAt: new Date(),
        endedByUserId: params.endedByUserId,
        endReason: params.endReason,
        updatedAt: new Date(),
      })
      .where(eq(facilityProfessionals.id, params.facilityProfessionalId))
      .returning();

    return mapAssociation(association!);
  }

  async createConfirmedAssociations(params: {
    professionalId: number;
    facilityIds: number[];
    occupationCode?: string;
    confirmedByUserId?: number;
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
