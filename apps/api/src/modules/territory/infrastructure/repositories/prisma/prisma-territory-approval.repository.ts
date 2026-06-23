import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  CreateApprovalInput,
  TerritoryApprovalRecord,
  TerritoryApprovalRepository,
} from "../../../application/interfaces/territory-approval.repository.interface";
import type { TerritoryApprovalStatus } from "@atlasmed/database";

function mapApproval(record: {
  id: string;
  type: TerritoryApprovalRecord["type"];
  status: TerritoryApprovalRecord["status"];
  requesterId: string;
  reviewerId: string | null;
  entityPayload: unknown;
  targetTerritoryId: string | null;
  clinicId: string | null;
  toTerritoryId: string | null;
  reason: string | null;
  resolutionNote: string | null;
  supersededById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): TerritoryApprovalRecord {
  return {
    id: record.id,
    type: record.type,
    status: record.status,
    requesterId: record.requesterId,
    reviewerId: record.reviewerId,
    entityPayload: (record.entityPayload ?? {}) as Record<string, unknown>,
    targetTerritoryId: record.targetTerritoryId,
    clinicId: record.clinicId,
    toTerritoryId: record.toTerritoryId,
    reason: record.reason,
    resolutionNote: record.resolutionNote,
    supersededById: record.supersededById,
    resolvedAt: record.resolvedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class PrismaTerritoryApprovalRepository implements TerritoryApprovalRepository {
  async create(input: CreateApprovalInput): Promise<TerritoryApprovalRecord> {
    const record = await prisma.territoryApprovalRequest.create({
      data: {
        type: input.type,
        requesterId: input.requesterId,
        entityPayload: input.entityPayload,
        targetTerritoryId: input.targetTerritoryId ?? null,
        clinicId: input.clinicId ?? null,
        toTerritoryId: input.toTerritoryId ?? null,
        reason: input.reason ?? null,
      },
    });
    return mapApproval(record);
  }

  async findById(id: string): Promise<TerritoryApprovalRecord | null> {
    const record = await prisma.territoryApprovalRequest.findUnique({ where: { id } });
    return record ? mapApproval(record) : null;
  }

  async findPendingByEntity(params: {
    type: TerritoryApprovalRecord["type"];
    targetTerritoryId?: string | null;
    clinicId?: string | null;
  }): Promise<TerritoryApprovalRecord[]> {
    const records = await prisma.territoryApprovalRequest.findMany({
      where: {
        type: params.type,
        status: "pending",
        targetTerritoryId: params.targetTerritoryId ?? undefined,
        clinicId: params.clinicId ?? undefined,
      },
    });
    return records.map(mapApproval);
  }

  async findPendingByRequesterAndEntity(params: {
    type: TerritoryApprovalRecord["type"];
    requesterId: string;
    targetTerritoryId?: string | null;
    clinicId?: string | null;
  }): Promise<TerritoryApprovalRecord | null> {
    const record = await prisma.territoryApprovalRequest.findFirst({
      where: {
        type: params.type,
        status: "pending",
        requesterId: params.requesterId,
        targetTerritoryId: params.targetTerritoryId ?? undefined,
        clinicId: params.clinicId ?? undefined,
      },
    });
    return record ? mapApproval(record) : null;
  }

  async supersede(id: string, supersededById: string): Promise<void> {
    await prisma.territoryApprovalRequest.update({
      where: { id },
      data: {
        status: "superseded",
        supersededById,
      },
    });
  }

  async resolve(
    id: string,
    data: {
      status: "approved" | "rejected";
      reviewerId: string;
      resolutionNote?: string | null;
    }
  ): Promise<TerritoryApprovalRecord> {
    const record = await prisma.territoryApprovalRequest.update({
      where: { id },
      data: {
        status: data.status,
        reviewerId: data.reviewerId,
        resolutionNote: data.resolutionNote ?? null,
        resolvedAt: new Date(),
      },
    });
    return mapApproval(record);
  }

  async list(params: {
    status?: TerritoryApprovalStatus;
    page: number;
    limit: number;
  }): Promise<{ items: TerritoryApprovalRecord[]; total: number }> {
    const where = params.status ? { status: params.status } : {};
    const skip = (params.page - 1) * params.limit;

    const [items, total] = await Promise.all([
      prisma.territoryApprovalRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: params.limit,
      }),
      prisma.territoryApprovalRequest.count({ where }),
    ]);

    return { items: items.map(mapApproval), total };
  }
}
