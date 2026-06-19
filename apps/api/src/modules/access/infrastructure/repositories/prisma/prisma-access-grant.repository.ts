import type { AccessGrantRecord } from "@atlasmed/access";
import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type { AccessGrantRepository } from "../../../application/interfaces/access-grant.repository.interface";

function mapRow(row: {
  id: string;
  resource: string;
  resourceId: string | null;
  action: string;
  conditions: unknown;
  expiresAt: Date | null;
}): AccessGrantRecord {
  return {
    id: row.id,
    resource: row.resource,
    resourceId: row.resourceId,
    action: row.action,
    conditions: row.conditions
      ? (row.conditions as Record<string, unknown>)
      : undefined,
    expiresAt: row.expiresAt ?? undefined,
  };
}

export class PrismaAccessGrantRepository implements AccessGrantRepository {
  async findActiveByUserId(userId: string): Promise<AccessGrantRecord[]> {
    const rows = await prisma.permission.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        resource: true,
        resourceId: true,
        action: true,
        conditions: true,
        expiresAt: true,
      },
    });

    return rows.map(mapRow);
  }

  async create(params: {
    userId: string;
    resource: string;
    resourceId?: string;
    action: string;
    conditions?: Record<string, unknown>;
    grantedBy: string;
    expiresAt?: Date;
  }): Promise<AccessGrantRecord> {
    const row = await prisma.permission.create({
      data: {
        userId: params.userId,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        action: params.action,
        conditions: params.conditions ? (params.conditions as object) : undefined,
        grantedBy: params.grantedBy,
        expiresAt: params.expiresAt ?? null,
      },
      select: {
        id: true,
        resource: true,
        resourceId: true,
        action: true,
        conditions: true,
        expiresAt: true,
      },
    });

    return mapRow(row);
  }

  async deleteMany(params: {
    userId: string;
    resource: string;
    resourceId?: string;
    action: string;
  }): Promise<number> {
    const result = await prisma.permission.deleteMany({
      where: {
        userId: params.userId,
        resource: params.resource,
        action: params.action,
        ...(params.resourceId !== undefined && {
          resourceId: params.resourceId,
        }),
      },
    });

    return result.count;
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.permission.deleteMany({
      where: {
        expiresAt: {
          not: null,
          lt: new Date(),
        },
      },
    });

    return result.count;
  }
}
