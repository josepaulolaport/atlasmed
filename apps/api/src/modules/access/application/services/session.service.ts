import { randomUUID } from "node:crypto";

import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";

import { hashToken } from "../../../../shared/utils/hash-token";

import { generateRandomToken } from "../../../../shared/utils/generate-random-token";

import {
  getSessionExpiresAt,
} from "../constants/session.constants";

import { parseUserAgent } from "../../../../shared/utils/parse-user-agent";

import { generateDeviceFingerprint } from "../../../../shared/utils/device-fingerprint";

import type { Role } from "@atlasmed/access";
import { environment } from "../../../../app/config/environment";

interface Dependencies {
  sessionRepository: SessionRepository;
  sessionCache: ISessionCache;
}

interface CreateSessionInput {
  userId: string;
  userRole: Role;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  acceptLanguage?: string | undefined;
}

export interface GeneratedSessionData {
  id: string;
  refreshToken: string;
  refreshTokenHash: string;
  expiresAt: Date;
}

export interface GeneratedRefreshCredentials {
  refreshToken: string;
  refreshTokenHash: string;
  expiresAt: Date;
}

export class SessionService {
  constructor(private readonly deps: Dependencies) {}

  buildRefreshCredentials(params: {
    userRole: Role;
    from?: Date;
  }): GeneratedRefreshCredentials {
    const refreshToken = generateRandomToken();

    return {
      refreshToken,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: getSessionExpiresAt(params.userRole, params.from),
    };
  }

  /**
   * Generate session data for a new authentication event (login).
   */
  generateSessionData(params: CreateSessionInput): GeneratedSessionData {
    const credentials = this.buildRefreshCredentials({ userRole: params.userRole });

    return {
      id: randomUUID(),
      ...credentials,
    };
  }

  async create(params: CreateSessionInput) {
    const parsed = parseUserAgent(params.userAgent);
    const deviceFingerprint = generateDeviceFingerprint({
      userAgent: params.userAgent,
      acceptLanguage: params.acceptLanguage,
    });

    const { id, refreshToken, refreshTokenHash, expiresAt } =
      this.generateSessionData(params);

    const { session, revokedSessionIds } =
      await this.deps.sessionRepository.createLoginSessionTransaction({
        id,

        userId: params.userId,

        refreshTokenHash,

        ipAddress: params.ipAddress || undefined,

        userAgent: params.userAgent || undefined,

        browserName: parsed.browserName,

        browserVersion: parsed.browserVersion,

        osName: parsed.osName,

        deviceType: parsed.deviceType,

        deviceFingerprint,

        expiresAt,

        deviceMatch: {
          deviceFingerprint,
          userAgent: params.userAgent ?? null,
          deviceType: parsed.deviceType,
        },

        revokeReason: "Replaced by new session on same device",

        maxActiveSessions: environment.MAX_ACTIVE_SESSIONS_PER_USER,
      });

    await Promise.all(
      revokedSessionIds.map((sessionId) =>
        this.deps.sessionCache.invalidate(sessionId)
      )
    );

    await this.deps.sessionCache.set({
      id: session.id,
      userId: session.userId,
      refreshTokenHash: session.refreshTokenHash,
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: null,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      lastSeenAt: session.lastSeenAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
    });

    return {
      ...session,

      refreshToken,
    };
  }

  async revoke(sessionId: string) {
    await this.deps.sessionRepository.revoke(sessionId);
    await this.deps.sessionCache.invalidate(sessionId);
  }

  async revokeForSecurityViolation(sessionId: string) {
    await this.deps.sessionRepository.revokeForSecurityViolation(sessionId);
    await this.deps.sessionCache.invalidate(sessionId);
  }

  async revokeAllByUserId(userId: string, excludeSessionId?: string) {
    await this.deps.sessionRepository.revokeAllByUserId(
      userId,
      excludeSessionId
    );
    await this.deps.sessionCache.invalidateByUserId(userId, excludeSessionId);
  }
}
