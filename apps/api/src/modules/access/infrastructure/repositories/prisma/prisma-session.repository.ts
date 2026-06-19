import { prisma } from "../../../../../infrastructure/database/prisma.client";
import {
  UnauthorizedError,
} from "../../../../../shared/errors";
import { sessionsMatchSameDevice } from "../../../../../shared/utils/device-fingerprint";

import type {
  SessionRepository,
  CreateSessionParams,
  CreateLoginSessionParams,
  RotateRefreshTokenParams,
} from "../../../application/interfaces/session.repository.interface";
import { REFRESH_ROTATION_GRACE_MS } from "../../../application/constants/refresh-token.constants";

export class PrismaSessionRepository implements SessionRepository {
  async create(params: CreateSessionParams) {
    return await prisma.session.create({
      data: {
        id: params.id,
        userId: params.userId,
        refreshTokenHash: params.refreshTokenHash,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        browserName: params.browserName ?? null,
        browserVersion: params.browserVersion ?? null,
        osName: params.osName ?? null,
        deviceType: (params.deviceType as any) ?? "UNKNOWN",
        deviceFingerprint: params.deviceFingerprint ?? null,
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

  async findActiveByPreviousRefreshTokenHash(tokenHash: string) {
    return await prisma.session.findFirst({
      where: {
        previousRefreshTokenHash: tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        userId: true,
        updatedAt: true,
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

  async findSessionStatus(sessionId: string) {
    return await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
      },
    });
  }

  async findByUserId(userId: string) {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
    });

    const activeSessionsPerDevice: typeof sessions = [];

    for (const session of sessions) {
      const isDuplicateDevice = activeSessionsPerDevice.some((existing) =>
        sessionsMatchSameDevice(existing, session)
      );

      if (isDuplicateDevice) {
        continue;
      }

      activeSessionsPerDevice.push(session);
    }

    return activeSessionsPerDevice;
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

  async revokeForSecurityViolation(sessionId: string) {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revokedReason: "Session security violation",
        suspiciousActivity: true,
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

  async revokeActiveByUserAndDeviceFingerprint(
    userId: string,
    deviceFingerprint: string,
    options?: {
      reason?: string;
      excludeSessionId?: string;
    }
  ): Promise<string[]> {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        deviceFingerprint,
        revokedAt: null,
        ...(options?.excludeSessionId && {
          id: { not: options.excludeSessionId },
        }),
      },
      select: { id: true },
    });

    if (sessions.length === 0) {
      return [];
    }

    await prisma.session.updateMany({
      where: {
        userId,
        deviceFingerprint,
        revokedAt: null,
        ...(options?.excludeSessionId && {
          id: { not: options.excludeSessionId },
        }),
      },
      data: {
        revokedAt: new Date(),
        revokedReason:
          options?.reason ?? "Replaced by new session on same device",
      },
    });

    return sessions.map((session) => session.id);
  }

  async revokeAllActiveForDevice(
    userId: string,
    targetSession: {
      id: string;
      deviceFingerprint?: string | null;
      userAgent?: string | null;
      deviceType?: string | null;
    },
    options?: {
      reason?: string;
    }
  ): Promise<string[]> {
    const activeSessions = await prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        deviceFingerprint: true,
        userAgent: true,
        deviceType: true,
      },
    });

    const sessionsToRevoke = activeSessions.filter((session) =>
      sessionsMatchSameDevice(targetSession, session)
    );

    if (sessionsToRevoke.length === 0) {
      return [];
    }

    const sessionIds = sessionsToRevoke.map((session) => session.id);

    await prisma.session.updateMany({
      where: {
        id: {
          in: sessionIds,
        },
      },
      data: {
        revokedAt: new Date(),
        revokedReason: options?.reason ?? "Revoked by user",
      },
    });

