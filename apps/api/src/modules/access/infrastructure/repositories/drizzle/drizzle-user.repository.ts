import { eq, and, or, isNull, ilike, inArray, sql, desc, asc } from "drizzle-orm";
import {
  users,
  roles,
  sessions,
  passwordResets,
  userSectorAssignments,
  type Database,
  type AnyDatabase,
} from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import {
  ResetTokenExpiredError,
  ResetTokenInvalidError,
  ResetTokenUsedError,
} from "../../../../../shared/errors";
import { PASSWORD_HISTORY_LIMIT } from "../../../application/constants/password.constants";

import type {
  UserRepository,
  FindUserByIdentifierParams,
  CreateUserParams,
  UpdatePasswordParams,
  ResetPasswordTransactionParams,
  ResetPasswordTransactionResult,
  FindAllUsersParams,
} from "../../../application/interfaces/user.repository.interface";

async function fetchUserWithRole(userId: string, client: AnyDatabase = db) {
  const [row] = await client
    .select()
    .from(users)
    .leftJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) return null;
  return { ...row.users, role: row.roles! };
}

export class DrizzleUserRepository implements UserRepository {
  async findByIdentifier(params: FindUserByIdentifierParams) {
    const [row] = await db
      .select()
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(
        and(
          isNull(users.deletedAt),
          or(
            eq(users.email, params.identifier),
            eq(users.username, params.identifier),
            eq(users.phoneNumber, params.identifier as any),
          ),
        ),
      )
      .limit(1);

    if (!row) return null;
    return { ...row.users, role: row.roles! };
  }

  async findById(id: string) {
    return fetchUserWithRole(id);
  }

  async findUserAuthStatus(id: string) {
    const [row] = await db
      .select({
        status: users.status,
        tokenVersion: users.tokenVersion,
        roleId: roles.id,
        roleName: roles.name,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, id))
      .limit(1);

    if (!row) return null;

    return {
      status: row.status,
      tokenVersion: row.tokenVersion,
      roleId: row.roleId!,
      roleName: row.roleName!,
    };
  }

  async create(params: CreateUserParams) {
    const [inserted] = await db
      .insert(users)
      .values({
        email: params.email,
        username: params.username,
        phoneNumber: params.phoneNumber ?? null,
        passwordHash: params.passwordHash,
        roleId: params.roleId,
        firstName: params.firstName ?? null,
        lastName: params.lastName ?? null,
        emailVerified: params.emailVerified ?? false,
        phoneVerified: params.phoneVerified ?? false,
        status: (params.status as any) ?? "PENDING",
      })
      .returning();

    const result = await fetchUserWithRole(inserted!.id);
    return result!;
  }

