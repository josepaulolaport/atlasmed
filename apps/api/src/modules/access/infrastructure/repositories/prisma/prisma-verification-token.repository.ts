import type { PrismaClient } from "@atlasmed/database";

import type {
  CreateVerificationTokenParams,
  FindValidVerificationTokenParams,
  VerificationTokenRepository,
} from "../../../application/interfaces/verification-token.repository.interface";

interface Dependencies {
  prisma: PrismaClient;
}

export class PrismaVerificationTokenRepository implements VerificationTokenRepository {
  constructor(private readonly deps: Dependencies) {}

  async deleteUnusedByUserAndType(userId: string, type: CreateVerificationTokenParams["type"]): Promise<void> {
    await this.deps.prisma.verificationToken.deleteMany({
      where: {
        userId,
        type,
        verifiedAt: null,
      },
    });
  }

  async create(params: CreateVerificationTokenParams): Promise<void> {
    await this.deps.prisma.verificationToken.create({
      data: {
        userId: params.userId,
        type: params.type,
        tokenHash: params.tokenHash,
        newValue: params.newValue,
        expiresAt: params.expiresAt,
      },
    });
  }

  async findValidToken(params: FindValidVerificationTokenParams) {
    return await this.deps.prisma.verificationToken.findFirst({
      where: {
        tokenHash: params.tokenHash,
        userId: params.userId,
        type: params.type,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        newValue: true,
      },
    });
  }

  async markVerified(id: string): Promise<void> {
    await this.deps.prisma.verificationToken.update({
      where: { id },
      data: { verifiedAt: new Date() },
    });
  }
}