    return sessionIds;
  }

  async updateLastSeen(sessionId: string) {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        lastSeenAt: new Date(),
      },
    });
  }

  async revokeAllExceptDevice(
    userId: string,
    currentSession: {
      id: string;
      deviceFingerprint?: string | null;
      userAgent?: string | null;
      deviceType?: string | null;
    },
    options?: {
      reason?: string;
    }
  ): Promise<string[]> {
    const activeSessions = await prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        deviceFingerprint: true,
        userAgent: true,
        deviceType: true,
      },
    });

    const sessionsToRevoke = activeSessions.filter(
      (session) => !sessionsMatchSameDevice(currentSession, session)
    );

    if (sessionsToRevoke.length === 0) {
      return [];
    }

    const sessionIds = sessionsToRevoke.map((session) => session.id);

    await prisma.session.updateMany({
      where: {
        id: {
          in: sessionIds,
        },
      },
      data: {
        revokedAt: new Date(),
        revokedReason: options?.reason ?? "Revoked by user",
      },
    });

    return sessionIds;
  }

  async createLoginSessionTransaction(params: CreateLoginSessionParams) {
    return await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Serialize per-user login session creation when no session rows exist yet
      await tx.$queryRaw`
        SELECT id FROM users WHERE id = ${params.userId} FOR UPDATE
      `;

      const lockedSessions = await tx.$queryRaw<
        Array<{
          id: string;
          deviceFingerprint: string | null;
          userAgent: string | null;
          deviceType: string;
        }>
      >`
        SELECT id, "deviceFingerprint", "userAgent", "deviceType"
        FROM sessions
        WHERE "userId" = ${params.userId}
          AND "revokedAt" IS NULL
          AND "expiresAt" > ${now}
        FOR UPDATE
      `;

      const targetSession = {
        id: params.id,
        deviceFingerprint: params.deviceMatch.deviceFingerprint,
        userAgent: params.deviceMatch.userAgent,
        deviceType: params.deviceMatch.deviceType,
      };

      const sessionsToRevoke = lockedSessions.filter((session) =>
        sessionsMatchSameDevice(targetSession, session)
      );

      const revokedSessionIds = sessionsToRevoke.map((session) => session.id);

      if (revokedSessionIds.length > 0) {
        await tx.session.updateMany({
          where: {
            id: {
              in: revokedSessionIds,
            },
          },
          data: {
            revokedAt: new Date(),
            revokedReason:
              params.revokeReason ?? "Replaced by new session on same device",
          },
        });
      }

      const maxActiveSessions = params.maxActiveSessions ?? Number.MAX_SAFE_INTEGER;
      const remainingAfterSameDeviceRevoke = lockedSessions.filter(
        (session) => !revokedSessionIds.includes(session.id)
      );

      if (remainingAfterSameDeviceRevoke.length >= maxActiveSessions) {
        const toRevokeCount =
          remainingAfterSameDeviceRevoke.length - maxActiveSessions + 1;
        const oldestSessions = await tx.session.findMany({
          where: {
            userId: params.userId,
            revokedAt: null,
            expiresAt: { gt: now },
            id: { notIn: revokedSessionIds },
          },
          orderBy: [{ lastSeenAt: "asc" }, { createdAt: "asc" }],
          take: toRevokeCount,
          select: { id: true },
        });

        const capRevokedIds = oldestSessions.map((session) => session.id);
        if (capRevokedIds.length > 0) {
          await tx.session.updateMany({
            where: { id: { in: capRevokedIds } },
            data: {
              revokedAt: new Date(),
              revokedReason: "Session cap exceeded",
            },
          });
          revokedSessionIds.push(...capRevokedIds);
        }
      }

      const session = await tx.session.create({
        data: {
          id: params.id,
          userId: params.userId,
          refreshTokenHash: params.refreshTokenHash,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          browserName: params.browserName ?? null,
          browserVersion: params.browserVersion ?? null,
          osName: params.osName ?? null,
          deviceType: (params.deviceType as any) ?? "UNKNOWN",
          deviceFingerprint: params.deviceFingerprint ?? null,
          expiresAt: params.expiresAt,
        },
      });

      return { session, revokedSessionIds };
    });
  }

  async rotateRefreshTokenTransaction(params: RotateRefreshTokenParams) {
    const result = await prisma.$transaction(async (tx) => {
      const lockedSession = await tx.$queryRaw<
        Array<{
          id: string;
          userId: string;
          refreshTokenHash: string;
          previousRefreshTokenHash: string | null;
          revokedAt: Date | null;
          expiresAt: Date;
          updatedAt: Date;
        }>
      >`
        SELECT id, "userId", "refreshTokenHash", "previousRefreshTokenHash", "revokedAt", "expiresAt", "updatedAt"
        FROM sessions
        WHERE id = ${params.sessionId}
        FOR UPDATE
      `;

      if (!lockedSession || lockedSession.length === 0) {
        throw new UnauthorizedError("Session not found");
      }

      const sessionLock = lockedSession[0]!;

      if (sessionLock.revokedAt) {
        throw new UnauthorizedError("Session has been revoked");
      }

      if (sessionLock.expiresAt < new Date()) {
        throw new UnauthorizedError("Session has expired");
      }

      if (sessionLock.refreshTokenHash !== params.expectedRefreshTokenHash) {
        const isPreviousHashReuse =
          sessionLock.previousRefreshTokenHash &&
          sessionLock.previousRefreshTokenHash === params.expectedRefreshTokenHash;
        const rotatedRecently =
          Date.now() - sessionLock.updatedAt.getTime() < REFRESH_ROTATION_GRACE_MS;

        if (isPreviousHashReuse && !rotatedRecently) {
          return {
            status: "reuse_detected" as const,
            userId: sessionLock.userId,
            sessionId: sessionLock.id,
          };
        }

        return {
          status: "already_rotated" as const,
          userId: sessionLock.userId,
          sessionId: sessionLock.id,
        };
      }

      const session = await tx.session.update({
        where: { id: params.sessionId },
        data: {
          previousRefreshTokenHash: sessionLock.refreshTokenHash,
          refreshTokenHash: params.newRefreshTokenHash,
          expiresAt: params.newExpiresAt,
          lastSeenAt: new Date(),
          ...(params.ipAddress !== undefined && { ipAddress: params.ipAddress }),
          ...(params.userAgent !== undefined && { userAgent: params.userAgent }),
          ...(params.ipAddress !== undefined && { lastIpAddress: params.ipAddress }),
        },
        include: {
          user: {
            include: {
              role: true,
            },
          },
        },
      });

      return {
        status: "rotated" as const,
        session,
      };
    });

    return result;
  }
}
