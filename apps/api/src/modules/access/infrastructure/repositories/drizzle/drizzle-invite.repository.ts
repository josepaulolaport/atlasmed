import { eq, and, or, isNull, inArray, gt, desc, lt, sql } from "drizzle-orm";
import {
  users,
  roles,
  invitations,
  territories,
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

async function fetchInviteWithRole(inviteId: number) {
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
          expiresAt: params.expiresAt,
        })
        .returning({ id: invitations.id });

      const id = inserted!.id;
      const verticals = params.verticalAssignments ?? [];

      for (const vertical of verticals) {
        await tx.insert(invitationVerticalAssignments).values({
          invitationId: id,
          verticalId: vertical.verticalId,
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

  async findById(inviteId: number) {
    return fetchInviteWithRole(inviteId);
  }

  async findStagedVerticalAssignments(invitationIds: number[]) {
    if (invitationIds.length === 0) return [];

    const verticalRows = await db
      .select({
        invitationId: invitationVerticalAssignments.invitationId,
        verticalId: invitationVerticalAssignments.verticalId,
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

    const territoriesByKey = new Map<string, number[]>();
    for (const row of territoryRows) {
      const key = `${row.invitationId}:${row.verticalId}`;
      const list = territoriesByKey.get(key) ?? [];
      list.push(row.territoryId);
      territoriesByKey.set(key, list);
    }

    return verticalRows.map((row) => ({
      invitationId: row.invitationId,
      verticalId: row.verticalId,
      territoryIds:
        territoriesByKey.get(`${row.invitationId}:${row.verticalId}`) ?? [],
    }));
  }

  async updatePending(params: {
    inviteId: number;
    email?: string | undefined;
    phoneNumber?: string | null | undefined;
    roleId?: number | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    birthDate?: Date | undefined;
    verticalAssignments?: Array<{
      verticalId: number;
      territoryIds: number[];
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
    invitedByUserId?: number;
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

  async markAccepted(inviteId: number, _userId: number) {
    await db
      .update(invitations)
      .set({
        status: "ACCEPTED",
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invitations.id, inviteId));
  }

  async revoke(inviteId: number) {
    await db
      .update(invitations)
      .set({
        status: "REVOKED",
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invitations.id, inviteId));
  }

  async regenerateToken(inviteId: number, params: { tokenHash: string; expiresAt: Date }) {
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

      const seenTerritoryIds = new Set<number>();
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
            assignedByUserId: inviteLock.invitedByUserId,
          })
          .onConflictDoNothing();
      }

      // Territories without matching staged UVAs still imply a linha.
      if (stagedTerritories.length > 0) {
        const territoryIds = [
          ...new Set(stagedTerritories.map((row) => row.territoryId)),
        ];
        const territoryVerticalRows = await tx
          .select({
            id: territories.id,
            verticalId: territories.verticalId,
          })
          .from(territories)
          .where(inArray(territories.id, territoryIds));
        const stagedVerticalIds = new Set(
          stagedVerticals.map((row) => row.verticalId),
        );
        for (const row of territoryVerticalRows) {
          if (stagedVerticalIds.has(row.verticalId)) continue;
          await tx
            .insert(userVerticalAssignments)
            .values({
              userId: user.id,
              verticalId: row.verticalId,
              assignedByUserId: inviteLock.invitedByUserId,
            })
            .onConflictDoNothing();
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