  async updateLastLogin(userId: string) {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updatePassword(params: UpdatePasswordParams) {
    await db
      .update(users)
      .set({
        passwordHash: params.passwordHash,
        passwordChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, params.userId));
  }

  async deactivate(userId: string) {
    await db
      .update(users)
      .set({
        status: "INACTIVE",
        deactivatedAt: new Date(),
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async activate(userId: string) {
    await db
      .update(users)
      .set({
        status: "ACTIVE",
        deactivatedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async suspend(userId: string) {
    await db
      .update(users)
      .set({
        status: "SUSPENDED",
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async unsuspend(userId: string) {
    await db
      .update(users)
      .set({ status: "ACTIVE", updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updateRole(userId: string, roleId: string) {
    await db
      .update(users)
      .set({ roleId, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async changeRoleTransaction(params: {
    userId: string;
    newRoleId: string;
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          roleId: params.newRoleId,
          tokenVersion: sql`${users.tokenVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, params.userId));

      await tx
        .update(sessions)
        .set({
          revokedAt: new Date(),
          revokedReason: "Role changed",
          updatedAt: new Date(),
        })
        .where(
          and(eq(sessions.userId, params.userId), isNull(sessions.revokedAt)),
        );
    });
  }

  async changePasswordTransaction(params: {
    userId: string;
    newPasswordHash: string;
    previousPasswordHash: string;
    passwordHistory: string[];
    revokeOtherSessions: boolean;
    keepSessionId?: string;
  }) {
    return await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          passwordHash: params.newPasswordHash,
          passwordHistory: params.passwordHistory,
          passwordChangedAt: new Date(),
          tokenVersion: sql`${users.tokenVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, params.userId));

      const user = await fetchUserWithRole(params.userId, tx);

      if (params.revokeOtherSessions) {
        const conditions = [
          eq(sessions.userId, params.userId),
          isNull(sessions.revokedAt),
        ];

        if (params.keepSessionId) {
          conditions.push(
            sql`${sessions.id} != ${params.keepSessionId}` as any,
          );
        }

        await tx
          .update(sessions)
          .set({
            revokedAt: new Date(),
            revokedReason: "Password changed",
            updatedAt: new Date(),
          })
          .where(and(...conditions));
      }

      return { user: user! };
    });
  }

  async enableTwoFactor(params: { userId: string; encryptedSecret: string }) {
    await db
      .update(users)
      .set({
        twoFactorEnabled: true,
        twoFactorSecret: params.encryptedSecret,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, params.userId));
  }

  async disableTwoFactor(userId: string) {
    await db
      .update(users)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Increments tokenVersion to invalidate all outstanding JWTs.
   * Intended for privilege changes (e.g. role change) — call alongside session revocation and cache invalidation.
   */
  async incrementTokenVersion(userId: string): Promise<number> {
    const [updated] = await db
      .update(users)
      .set({
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({ tokenVersion: users.tokenVersion });

    return updated!.tokenVersion;
  }

  async resetPasswordTransaction(
    params: ResetPasswordTransactionParams,
  ): Promise<ResetPasswordTransactionResult> {
    return await db.transaction(async (tx) => {
      const [passwordReset] = await tx
        .select({
          id: passwordResets.id,
          userId: passwordResets.userId,
          expiresAt: passwordResets.expiresAt,
          usedAt: passwordResets.usedAt,
        })
        .from(passwordResets)
        .where(eq(passwordResets.tokenHash, params.tokenHash))
        .for("update")
        .limit(1);

      if (!passwordReset) {
        throw new ResetTokenInvalidError();
      }

      if (passwordReset.usedAt) {
        throw new ResetTokenUsedError();
      }

      if (passwordReset.expiresAt < new Date()) {
        throw new ResetTokenExpiredError();
      }

      const [userLock] = await tx
        .select({
          id: users.id,
          passwordHash: users.passwordHash,
          passwordHistory: users.passwordHistory,
        })
        .from(users)
        .where(eq(users.id, passwordReset.userId))
        .for("update")
        .limit(1);

      if (!userLock) {
        throw new ResetTokenInvalidError();
      }

      const updatedHistory = [
        userLock.passwordHash,
        ...userLock.passwordHistory,
      ].slice(0, PASSWORD_HISTORY_LIMIT);

      await tx
        .update(users)
        .set({
          passwordHash: params.newPasswordHash,
          passwordHistory: updatedHistory,
          passwordChangedAt: new Date(),
          tokenVersion: sql`${users.tokenVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userLock.id));

      const user = await fetchUserWithRole(userLock.id, tx);

      await tx
        .update(passwordResets)
        .set({ usedAt: new Date(), updatedAt: new Date() })
        .where(eq(passwordResets.id, passwordReset.id));

      await tx
        .update(sessions)
        .set({
          revokedAt: new Date(),
          revokedReason: "Password reset",
          updatedAt: new Date(),
        })
        .where(and(eq(sessions.userId, user!.id), isNull(sessions.revokedAt)));

      const [passwordResetRecord] = await tx
        .select()
        .from(passwordResets)
        .where(eq(passwordResets.id, passwordReset.id))
        .limit(1);

      return { user: user!, passwordReset: passwordResetRecord! };
    });
  }

  async findEmailVerificationState(userId: string) {
    const [row] = await db
      .select({ email: users.email, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return row ?? null;
  }

  async findPhoneVerificationState(userId: string) {
    const [row] = await db
      .select({
        phoneNumber: users.phoneNumber,
        phoneVerified: users.phoneVerified,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return row ?? null;
  }

  async findByEmail(email: string) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return row ?? null;
  }

  async findByPhone(phoneNumber: string) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneNumber, phoneNumber as any))
      .limit(1);

    return row ?? null;
  }

  async markEmailVerified(userId: string) {
    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async markPhoneVerified(userId: string) {
    await db
      .update(users)
      .set({
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateEmail(userId: string, newEmail: string) {
    await db
      .update(users)
      .set({
        email: newEmail,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updatePhone(userId: string, newPhone: string) {
    await db
      .update(users)
      .set({
        phoneNumber: newPhone,
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async findAll(params: FindAllUsersParams) {
    const page = params.page;
    const limit = Math.min(params.limit, 100);
    const skip = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      isNull(users.deletedAt) as any,
    ];

    if (params.status) {
      conditions.push(eq(users.status, params.status as any));
    }

    if (params.search) {
      const term = `%${params.search}%`;
      conditions.push(
        or(
          ilike(users.email, term),
          ilike(users.username, term),
          ilike(users.firstName as any, term),
          ilike(users.lastName as any, term),
          ilike(users.phoneNumber as any, term),
        ) as any,
      );
    }

    if (params.role) {
      conditions.push(eq(roles.name, params.role as any));
    }

    if (params.sectorId) {
      conditions.push(
        inArray(
          users.id,
          db
            .select({ userId: userSectorAssignments.userId })
            .from(userSectorAssignments)
            .where(eq(userSectorAssignments.sectorId, params.sectorId)),
        ) as any,
      );
    }

    if (params.scope && !params.scope.isGlobal) {
      const managedUserIds = params.scope.managedUserIds ?? [];

      if (managedUserIds.length === 0) {
        return { users: [], total: 0 };
      }

      conditions.push(inArray(users.id, managedUserIds) as any);
    }

    const where = and(...conditions);
    const sortBy = params.sortBy ?? "createdAt";
    const sortDir =
      params.sortDir ?? (sortBy === "createdAt" ? "desc" : "asc");
    const dir = sortDir === "asc" ? asc : desc;

    const nameOrder = sql`lower(trim(coalesce(${users.firstName}, '') || ' ' || coalesce(${users.lastName}, '')))`;
    const orderExpressions =
      sortBy === "name"
        ? [dir(nameOrder), dir(sql`lower(${users.username})`)]
        : sortBy === "role"
          ? [dir(roles.name), dir(nameOrder)]
          : sortBy === "status"
            ? [dir(users.status), dir(nameOrder)]
            : [dir(users.createdAt)];

    const [userRows, countRows] = await Promise.all([
      db
        .select()
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(where)
        .orderBy(...orderExpressions)
        .offset(skip)
        .limit(limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(where),
    ]);

    return {
      users: userRows.map((row) => ({ ...row.users, role: row.roles! })),
      total: countRows[0]!.count,
    };
  }

  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; avatarUrl?: string | null },
  ) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (data.firstName !== undefined) updates.firstName = data.firstName;
    if (data.lastName !== undefined) updates.lastName = data.lastName;
    if (data.avatarUrl !== undefined) updates.avatarUrl = data.avatarUrl;

    await db.update(users).set(updates).where(eq(users.id, userId));

    const result = await fetchUserWithRole(userId);
    return result!;
  }

  async findByUsername(username: string) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.username, username)))
      .limit(1);

    return row ?? null;
  }

  async updateAsAdmin(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phoneNumber?: string | null;
      username?: string;
      birthDate?: Date | null;
    },
  ) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (data.firstName !== undefined) updates.firstName = data.firstName;
    if (data.lastName !== undefined) updates.lastName = data.lastName;
    if (data.email !== undefined) {
      updates.email = data.email;
      updates.emailVerified = false;
      updates.emailVerifiedAt = null;
    }
    if (data.phoneNumber !== undefined) {
      updates.phoneNumber = data.phoneNumber;
      if (data.phoneNumber === null) {
        updates.phoneVerified = false;
        updates.phoneVerifiedAt = null;
      } else {
        updates.phoneVerified = false;
        updates.phoneVerifiedAt = null;
      }
    }
    if (data.username !== undefined) updates.username = data.username;
    if (data.birthDate !== undefined) updates.birthDate = data.birthDate;

    await db.update(users).set(updates).where(eq(users.id, userId));

    const result = await fetchUserWithRole(userId);
    return result!;
  }

  async getMetadata(userId: string): Promise<unknown> {
    const [row] = await db
      .select({ metadata: users.metadata })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return row?.metadata ?? null;
  }

  async updateMetadata(
    userId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await db
      .update(users)
      .set({ metadata, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updateManagerId(userId: string, managerId: string | null) {
    await db
      .update(users)
      .set({ managerId, updatedAt: new Date() })
      .where(eq(users.id, userId));

    const result = await fetchUserWithRole(userId);
    return result!;
  }
}
