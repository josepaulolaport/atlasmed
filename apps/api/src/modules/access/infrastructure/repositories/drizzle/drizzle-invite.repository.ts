import { eq, and, or, isNull, inArray, gt, desc, lt, sql } from "drizzle-orm";
import {
  users,
  roles,
  invitations,
  userTerritoryAssignments,
  userVerticalAssignments,
  invitationVerticalAssignments,
  invitationTerritoryAssignments,
} from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import { InvalidInviteError, ResourceConflictError, ResourceNotFoundError } from "../../../../../shared/errors";

import type {
  InviteRepository,
  CreateInviteParams,
  AcceptInviteTransactionParams,
  AcceptInviteTransactionResult,
} from "../../../application/interfaces/invite.repository.interface";

async function fetchInviteWithRole(inviteId: string) {
  const [row] = await db
    .select()
    .from(invitations)
    .leftJoin(roles, eq(invitations.roleId, roles.id))
    .where(eq(invitations.id, inviteId))
    .limit(1);

  if (!row) return null;
  return { ...row.invitations, role: row.roles! };
}

export class DrizzleInviteRepository implements InviteRepository {
  async create(params: CreateInviteParams) {
    await this.cleanupExpired();

    const inviteId = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(invitations)
        .values({
          email: params.email ?? null,
          phoneNumber: params.phoneNumber ?? null,
          tokenHash: params.tokenHash,
          roleId: params.roleId,
          invitedByUserId: params.invitedByUserId,
          firstName: params.firstName ?? null,
          lastName: params.lastName ?? null,
          birthDate: params.birthDate ?? null,
          managerId: params.managerId ?? null,
          managerTerritoryId: params.managerTerritoryId ?? null,
          repTerritoryId: params.repTerritoryId ?? null,
          expiresAt: params.expiresAt,
        })
        .returning({ id: invitations.id });

      const id = inserted!.id;
      const verticals = params.verticalAssignments ?? [];

      for (const vertical of verticals) {
        await tx.insert(invitationVerticalAssignments).values({
          invitationId: id,
          verticalId: vertical.verticalId,
          managerId: vertical.managerId ?? null,
        });

        for (const territoryId of vertical.territoryIds) {
          await tx.insert(invitationTerritoryAssignments).values({
            invitationId: id,
            verticalId: vertical.verticalId,
            territoryId,
          });
        }
      }

      return id;
    });

    const result = await fetchInviteWithRole(inviteId);
    return result!;
  }

  async findValidByTokenHash(tokenHash: string) {
    const [row] = await db
      .select()
      .from(invitations)
      .leftJoin(roles, eq(invitations.roleId, roles.id))
      .where(
        and(
          eq(invitations.tokenHash, tokenHash),
          eq(invitations.status, "PENDING"),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!row) return null;
    return { ...row.invitations, role: row.roles! };
  }

  async findById(inviteId: string) {
    return fetchInviteWithRole(inviteId);
  }

  async findStagedVerticalAssignments(invitationIds: string[]) {
    if (invitationIds.length === 0) return [];

    const verticalRows = await db
      .select({
        invitationId: invitationVerticalAssignments.invitationId,
        verticalId: invitationVerticalAssignments.verticalId,
        managerId: invitationVerticalAssignments.managerId,
      })
      .from(invitationVerticalAssignments)
      .where(inArray(invitationVerticalAssignments.invitationId, invitationIds));

    const territoryRows = await db
      .select({
        invitationId: invitationTerritoryAssignments.invitationId,
        verticalId: invitationTerritoryAssignments.verticalId,
        territoryId: invitationTerritoryAssignments.territoryId,
      })
      .from(invitationTerritoryAssignments)
      .where(inArray(invitationTerritoryAssignments.invitationId, invitationIds));

    const territoriesByKey = new Map<string, string[]>();
    for (const row of territoryRows) {
      const key = `${row.invitationId}:${row.verticalId}`;
      const list = territoriesByKey.get(key) ?? [];
      list.push(row.territoryId);
      territoriesByKey.set(key, list);
    }

    return verticalRows.map((row) => ({
      invitationId: row.invitationId,
      verticalId: row.verticalId,
      managerId: row.managerId ?? null,
      territoryIds:
        territoriesByKey.get(`${row.invitationId}:${row.verticalId}`) ?? [],
    }));
  }

  async updatePending(params: {
    inviteId: string;
    email?: string | undefined;
    phoneNumber?: string | null | undefined;
    roleId?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    birthDate?: Date | undefined;
    managerId?: string | null | undefined;
    managerTerritoryId?: string | null | undefined;
    repTerritoryId?: string | null | undefined;
    verticalAssignments?: Array<{
      verticalId: string;
      managerId?: string | undefined;
      territoryIds: string[];
    }>;
  }) {
    await db.transaction(async (tx) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (params.email !== undefined) updates.email = params.email;
      if (params.phoneNumber !== undefined) updates.phoneNumber = params.phoneNumber;
      if (params.roleId !== undefined) updates.roleId = params.roleId;
      if (params.firstName !== undefined) updates.firstName = params.firstName;
      if (params.lastName !== undefined) updates.lastName = params.lastName;
      if (params.birthDate !== undefined) updates.birthDate = params.birthDate;
      if (params.managerId !== undefined) updates.managerId = params.managerId;
      if (params.managerTerritoryId !== undefined) {
        updates.managerTerritoryId = params.managerTerritoryId;
      }
      if (params.repTerritoryId !== undefined) {
        updates.repTerritoryId = params.repTerritoryId;
      }

      await tx
        .update(invitations)
        .set(updates)
        .where(eq(invitations.id, params.inviteId));

      if (params.verticalAssignments !== undefined) {
        await tx
          .delete(invitationTerritoryAssignments)
          .where(
            eq(invitationTerritoryAssignments.invitationId, params.inviteId),
          );
        await tx
          .delete(invitationVerticalAssignments)
          .where(eq(invitationVerticalAssignments.invitationId, params.inviteId));

        for (const vertical of params.verticalAssignments) {
          await tx.insert(invitationVerticalAssignments).values({
            invitationId: params.inviteId,
            verticalId: vertical.verticalId,
            managerId: vertical.managerId ?? null,
          });
          for (const territoryId of vertical.territoryIds) {
            await tx.insert(invitationTerritoryAssignments).values({
              invitationId: params.inviteId,
              verticalId: vertical.verticalId,
              territoryId,
            });
          }
        }
      }
    });

    const result = await fetchInviteWithRole(params.inviteId);
    return result!;
  }

  async findByEmailOrPhone(email?: string | undefined, phoneNumber?: string | undefined) {
    if (!email && !phoneNumber) {
      return null;
    }

    const orConditions = [];
    if (email) orConditions.push(eq(invitations.email, email as any));
    if (phoneNumber) orConditions.push(eq(invitations.phoneNumber, phoneNumber as any));

    const [row] = await db
      .select()
      .from(invitations)
      .leftJoin(roles, eq(invitations.roleId, roles.id))
      .where(
        and(
          or(...orConditions),
          eq(invitations.status, "PENDING"),
          isNull(invitations.revokedAt),
        ),
      )
      .limit(1);

    if (!row) return null;
    return { ...row.invitations, role: row.roles! };
  }

  async findAll(params?: {
    status?: string;
    page?: number;
    limit?: number;
    invitedByUserId?: string;
  }) {
    await this.cleanupExpired();

    const page = params?.page ?? 1;
    const limit = Math.min(params?.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const conditions = [];

    if (params?.status) {
      conditions.push(eq(invitations.status, params.status as any));
    }

    if (params?.invitedByUserId) {
      conditions.push(eq(invitations.invitedByUserId, params.invitedByUserId));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [invitationRows, countRows] = await Promise.all([
      db
        .select()
        .from(invitations)
        .leftJoin(roles, eq(invitations.roleId, roles.id))
        .where(where)
        .orderBy(desc(invitations.createdAt))
        .offset(skip)
        .limit(limit),
      db.select({ count: sql<number>`count(*)::int` }).from(invitations).where(where),
    ]);

    return {
      invitations: invitationRows.map((row) => ({ ...row.invitations, role: row.roles! })),
      total: countRows[0]!.count,
    };
  }

  async markAccepted(inviteId: string, _userId: string) {
    await db
      .update(invitations)
      .set({
        status: "ACCEPTED",
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invitations.id, inviteId));
  }

  async revoke(inviteId: string) {
    await db
      .update(invitations)
      .set({
        status: "REVOKED",
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invitations.id, inviteId));
  }

  async regenerateToken(inviteId: string, params: { tokenHash: string; expiresAt: Date }) {
    await db
      .update(invitations)
      .set({
        tokenHash: params.tokenHash,
        expiresAt: params.expiresAt,
        resendCount: sql`${invitations.resendCount} + 1`,
        lastResendAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invitations.id, inviteId));

    const result = await fetchInviteWithRole(inviteId);
    return result!;
  }

  async cleanupExpired(): Promise<number> {
    const result = await db
      .update(invitations)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(and(eq(invitations.status, "PENDING"), lt(invitations.expiresAt, new Date())))
      .returning({ id: invitations.id });

    return result.length;
  }

  async acceptInviteTransaction(
    params: AcceptInviteTransactionParams,
  ): Promise<AcceptInviteTransactionResult> {
    return await db.transaction(async (tx) => {
      const [inviteLock] = await tx
        .select({
          id: invitations.id,
          status: invitations.status,
          expiresAt: invitations.expiresAt,
          email: invitations.email,
          phoneNumber: invitations.phoneNumber,
          roleId: invitations.roleId,
          firstName: invitations.firstName,
          lastName: invitations.lastName,
          birthDate: invitations.birthDate,
          managerId: invitations.managerId,
          managerTerritoryId: invitations.managerTerritoryId,
          repTerritoryId: invitations.repTerritoryId,
          invitedByUserId: invitations.invitedByUserId,
        })
        .from(invitations)
        .where(eq(invitations.tokenHash, params.tokenHash))
        .for("update")
        .limit(1);

      if (!inviteLock) {
        throw new InvalidInviteError();
      }

      if (inviteLock.status !== "PENDING") {
        throw new InvalidInviteError("Invite has already been used");
      }

      if (inviteLock.expiresAt < new Date()) {
        throw new InvalidInviteError("Invite has expired");
      }

      if (inviteLock.email && inviteLock.email !== params.email) {
        throw new InvalidInviteError("Email does not match invitation");
      }

      if (inviteLock.phoneNumber && inviteLock.phoneNumber !== params.phoneNumber) {
        throw new InvalidInviteError("Phone number does not match invitation");
      }

      const orConditions = [
        eq(users.email, params.email),
        eq(users.username, params.username),
      ];
      if (params.phoneNumber) {
        orConditions.push(eq(users.phoneNumber, params.phoneNumber as any));
      }

      const [existingUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(or(...orConditions))
        .limit(1);

      if (existingUser) {
        throw new ResourceConflictError("User", "email or username already taken");
      }

      const [newUserRow] = await tx
        .insert(users)
        .values({
          email: params.email,
          username: params.username,
          phoneNumber: params.phoneNumber ?? null,
          passwordHash: params.passwordHash,
          roleId: inviteLock.roleId,
          firstName: params.firstName,
          lastName: params.lastName,
          birthDate: params.birthDate,
          managerId: inviteLock.managerId ?? null,
          emailVerified: Boolean(inviteLock.email),
          phoneVerified: Boolean(inviteLock.phoneNumber),
          status: "ACTIVE",
        })
        .returning();

      const [userRow] = await tx
        .select()
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.id, newUserRow!.id))
        .limit(1);

      const user = { ...userRow!.users, role: userRow!.roles! };

      const stagedVerticals = await tx
        .select()
        .from(invitationVerticalAssignments)
        .where(eq(invitationVerticalAssignments.invitationId, inviteLock.id));

      const stagedTerritories = await tx
        .select()
        .from(invitationTerritoryAssignments)
        .where(eq(invitationTerritoryAssignments.invitationId, inviteLock.id));

      if (stagedTerritories.length > 0 || stagedVerticals.length > 0) {
        const seenTerritoryIds = new Set<string>();
        for (const row of stagedTerritories) {
          if (seenTerritoryIds.has(row.territoryId)) continue;
          seenTerritoryIds.add(row.territoryId);
          await tx.insert(userTerritoryAssignments).values({
            userId: user.id,
            territoryId: row.territoryId,
            assignedBy: inviteLock.invitedByUserId,
          });
        }

        for (const vertical of stagedVerticals) {
          await tx
            .insert(userVerticalAssignments)
            .values({
              userId: user.id,
              verticalId: vertical.verticalId,
              managerId: vertical.managerId ?? null,
              assignedByUserId: inviteLock.invitedByUserId,
            })
            .onConflictDoNothing();
        }

        const primaryManager =
          stagedVerticals.map((v) => v.managerId).find((id): id is string => Boolean(id)) ??
          inviteLock.managerId;
        if (primaryManager && user.managerId !== primaryManager) {
          await tx
            .update(users)
            .set({ managerId: primaryManager, updatedAt: new Date() })
            .where(eq(users.id, user.id));
          user.managerId = primaryManager;
        }
      } else {
        const assignedTerritoryIds: string[] = [];

        if (inviteLock.managerTerritoryId) {
          await tx.insert(userTerritoryAssignments).values({
            userId: user.id,
            territoryId: inviteLock.managerTerritoryId,
            assignedBy: inviteLock.invitedByUserId,
          });
          assignedTerritoryIds.push(inviteLock.managerTerritoryId);
        }

        if (inviteLock.repTerritoryId) {
          await tx.insert(userTerritoryAssignments).values({
            userId: user.id,
            territoryId: inviteLock.repTerritoryId,
            assignedBy: inviteLock.invitedByUserId,
          });
          assignedTerritoryIds.push(inviteLock.repTerritoryId);
        }
      }

      await tx
        .update(invitations)
        .set({
          status: "ACCEPTED",
          acceptedAt: new Date(),
          acceptedByUserId: user.id,
          updatedAt: new Date(),
        })
        .where(eq(invitations.id, inviteLock.id));

      const [inviteRow] = await tx
        .select()
        .from(invitations)
        .leftJoin(roles, eq(invitations.roleId, roles.id))
        .where(eq(invitations.id, inviteLock.id))
        .limit(1);

      if (!inviteRow) throw new ResourceNotFoundError("Invitation", inviteLock.id);

      const invite = { ...inviteRow.invitations, role: inviteRow.roles! };

      return { user, invite };
    });
  }
}
