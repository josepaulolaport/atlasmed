import type { RelationshipLevel } from "@atlasmed/database";
import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  FacilityProfessionalRecord,
  FacilityProfessionalRepository,
  FacilityProfessionalWithProfessionalRecord,
  FacilityProfessionalView,
} from "../../../application/interfaces/facility-professional.repository.interface";

const LEGACY_OCCUPATION_CODE = "LEGACY";

function compositeWhere(professionalId: string, facilityId: string) {
  return {
    facilityId_professionalId_occupationCode: {
      facilityId,
      professionalId,
      occupationCode: LEGACY_OCCUPATION_CODE,
    },
  };
}

function mapAssociation(association: {
  id: string;
  professionalId: string;
  facilityId: string;
  occupationCode: string;
  specialtyLabel: string | null;
  isPartner: boolean;
  isPrescriber: boolean;
  isBuyer: boolean;
  isDecisionMaker: boolean;
  relationshipLevel: RelationshipLevel | null;
  notes: string | null;
  sourceActive: boolean;
  sourceFirstSeenAt: Date | null;
  sourceLastSeenAt: Date | null;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
  endedAt: Date | null;
  endedByUserId: string | null;
  endReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): FacilityProfessionalRecord {
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
    relationshipLevel: association.relationshipLevel,
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

function buildViewWhere(facilityId: string, view: FacilityProfessionalView) {
  const base = { facilityId, endedAt: null };

  switch (view) {
    case "source":
      return { ...base, sourceActive: true };
    case "confirmed":
      return { ...base, confirmedAt: { not: null } };
    case "pending":
      return { ...base, sourceActive: true, confirmedAt: null };
    case "all":
      return {
        ...base,
        OR: [{ sourceActive: true }, { confirmedAt: { not: null } }],
      };
  }
}

export class PrismaFacilityProfessionalRepository
  implements FacilityProfessionalRepository
{
  async findByProfessionalAndFacility(
    professionalId: string,
    facilityId: string,
    occupationCode = LEGACY_OCCUPATION_CODE
  ): Promise<FacilityProfessionalRecord | null> {
    const association = await prisma.facilityProfessional.findUnique({
      where: {
        facilityId_professionalId_occupationCode: {
          facilityId,
          professionalId,
          occupationCode,
        },
      },
    });

    return association ? mapAssociation(association) : null;
  }

  async findActiveWithProfessional(
    facilityId: string,
    professionalId: string,
    occupationCode = LEGACY_OCCUPATION_CODE
  ) {
    const association = await prisma.facilityProfessional.findFirst({
      where: {
        facilityId,
        professionalId,
        occupationCode,
        endedAt: null,
        professional: { deletedAt: null },
      },
      include: {
        professional: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fullName: true,
            socialName: true,
            taxId: true,
            birthDate: true,
            mobilePhone: true,
            landlinePhone: true,
            email: true,
            websiteUrl: true,
            imageUrl: true,
            primarySpecialtyLabel: true,
            crmCouncil: true,
            crmNumber: true,
            crmState: true,
            favoriteTeam: true,
            favoriteSport: true,
            hobbies: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!association) {
      return null;
    }

    return {
      association: mapAssociation(association),
      professional: association.professional,
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
    const where = {
      ...buildViewWhere(params.facilityId, params.view),
      professional: {
        deletedAt: null,
        ...(params.search
          ? {
              OR: [
                {
                  firstName: {
                    contains: params.search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  lastName: {
                    contains: params.search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  primarySpecialtyLabel: {
                    contains: params.search,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
      },
    };

    const skip = (params.page - 1) * params.limit;

    const [associations, total] = await Promise.all([
      prisma.facilityProfessional.findMany({
        where,
        include: {
          professional: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              fullName: true,
              primarySpecialtyLabel: true,
              crmNumber: true,
              crmState: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: [
          { professional: { lastName: "asc" } },
          { professional: { firstName: "asc" } },
        ],
        skip,
        take: params.limit,
      }),
      prisma.facilityProfessional.count({ where }),
    ]);

    return {
      associations: associations.map((row) => ({
        ...mapAssociation(row),
        professional: {
          id: row.professional.id,
          firstName: row.professional.firstName,
          lastName: row.professional.lastName,
          fullName: row.professional.fullName,
          specialty: row.professional.primarySpecialtyLabel,
          crmNumber: row.professional.crmNumber,
          crmState: row.professional.crmState,
          createdAt: row.professional.createdAt,
          updatedAt: row.professional.updatedAt,
        },
      })),
      total,
    };
  }

  async findActiveSourceAssociationsByProvider(sourceProvider: string): Promise<
    Array<{
      association: FacilityProfessionalRecord;
      professionalExternalSourceId: string;
      facilityExternalSourceId: string;
    }>
  > {
    const rows = await prisma.facilityProfessional.findMany({
      where: {
        endedAt: null,
        sourceActive: true,
        professional: { sourceProvider, sourceTracked: true },
        facility: { sourceProvider, sourceTracked: true },
      },
      include: {
        professional: { select: { externalSourceId: true } },
        facility: { select: { externalSourceId: true } },
      },
    });

    return rows
      .filter(
        (row) => row.professional.externalSourceId && row.facility.externalSourceId
      )
      .map((row) => ({
        association: mapAssociation(row),
        professionalExternalSourceId: row.professional.externalSourceId!,
        facilityExternalSourceId: row.facility.externalSourceId!,
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
    const association = await prisma.facilityProfessional.upsert({
      where: compositeWhere(params.professionalId, params.facilityId),
      create: {
        professionalId: params.professionalId,
        facilityId: params.facilityId,
        occupationCode,
        confirmedAt: now,
        confirmedByUserId: params.confirmedByUserId,
      },
      update: {
        confirmedAt: now,
        confirmedByUserId: params.confirmedByUserId,
        endedAt: null,
        endedByUserId: null,
        endReason: null,
      },
    });

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

    if (!existing || existing.endedAt) {
      return null;
    }

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

    if (!existing || existing.endedAt) {
      return null;
    }

    const association = await prisma.facilityProfessional.update({
      where: { id: existing.id },
      data: {
        ...(params.data.isPartner !== undefined
          ? { isPartner: params.data.isPartner }
          : {}),
        ...(params.data.isPrescriber !== undefined
          ? { isPrescriber: params.data.isPrescriber }
          : {}),
        ...(params.data.isBuyer !== undefined ? { isBuyer: params.data.isBuyer } : {}),
        ...(params.data.isDecisionMaker !== undefined
          ? { isDecisionMaker: params.data.isDecisionMaker }
          : {}),
        ...(params.data.relationshipLevel !== undefined
          ? { relationshipLevel: params.data.relationshipLevel }
          : {}),
        ...(params.data.specialtyLabel !== undefined
          ? { specialtyLabel: params.data.specialtyLabel }
          : {}),
        ...(params.data.notes !== undefined ? { notes: params.data.notes } : {}),
      },
    });

    return mapAssociation(association);
  }

  async upsertSourceAssociation(params: {
    professionalId: string;
    facilityId: string;
    occupationCode?: string;
    sourceLastSeenAt: Date;
  }): Promise<{ association: FacilityProfessionalRecord; created: boolean }> {
    const occupationCode = params.occupationCode ?? LEGACY_OCCUPATION_CODE;
    const existing = await prisma.facilityProfessional.findUnique({
      where: {
        facilityId_professionalId_occupationCode: {
          facilityId: params.facilityId,
          professionalId: params.professionalId,
          occupationCode,
        },
      },
    });

    if (existing) {
      const association = await prisma.facilityProfessional.update({
        where: { id: existing.id },
        data: {
          sourceActive: true,
          sourceLastSeenAt: params.sourceLastSeenAt,
          sourceFirstSeenAt: existing.sourceFirstSeenAt ?? params.sourceLastSeenAt,
          endedAt: null,
          endedByUserId: null,
          endReason: null,
        },
      });

      return { association: mapAssociation(association), created: false };
    }

    const association = await prisma.facilityProfessional.create({
      data: {
        professionalId: params.professionalId,
        facilityId: params.facilityId,
        occupationCode,
        sourceActive: true,
        sourceFirstSeenAt: params.sourceLastSeenAt,
        sourceLastSeenAt: params.sourceLastSeenAt,
      },
    });

    return { association: mapAssociation(association), created: true };
  }

  async markSourceInactive(params: {
    facilityProfessionalId: string;
    sourceLastSeenAt: Date;
  }): Promise<FacilityProfessionalRecord> {
    const association = await prisma.facilityProfessional.update({
      where: { id: params.facilityProfessionalId },
      data: {
        sourceActive: false,
        sourceLastSeenAt: params.sourceLastSeenAt,
      },
    });

    return mapAssociation(association);
  }

  async restoreSourceActive(facilityProfessionalId: string): Promise<FacilityProfessionalRecord> {
    const association = await prisma.facilityProfessional.update({
      where: { id: facilityProfessionalId },
      data: { sourceActive: true },
    });

    return mapAssociation(association);
  }

  async endAssociationById(params: {
    facilityProfessionalId: string;
    endedByUserId: string;
    endReason: string;
  }): Promise<FacilityProfessionalRecord> {
    const association = await prisma.facilityProfessional.update({
      where: { id: params.facilityProfessionalId },
      data: {
        endedAt: new Date(),
        endedByUserId: params.endedByUserId,
        endReason: params.endReason,
        sourceActive: false,
      },
    });

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
      await prisma.facilityProfessional.upsert({
        where: {
          facilityId_professionalId_occupationCode: {
            facilityId,
            professionalId: params.professionalId,
            occupationCode,
          },
        },
        create: {
          professionalId: params.professionalId,
          facilityId,
          occupationCode,
          confirmedAt: now,
          confirmedByUserId: params.confirmedByUserId ?? null,
        },
        update: {
          confirmedAt: now,
          confirmedByUserId: params.confirmedByUserId ?? null,
          endedAt: null,
          endedByUserId: null,
          endReason: null,
        },
      });
    }
  }
}
