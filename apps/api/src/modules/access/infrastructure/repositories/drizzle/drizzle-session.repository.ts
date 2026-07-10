import { eq, and, isNull, inArray, notInArray, asc, desc, gt, ne, sql } from "drizzle-orm";
import { users, roles, sessions } from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import { UnauthorizedError } from "../../../../../shared/errors";
import { sessionsMatchSameDevice } from "../../../../../shared/utils/device-fingerprint";

import type {
  SessionRepository,
  CreateSessionParams,
  CreateLoginSessionParams,
  RotateRefreshTokenParams,
} from "../../../application/interfaces/session.repository.interface";
import { REFRESH_ROTATION_GRACE_MS } from "../../../application/constants/refresh-token.constants";

export class DrizzleSessionRepository implements SessionRepository {
  async create(params: CreateSessionParams) {
    const [session] = await db
      .insert(sessions)
      .values({
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
      })
      .returning();

    return session!;
  }

  async findActiveByTokenHash(tokenHash: string) {
    const [row] = await db
      .select()
      .from(sessions)
      .leftJoin(users, eq(sessions.userId, users.id))
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(
        and(
          eq(sessions.refreshTokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!row) return null;
    return { ...row.sessions, user: { ...row.users!, role: row.roles! } };
  }

  async findActiveByPreviousRefreshTokenHash(tokenHash: string) {
    const [row] = await db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        updatedAt: sessions.updatedAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.previousRefreshTokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async findById(sessionId: string) {
    const [row] = await db
      .select()
      .from(sessions)
      .leftJoin(users, eq(sessions.userId, users.id))
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!row) return null;
    return { ...row.sessions, user: { ...row.users!, role: row.roles! } };
  }

  async findSessionStatus(sessionId: string) {
    const [row] = await db
      .select({
        userId: sessions.userId,
        revokedAt: sessions.revokedAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    return row ?? null;
  }

  async findByUserId(userId: string) {
    const activeSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(sessions.lastSeenAt), desc(sessions.createdAt));

    const activeSessionsPerDevice: typeof activeSessions = [];

    for (const session of activeSessions) {
      const isDuplicateDevice = activeSessionsPerDevice.some((existing) =>
        sessionsMatchSameDevice(existing, session),
      );

      if (isDuplicateDevice) {
        continue;
      }

      activeSessionsPerDevice.push(session);
    }

    return activeSessionsPerDevice;
  }

  async revoke(sessionId: string) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  async revokeForSecurityViolation(sessionId: string) {
    await db
      .update(sessions)
      .set({
        revokedAt: new Date(),
        revokedReason: "Session security violation",
        suspiciousActivity: true,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));
  }

  async revokeAllByUserId(userId: string, excludeSessionId?: string) {
    const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];

    if (excludeSessionId) {
      conditions.push(ne(sessions.id, excludeSessionId) as any);
    }

    await db
      .update(sessions)
      .set({
        revokedAt: new Date(),
        revokedReason: "User deactivation or logout all",
        updatedAt: new Date(),
      })
      .where(and(...conditions));
  }

  async revokeActiveByUserAndDeviceFingerprint(
    userId: string,
    deviceFingerprint: string,
    options?: {
      reason?: string;
      excludeSessionId?: string;
    },
  ): Promise<string[]> {
    const conditions = [
      eq(sessions.userId, userId),
      eq(sessions.deviceFingerprint, deviceFingerprint as any),
      isNull(sessions.revokedAt),
    ];

    if (options?.excludeSessionId) {
      conditions.push(ne(sessions.id, options.excludeSessionId) as any);
    }

    const toRevoke = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(...conditions));

    if (toRevoke.length === 0) {
      return [];
    }

    const sessionIds = toRevoke.map((s) => s.id);

    await db
      .update(sessions)
      .set({
        revokedAt: new Date(),
        revokedReason: options?.reason ?? "Replaced by new session on same device",
        updatedAt: new Date(),
      })
      .where(inArray(sessions.id, sessionIds));

    return sessionIds;
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
    },
  ): Promise<string[]> {
    const activeSessions = await db
      .select({
        id: sessions.id,
        deviceFingerprint: sessions.deviceFingerprint,
        userAgent: sessions.userAgent,
        deviceType: sessions.deviceType,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      );

    const sessionsToRevoke = activeSessions.filter((session) =>
      sessionsMatchSameDevice(targetSession, session),
    );

    if (sessionsToRevoke.length === 0) {
      return [];
    }

    const sessionIds = sessionsToRevoke.map((s) => s.id);

    await db
      .update(sessions)
      .set({
        revokedAt: new Date(),
        revokedReason: options?.reason ?? "Revoked by user",
        updatedAt: new Date(),
      })
      .where(inArray(sessions.id, sessionIds));

    return sessionIds;
  }

  async updateLastSeen(sessionId: string) {
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(sessions.id, sessionId));
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
    },
  ): Promise<string[]> {
    const activeSessions = await db
      .select({
        id: sessions.id,
        deviceFingerprint: sessions.deviceFingerprint,
        userAgent: sessions.userAgent,
        deviceType: sessions.deviceType,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      );

    const sessionsToRevoke = activeSessions.filter(
      (session) => !sessionsMatchSameDevice(currentSession, session),
    );

    if (sessionsToRevoke.length === 0) {
      return [];
    }

    const sessionIds = sessionsToRevoke.map((s) => s.id);

    await db
      .update(sessions)
      .set({
        revokedAt: new Date(),
        revokedReason: options?.reason ?? "Revoked by user",
        updatedAt: new Date(),
      })
      .where(inArray(sessions.id, sessionIds));

    return sessionIds;
  }

  async createLoginSessionTransaction(params: CreateLoginSessionParams) {
    return await db.transaction(async (tx) => {
      const now = new Date();

      // Serialize per-user login session creation when no session rows exist yet
      await tx.execute(sql`
        SELECT id FROM users WHERE id = ${params.userId} FOR UPDATE
      `);

      const lockedSessions = await tx.execute<{
        id: string;
        deviceFingerprint: string | null;
        userAgent: string | null;
        deviceType: string;
      }>(sql`
        SELECT id, "deviceFingerprint", "userAgent", "deviceType"
        FROM sessions
        WHERE "userId" = ${params.userId}
          AND "revokedAt" IS NULL
          AND "expiresAt" > ${now}
        FOR UPDATE
      `);

      const targetSession = {
        id: params.id,
        deviceFingerprint: params.deviceMatch.deviceFingerprint,
        userAgent: params.deviceMatch.userAgent,
        deviceType: params.deviceMatch.deviceType,
      };

      const sessionsToRevoke = Array.from(lockedSessions).filter((session) =>
        sessionsMatchSameDevice(targetSession, session),
      );

      const revokedSessionIds = sessionsToRevoke.map((session) => session.id);

      if (revokedSessionIds.length > 0) {
        await tx
          .update(sessions)
          .set({
            revokedAt: new Date(),
            revokedReason: params.revokeReason ?? "Replaced by new session on same device",
            updatedAt: new Date(),
          })
          .where(inArray(sessions.id, revokedSessionIds));
      }

      const maxActiveSessions = params.maxActiveSessions ?? Number.MAX_SAFE_INTEGER;
      const remainingAfterSameDeviceRevoke = Array.from(lockedSessions).filter(
        (session) => !revokedSessionIds.includes(session.id),
      );

      if (remainingAfterSameDeviceRevoke.length >= maxActiveSessions) {
        const toRevokeCount = remainingAfterSameDeviceRevoke.length - maxActiveSessions + 1;
        const oldestSessions = await tx
          .select({ id: sessions.id })
          .from(sessions)
          .where(
            and(
              eq(sessions.userId, params.userId),
              isNull(sessions.revokedAt),
              gt(sessions.expiresAt, now),
              revokedSessionIds.length > 0
                ? notInArray(sessions.id, revokedSessionIds)
                : sql`true`,
            ),
          )
          .orderBy(asc(sessions.lastSeenAt), asc(sessions.createdAt))
          .limit(toRevokeCount);

        const capRevokedIds = oldestSessions.map((s) => s.id);
        if (capRevokedIds.length > 0) {
          await tx
            .update(sessions)
            .set({
              revokedAt: new Date(),
              revokedReason: "Session cap exceeded",
              updatedAt: new Date(),
            })
            .where(inArray(sessions.id, capRevokedIds));
          revokedSessionIds.push(...capRevokedIds);
        }
      }

      const [session] = await tx
        .insert(sessions)
        .values({
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
        })
        .returning();

      return { session: session!, revokedSessionIds };
    });
  }

  async rotateRefreshTokenTransaction(params: RotateRefreshTokenParams) {
    const result = await db.transaction(async (tx) => {
      const lockedSession = await tx.execute<{
        id: string;
        userId: string;
        refreshTokenHash: string;
        previousRefreshTokenHash: string | null;
        revokedAt: Date | null;
        expiresAt: Date;
        updatedAt: Date;
      }>(sql`
        SELECT id, "userId", "refreshTokenHash", "previousRefreshTokenHash", "revokedAt", "expiresAt", "updatedAt"
        FROM sessions
        WHERE id = ${params.sessionId}
        FOR UPDATE
      `);

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
          Date.now() - new Date(sessionLock.updatedAt).getTime() < REFRESH_ROTATION_GRACE_MS;

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

      const updateSet: Record<string, unknown> = {
        previousRefreshTokenHash: sessionLock.refreshTokenHash,
        refreshTokenHash: params.newRefreshTokenHash,
        expiresAt: params.newExpiresAt,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      };

      if (params.ipAddress !== undefined) {
        updateSet.ipAddress = params.ipAddress;
        updateSet.lastIpAddress = params.ipAddress;
      }

      if (params.userAgent !== undefined) {
        updateSet.userAgent = params.userAgent;
      }

      const [updatedSession] = await tx
        .update(sessions)
        .set(updateSet)
        .where(eq(sessions.id, params.sessionId))
        .returning();

      const [userRow] = await tx
        .select()
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.id, updatedSession!.userId))
        .limit(1);

      const session = {
        ...updatedSession!,
        user: { ...userRow!.users, role: userRow!.roles! },
      };

      return {
        status: "rotated" as const,
        session,
      };
    });

    return result;
  }
}
