import { eq, and, or, isNull, gt, desc, lt, sql } from "drizzle-orm";
import { users, roles, invitations, userTerritoryAssignments } from "@atlasmed/database";
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

    const [inserted] = await db
      .insert(invitations)
      .values({
        email: params.email ?? null,
        phoneNumber: params.phoneNumber ?? null,
        tokenHash: params.tokenHash,
        roleId: params.roleId,
        invitedByUserId: params.invitedByUserId,
        firstName: params.firstName ?? null,
        lastName: params.lastName ?? null,
        managerId: params.managerId ?? null,
        managerTerritoryId: params.managerTerritoryId ?? null,
        repTerritoryId: params.repTerritoryId ?? null,
        expiresAt: params.expiresAt,
      })
      .returning();

    const result = await fetchInviteWithRole(inserted!.id);
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
      // Pessimistic locking: Lock the invite row to prevent race conditions
      const lockedInvite = await tx.execute<{
        id: string;
        status: string;
        expiresAt: Date;
        email: string | null;
        phoneNumber: string | null;
        roleId: string;
        firstName: string | null;
        lastName: string | null;
        managerId: string | null;
        managerTerritoryId: string | null;
        repTerritoryId: string | null;
      }>(sql`
        SELECT id, status, "expiresAt", email, "phoneNumber", "roleId",
               "firstName", "lastName", "managerId", "managerTerritoryId", "repTerritoryId"
        FROM invitations
        WHERE "tokenHash" = ${params.tokenHash}
        FOR UPDATE
      `);

      if (!lockedInvite || lockedInvite.length === 0) {
        throw new InvalidInviteError();
      }

      const inviteLock = lockedInvite[0]!;

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

      // Check for existing user with same credentials
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

      // Create the user with invitation data
      const [newUserRow] = await tx
        .insert(users)
        .values({
          email: params.email,
          username: params.username,
          phoneNumber: params.phoneNumber ?? null,
          passwordHash: params.passwordHash,
          roleId: inviteLock.roleId,
          firstName: params.firstName ?? inviteLock.firstName ?? null,
          lastName: params.lastName ?? inviteLock.lastName ?? null,
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

      // Create territory assignments if specified in invitation
      if (inviteLock.managerTerritoryId) {
        await tx.insert(userTerritoryAssignments).values({
          userId: user.id,
          territoryId: inviteLock.managerTerritoryId,
          assignedBy: inviteLock.id,
        });
      }

      if (inviteLock.repTerritoryId) {
        await tx.insert(userTerritoryAssignments).values({
          userId: user.id,
          territoryId: inviteLock.repTerritoryId,
          assignedBy: inviteLock.id,
        });
      }

      // Mark invite as accepted
      await tx
        .update(invitations)
        .set({
          status: "ACCEPTED",
          acceptedAt: new Date(),
          acceptedByUserId: user.id,
          updatedAt: new Date(),
        })
        .where(eq(invitations.id, inviteLock.id));

      // Fetch the complete invite with role for the return value
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
