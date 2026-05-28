import { prisma } from "../../../../../infrastructure/database/prisma.client";
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

export class PrismaUserRepository implements UserRepository {
  async findByIdentifier(params: FindUserByIdentifierParams) {
    return await prisma.user.findFirst({
      where: {
        deletedAt: null,
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

  async findUserAuthStatus(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        status: true,
        tokenVersion: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      status: user.status,
      tokenVersion: user.tokenVersion,
      roleId: user.role.id,
      roleName: user.role.name,
    };
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
        tokenVersion: { increment: 1 },
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
        tokenVersion: { increment: 1 },
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

  async updateRole(userId: string, roleId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { roleId },
    });
  }

  async changeRoleTransaction(params: {
    userId: string;
    newRoleId: string;
  }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: params.userId },
        data: {
          roleId: params.newRoleId,
          tokenVersion: { increment: 1 },
        },
      });

      await tx.session.updateMany({
        where: {
          userId: params.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokedReason: "Role changed",
        },
      });
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
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: params.userId },
        data: {
          passwordHash: params.newPasswordHash,
          passwordHistory: params.passwordHistory,
          passwordChangedAt: new Date(),
          tokenVersion: { increment: 1 },
        },
        include: { role: true },
      });

      if (params.revokeOtherSessions) {
        await tx.session.updateMany({
          where: {
            userId: params.userId,
            revokedAt: null,
            ...(params.keepSessionId
              ? { id: { not: params.keepSessionId } }
              : {}),
          },
          data: {
            revokedAt: new Date(),
            revokedReason: "Password changed",
          },
        });
      }

      return { user };
    });
  }

  async enableTwoFactor(params: { userId: string; encryptedSecret: string }) {
    await prisma.user.update({
      where: { id: params.userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: params.encryptedSecret,
        tokenVersion: { increment: 1 },
      },
    });
  }

  async disableTwoFactor(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        tokenVersion: { increment: 1 },
      },
    });
  }

  /**
   * Increments tokenVersion to invalidate all outstanding JWTs.
   * Intended for privilege changes (e.g. role change) — call alongside session revocation and cache invalidation.
   */
  async incrementTokenVersion(userId: string): Promise<number> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        tokenVersion: { increment: 1 },
      },
      select: {
        tokenVersion: true,
      },
    });

    return user.tokenVersion;
  }

  async resetPasswordTransaction(params: ResetPasswordTransactionParams): Promise<ResetPasswordTransactionResult> {
    return await prisma.$transaction(async (tx) => {
      const lockedReset = await tx.$queryRaw<Array<{
        id: string;
        userId: string;
        expiresAt: Date;
        usedAt: Date | null;
      }>>`
        SELECT id, "userId", "expiresAt", "usedAt"
        FROM password_resets
        WHERE "tokenHash" = ${params.tokenHash}
        FOR UPDATE
      `;

      if (!lockedReset || lockedReset.length === 0) {
        throw new ResetTokenInvalidError();
      }

      const passwordReset = lockedReset[0]!;

      if (passwordReset.usedAt) {
        throw new ResetTokenUsedError();
      }

      if (passwordReset.expiresAt < new Date()) {
        throw new ResetTokenExpiredError();
      }

      const lockedUser = await tx.$queryRaw<Array<{
        id: string;
        passwordHash: string;
        passwordHistory: string[];
      }>>`
        SELECT id, "passwordHash", "passwordHistory"
        FROM users
        WHERE id = ${passwordReset.userId}
        FOR UPDATE
      `;

      if (!lockedUser || lockedUser.length === 0) {
        throw new ResetTokenInvalidError();
      }

      const userLock = lockedUser[0]!;

      const updatedHistory = [userLock.passwordHash, ...userLock.passwordHistory].slice(
        0,
        PASSWORD_HISTORY_LIMIT
      );

      const user = await tx.user.update({
        where: { id: userLock.id },
        data: {
          passwordHash: params.newPasswordHash,
          passwordHistory: updatedHistory,
          passwordChangedAt: new Date(),
          tokenVersion: { increment: 1 },
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

      const passwordResetRecord = await tx.passwordReset.findUniqueOrThrow({
        where: { id: passwordReset.id },
      });

      return { user, passwordReset: passwordResetRecord };
    });
  }

  async findEmailVerificationState(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        emailVerified: true,
      },
    });
  }

  async findPhoneVerificationState(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        phoneNumber: true,
        phoneVerified: true,
      },
    });
  }

  async findByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
  }

  async findByPhone(phoneNumber: string) {
    return await prisma.user.findUnique({
      where: { phoneNumber },
      select: { id: true },
    });
  }

  async markEmailVerified(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  async markPhoneVerified(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
      },
    });
  }

  async updateEmail(userId: string, newEmail: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  async updatePhone(userId: string, newPhone: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        phoneNumber: newPhone,
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
      },
    });
  }

  async findAll(params: FindAllUsersParams) {
    const page = params.page;
    const limit = Math.min(params.limit, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (params.status) {
      where.status = params.status;
    }

    if (params.search) {
      where.OR = [
        { email: { contains: params.search, mode: "insensitive" } },
        { username: { contains: params.search, mode: "insensitive" } },
        { firstName: { contains: params.search, mode: "insensitive" } },
        { lastName: { contains: params.search, mode: "insensitive" } },
        { phoneNumber: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params.scope && !params.scope.isGlobal) {
      const managedUserIds = params.scope.managedUserIds ?? [];

      if (managedUserIds.length === 0) {
        return { users: [], total: 0 };
      }

      where.AND = [
        ...((where.AND as Record<string, unknown>[]) ?? []),
        { id: { in: managedUserIds } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: where as any,
        include: {
          role: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: where as any }),
    ]);

    return { users, total };
  }

  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; avatarUrl?: string }
  ) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
      include: {
        role: true,
      },
    });
  }

  async updateManagerId(userId: string, managerId: string | null) {
    return await prisma.user.update({
      where: { id: userId },
      data: { managerId },
      include: {
        role: true,
      },
    });
  }
}
