import { prisma } from "../../../../../infrastructure/database/prisma.client";
import { UnauthorizedError } from "@atlasmed/access";

import type {
  SessionRepository,
  CreateSessionParams,
  RotateSessionParams,
} from "../../../application/interfaces/session.repository.interface";

export class PrismaSessionRepository implements SessionRepository {
  async create(params: CreateSessionParams) {
    return await prisma.session.create({
      data: {
        id: params.id,
        userId: params.userId,
        refreshTokenHash: params.refreshTokenHash,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        expiresAt: params.expiresAt,
      },
    });
  }

  async findActiveByTokenHash(tokenHash: string) {
    return await prisma.session.findFirst({
      where: {
        refreshTokenHash: tokenHash,

        revokedAt: null,

        expiresAt: {
          gt: new Date(),
        },
      },

      include: {
        user: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async findById(sessionId: string) {
    return await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async findByUserId(userId: string) {
    return await prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async revoke(sessionId: string) {
    await prisma.session.update({
      where: {
        id: sessionId,
      },

      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeAllByUserId(userId: string, excludeSessionId?: string) {
    await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(excludeSessionId && { id: { not: excludeSessionId } }),
      },
      data: {
        revokedAt: new Date(),
        revokedReason: "User deactivation or logout all",
      },
    });
  }

  async updateLastSeen(sessionId: string) {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        lastSeenAt: new Date(),
      },
    });
  }

  async rotateSessionTransaction(params: RotateSessionParams) {
    return await prisma.$transaction(async (tx) => {
      const oldSession = await tx.session.findUnique({
        where: { id: params.oldSessionId },
        include: {
          user: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!oldSession) {
        throw new UnauthorizedError("Session not found");
      }

      if (oldSession.revokedAt) {
        throw new UnauthorizedError("Session has been revoked");
      }

      if (oldSession.expiresAt < new Date()) {
        throw new UnauthorizedError("Session has expired");
      }

      await tx.session.update({
        where: { id: params.oldSessionId },
        data: {
          revokedAt: new Date(),
          revokedReason: "Session rotated",
          replacedBySessionId: params.newSessionId,
        },
      });

      const newSession = await tx.session.create({
        data: {
          id: params.newSessionId,
          userId: oldSession.userId,
          refreshTokenHash: params.newRefreshTokenHash,
          ipAddress: params.ipAddress ?? oldSession.ipAddress,
          userAgent: params.userAgent ?? oldSession.userAgent,
          expiresAt: params.newExpiresAt,
        },
        include: {
          user: {
            include: {
              role: true,
            },
          },
        },
      });

      return newSession;
    });
  }
}
