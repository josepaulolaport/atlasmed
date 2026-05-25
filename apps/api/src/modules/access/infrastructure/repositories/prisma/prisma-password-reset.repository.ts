import type { PrismaClient } from "@atlasmed/database";

import type {
  CreatePasswordResetParams,
  FindPasswordResetByTokenParams,
  PasswordResetRepository,
} from "../../../application/interfaces/password-reset.repository.interface";

interface Dependencies {
  prisma: PrismaClient;
}

export class PrismaPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly deps: Dependencies) {}

  async create(params: CreatePasswordResetParams) {
    return await this.deps.prisma.passwordReset.create({
      data: {
        userId: params.userId,
        tokenHash: params.tokenHash,
        expiresAt: params.expiresAt,
      },
    });
  }

  async findByToken(params: FindPasswordResetByTokenParams) {
    return await this.deps.prisma.passwordReset.findUnique({
      where: {
        tokenHash: params.tokenHash,
      },
      include: {
        user: true,
      },
    });
  }

  async markAsUsed(id: string): Promise<void> {
    await this.deps.prisma.passwordReset.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async deleteExpired(): Promise<void> {
    await this.deps.prisma.passwordReset.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
}
