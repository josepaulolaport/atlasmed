import { db } from "../../../../../infrastructure/database/db";
import { territoryApprovalRequests, territoryApprovalStatusEnum } from "@atlasmed/database";
import { eq, and, desc, sql } from "drizzle-orm";
import type {
  CreateApprovalInput,
  TerritoryApprovalRecord,
  TerritoryApprovalRepository,
} from "../../../application/interfaces/territory-approval.repository.interface";

type TerritoryApprovalStatus = typeof territoryApprovalStatusEnum.enumValues[number];

function mapApproval(record: {
  id: number;
  type: TerritoryApprovalRecord["type"];
  status: TerritoryApprovalRecord["status"];
  requesterId: number;
  reviewerId: number | null;
  entityPayload: unknown;
  targetTerritoryId: number | null;
  facilityId: number | null;
  toTerritoryId: number | null;
  reason: string | null;
  resolutionNote: string | null;
  supersededById: number | null;
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
    facilityId: record.facilityId,
    toTerritoryId: record.toTerritoryId,
    reason: record.reason,
    resolutionNote: record.resolutionNote,
    supersededById: record.supersededById,
    resolvedAt: record.resolvedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class DrizzleTerritoryApprovalRepository implements TerritoryApprovalRepository {
  async create(input: CreateApprovalInput): Promise<TerritoryApprovalRecord> {
    const [record] = await db
      .insert(territoryApprovalRequests)
      .values({
        type: input.type,
        requesterId: input.requesterId,
        entityPayload: input.entityPayload,
        targetTerritoryId: input.targetTerritoryId ?? null,
        facilityId: input.facilityId ?? null,
        toTerritoryId: input.toTerritoryId ?? null,
        reason: input.reason ?? null,
      })
      .returning();
    return mapApproval(record!);
  }

  async findById(id: number): Promise<TerritoryApprovalRecord | null> {
    const rows = await db
      .select()
      .from(territoryApprovalRequests)
      .where(eq(territoryApprovalRequests.id, id));
    return rows[0] ? mapApproval(rows[0]) : null;
  }

  async findPendingByEntity(params: {
    type: TerritoryApprovalRecord["type"];
    targetTerritoryId?: number | null;
    facilityId?: number | null;
  }): Promise<TerritoryApprovalRecord[]> {
    const conditions = [
      eq(territoryApprovalRequests.type, params.type),
      eq(territoryApprovalRequests.status, "pending"),
      ...(params.targetTerritoryId != null
        ? [eq(territoryApprovalRequests.targetTerritoryId, params.targetTerritoryId)]
        : []),
      ...(params.facilityId != null
        ? [eq(territoryApprovalRequests.facilityId, params.facilityId)]
        : []),
    ];

    const records = await db
      .select()
      .from(territoryApprovalRequests)
      .where(and(...conditions));
    return records.map(mapApproval);
  }

  async findPendingByRequesterAndEntity(params: {
    type: TerritoryApprovalRecord["type"];
    requesterId: number;
    targetTerritoryId?: number | null;
    facilityId?: number | null;
  }): Promise<TerritoryApprovalRecord | null> {
    const conditions = [
      eq(territoryApprovalRequests.type, params.type),
      eq(territoryApprovalRequests.status, "pending"),
      eq(territoryApprovalRequests.requesterId, params.requesterId),
      ...(params.targetTerritoryId != null
        ? [eq(territoryApprovalRequests.targetTerritoryId, params.targetTerritoryId)]
        : []),
      ...(params.facilityId != null
        ? [eq(territoryApprovalRequests.facilityId, params.facilityId)]
        : []),
    ];

    const rows = await db
      .select()
      .from(territoryApprovalRequests)
      .where(and(...conditions))
      .limit(1);
    return rows[0] ? mapApproval(rows[0]) : null;
  }

  async supersede(id: number, supersededById: number): Promise<void> {
    await db
      .update(territoryApprovalRequests)
      .set({ status: "superseded", supersededById, updatedAt: new Date() })
      .where(eq(territoryApprovalRequests.id, id));
  }

  async resolve(
    id: number,
    data: {
      status: "approved" | "rejected";
      reviewerId: number;
      resolutionNote?: string | null;
    }
  ): Promise<TerritoryApprovalRecord> {
    const [record] = await db
      .update(territoryApprovalRequests)
      .set({
        status: data.status,
        reviewerId: data.reviewerId,
        resolutionNote: data.resolutionNote ?? null,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(territoryApprovalRequests.id, id))
      .returning();
    return mapApproval(record!);
  }

  async list(params: {
    status?: TerritoryApprovalStatus;
    page: number;
    limit: number;
  }): Promise<{ items: TerritoryApprovalRecord[]; total: number }> {
    const where = params.status
      ? eq(territoryApprovalRequests.status, params.status)
      : undefined;

    const skip = (params.page - 1) * params.limit;

    const [items, countRows] = await Promise.all([
      db
        .select()
        .from(territoryApprovalRequests)
        .where(where)
        .orderBy(desc(territoryApprovalRequests.createdAt))
        .offset(skip)
        .limit(params.limit),
      db
        .select({ count: sql<number>`count(*)` })
        .from(territoryApprovalRequests)
        .where(where),
    ]);

    return { items: items.map(mapApproval), total: Number(countRows[0]?.count ?? 0) };
  }
}
