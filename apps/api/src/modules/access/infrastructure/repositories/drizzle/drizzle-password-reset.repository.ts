import { eq, and, isNull, lt } from "drizzle-orm";
import { users, passwordResets } from "@atlasmed/database";
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

    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.id, pr.userId))
      .limit(1);

    if (!userRow) return null;

    return { ...pr, user: userRow };
  }

  async markAsUsed(id: string): Promise<void> {
    await db
      .update(passwordResets)
      .set({ usedAt: new Date(), updatedAt: new Date() })
      .where(eq(passwordResets.id, id));
  }

  async invalidateUnusedForUser(userId: string): Promise<void> {
    await db
      .update(passwordResets)
      .set({ usedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(passwordResets.userId, userId), isNull(passwordResets.usedAt)));
  }

  async deleteExpired(): Promise<void> {
    await db.delete(passwordResets).where(lt(passwordResets.expiresAt, new Date()));
  }
}
