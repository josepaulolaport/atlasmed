export interface CachedSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastSeenAt: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    username: string;
    status: string;
    tokenVersion: number;
    role: {
      id: string;
      name: string;
    };
  };
}

export interface SupersededRefreshTokenInfo {
  sessionId: string;
  userId: string;
}

export interface ISessionCache {
  getById(sessionId: string): Promise<CachedSession | null>;
  getByTokenHash(tokenHash: string): Promise<CachedSession | null>;
  getSupersededSession(
    tokenHash: string
  ): Promise<SupersededRefreshTokenInfo | null>;
  set(session: CachedSession): Promise<void>;
  invalidate(sessionId: string): Promise<void>;
  invalidateByUserId(userId: string, excludeSessionId?: string): Promise<void>;
  updateLastSeen(sessionId: string): Promise<void>;
  updateAfterRefresh(
    session: CachedSession,
    previousRefreshTokenHash: string
  ): Promise<void>;
  isMarkedRevoked(sessionId: string): Promise<boolean>;
  isRecentlyValidated(sessionId: string): Promise<boolean>;
  markValidated(sessionId: string): Promise<void>;
}
