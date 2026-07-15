import { verificationTokens } from '@atlasmed/database'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '../../../../../infrastructure/database/db'

import type {
  CreateVerificationTokenParams,
  FindValidVerificationTokenParams,
  VerificationTokenRepository
} from '../../../application/interfaces/verification-token.repository.interface'

export class DrizzleVerificationTokenRepository implements VerificationTokenRepository {
  async deleteUnusedByUserAndType(
    userId: string,
    type: CreateVerificationTokenParams['type']
  ): Promise<void> {
    await db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.userId, userId),
          eq(verificationTokens.type, type),
          isNull(verificationTokens.verifiedAt)
        )
      )
  }

  async create(params: CreateVerificationTokenParams): Promise<void> {
    await db.insert(verificationTokens).values({
      userId: params.userId,
      type: params.type,
      tokenHash: params.tokenHash,
      newValue: params.newValue,
      expiresAt: params.expiresAt
    })
  }

  async findValidToken(params: FindValidVerificationTokenParams) {
    const [row] = await db
      .select({
        id: verificationTokens.id,
        newValue: verificationTokens.newValue
      })
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.tokenHash, params.tokenHash),
          eq(verificationTokens.userId, params.userId),
          eq(verificationTokens.type, params.type),
          isNull(verificationTokens.verifiedAt),
          gt(verificationTokens.expiresAt, new Date())
        )
      )
      .limit(1)

    return row ?? null
  }

  async markVerified(id: string): Promise<void> {
    await db
      .update(verificationTokens)
      .set({ verifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(verificationTokens.id, id))
  }
}
