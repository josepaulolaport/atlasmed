import { randomUUID } from "node:crypto";

import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";

import { hashToken } from "../../../../shared/utils/hash-token";

import { generateRandomToken } from "../../../../shared/utils/generate-random-token";

import { getSessionExpiry } from "../constants/session.constants";

import type { Role } from "@atlasmed/access";

interface Dependencies {
  sessionRepository: SessionRepository;
  sessionCache: ISessionCache;
}

interface CreateSessionInput {
  userId: string;
  userRole: Role;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export class SessionService {
  constructor(private readonly deps: Dependencies) {}

  async create(params: CreateSessionInput) {
    const refreshToken = generateRandomToken();

    const refreshTokenHash = hashToken(refreshToken);

    const expiryDuration = getSessionExpiry(params.userRole);

    const session = await this.deps.sessionRepository.create({
      id: randomUUID(),

      userId: params.userId,

      refreshTokenHash,

      ipAddress: params.ipAddress || undefined,

      userAgent: params.userAgent || undefined,

      expiresAt: new Date(Date.now() + expiryDuration),
    });

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

  async revokeAllByUserId(userId: string, excludeSessionId?: string) {
    await this.deps.sessionRepository.revokeAllByUserId(
      userId,
      excludeSessionId
    );
    await this.deps.sessionCache.invalidateByUserId(userId, excludeSessionId);
  }
}
