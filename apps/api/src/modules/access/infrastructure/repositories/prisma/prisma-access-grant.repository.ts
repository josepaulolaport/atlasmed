import { eq, and, or, isNull, isNotNull, gt, lt } from "drizzle-orm";
import { permissions } from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import type { AccessGrantRecord } from "@atlasmed/access";
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
    conditions: row.conditions ? (row.conditions as Record<string, unknown>) : undefined,
    expiresAt: row.expiresAt ?? undefined,
  };
}

export class PrismaAccessGrantRepository implements AccessGrantRepository {
  async findActiveByUserId(userId: string): Promise<AccessGrantRecord[]> {
    const rows = await db
      .select({
        id: permissions.id,
        resource: permissions.resource,
        resourceId: permissions.resourceId,
        action: permissions.action,
        conditions: permissions.conditions,
        expiresAt: permissions.expiresAt,
      })
      .from(permissions)
      .where(
        and(
          eq(permissions.userId, userId),
          or(isNull(permissions.expiresAt), gt(permissions.expiresAt, new Date())),
        ),
      );

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
    const [row] = await db
      .insert(permissions)
      .values({
        userId: params.userId,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        action: params.action,
        conditions: params.conditions ? (params.conditions as object) : undefined,
        grantedBy: params.grantedBy,
        expiresAt: params.expiresAt ?? null,
      })
      .returning({
        id: permissions.id,
        resource: permissions.resource,
        resourceId: permissions.resourceId,
        action: permissions.action,
        conditions: permissions.conditions,
        expiresAt: permissions.expiresAt,
      });

    return mapRow(row!);
  }

  async deleteMany(params: {
    userId: string;
    resource: string;
    resourceId?: string;
    action: string;
  }): Promise<number> {
    const conditions = [
      eq(permissions.userId, params.userId),
      eq(permissions.resource, params.resource),
      eq(permissions.action, params.action),
    ];

    if (params.resourceId !== undefined) {
      conditions.push(eq(permissions.resourceId, params.resourceId) as any);
    }

    const result = await db
      .delete(permissions)
      .where(and(...conditions))
      .returning({ id: permissions.id });

    return result.length;
  }

  async deleteExpired(): Promise<number> {
    const result = await db
      .delete(permissions)
      .where(and(isNotNull(permissions.expiresAt), lt(permissions.expiresAt, new Date())))
      .returning({ id: permissions.id });

    return result.length;
  }
}
