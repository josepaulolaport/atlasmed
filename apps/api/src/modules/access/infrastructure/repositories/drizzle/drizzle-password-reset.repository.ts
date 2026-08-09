import { eq, and, isNull, lt } from "drizzle-orm";
import { users, passwordResets, roles } from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";

import type {
  CreatePasswordResetParams,
  FindPasswordResetByTokenParams,
  PasswordResetRepository,
} from "../../../application/interfaces/password-reset.repository.interface";

export class DrizzlePasswordResetRepository implements PasswordResetRepository {
  async create(params: CreatePasswordResetParams) {
    const [row] = await db
      .insert(passwordResets)
      .values({
        userId: params.userId,
        tokenHash: params.tokenHash,
        expiresAt: params.expiresAt,
      })
      .returning();

    return row!;
  }

  async findByToken(params: FindPasswordResetByTokenParams) {
    const [pr] = await db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.tokenHash, params.tokenHash))
      .limit(1);

    if (!pr) return null;

    const [userWithRole] = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        phoneNumber: users.phoneNumber,
        passwordHash: users.passwordHash,
        passwordHistory: users.passwordHistory,
        roleId: roles.id,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .where(eq(users.id, pr.userId))
      .limit(1);

    if (!userWithRole) return null;

    return {
      id: pr.id,
      userId: pr.userId,
      tokenHash: pr.tokenHash,
      expiresAt: pr.expiresAt,
      usedAt: pr.usedAt,
      createdAt: pr.createdAt,
      user: {
        id: userWithRole.id,
        email: userWithRole.email,
        username: userWithRole.username,
        phoneNumber: userWithRole.phoneNumber,
        passwordHash: userWithRole.passwordHash,
        passwordHistory: userWithRole.passwordHistory,
        role: {
          id: userWithRole.roleId,
          name: userWithRole.roleName,
        },
      },
    };
  }

  async markAsUsed(id: number): Promise<void> {
    await db
      .update(passwordResets)
      .set({ usedAt: new Date(), updatedAt: new Date() })
      .where(eq(passwordResets.id, id));
  }

  async invalidateUnusedForUser(userId: number): Promise<void> {
    await db
      .update(passwordResets)
      .set({ usedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(passwordResets.userId, userId), isNull(passwordResets.usedAt)));
  }

  async deleteExpired(): Promise<void> {
    await db.delete(passwordResets).where(lt(passwordResets.expiresAt, new Date()));
  }
}
