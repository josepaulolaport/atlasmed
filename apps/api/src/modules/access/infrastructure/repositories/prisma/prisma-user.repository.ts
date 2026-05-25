import { prisma } from "../../../../../infrastructure/database/prisma.client";
import { InvalidInviteError } from "@atlasmed/access";

import type {
  UserRepository,
  FindUserByIdentifierParams,
  CreateUserParams,
  UpdatePasswordParams,
  ResetPasswordTransactionParams,
  ResetPasswordTransactionResult,
} from "../../../application/interfaces/user.repository.interface";

export class PrismaUserRepository implements UserRepository {
  async findByIdentifier(params: FindUserByIdentifierParams) {
    return await prisma.user.findFirst({
      where: {
        OR: [
          {
            email: params.identifier,
          },

          {
            username: params.identifier,
          },

          {
            phoneNumber: params.identifier,
          },
        ],
      },

      include: {
        role: true,
      },
    });
  }

  async findById(id: string) {
    return await prisma.user.findUnique({
      where: { id },

      include: {
        role: true,
      },
    });
  }

  async create(params: CreateUserParams) {
    return await prisma.user.create({
      data: {
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
      },

      include: {
        role: true,
      },
    });
  }

  async updateLastLogin(userId: string) {
    await prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        lastLoginAt: new Date(),
      },
    });
  }

  async updatePassword(params: UpdatePasswordParams) {
    await prisma.user.update({
      where: {
        id: params.userId,
      },

      data: {
        passwordHash: params.passwordHash,
        passwordChangedAt: new Date(),
      },
    });
  }

  async deactivate(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: "INACTIVE",
        deactivatedAt: new Date(),
      },
    });
  }

  async activate(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: "ACTIVE",
        deactivatedAt: null,
      },
    });
  }

  async suspend(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: "SUSPENDED",
      },
    });
  }

  async unsuspend(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: "ACTIVE",
      },
    });
  }

  async delete(userId: string) {
    await prisma.user.delete({
      where: { id: userId },
    });
  }

  async resetPasswordTransaction(params: ResetPasswordTransactionParams): Promise<ResetPasswordTransactionResult> {
    return await prisma.$transaction(async (tx) => {
      const passwordReset = await tx.passwordReset.findUnique({
        where: {
          tokenHash: params.tokenHash,
        },
      });

      if (!passwordReset || passwordReset.usedAt || passwordReset.expiresAt < new Date()) {
        throw new Error("Invalid or expired password reset token");
      }

      const user = await tx.user.update({
        where: { id: passwordReset.userId },
        data: {
          passwordHash: params.newPasswordHash,
          passwordChangedAt: new Date(),
          tokenVersion: { increment: 1 },
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        include: {
          role: true,
        },
      });

      await tx.passwordReset.update({
        where: { id: passwordReset.id },
        data: {
          usedAt: new Date(),
        },
      });

      await tx.session.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokedReason: "Password reset",
        },
      });

      return { user, passwordReset };
    });
  }
}
