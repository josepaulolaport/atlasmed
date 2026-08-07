export interface CachedSession {
  id: number;
  userId: number;
  refreshTokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastSeenAt: string;
  createdAt: string;
  user?: {
    id: number;
    email: string;
    username: string;
    status: string;
    tokenVersion: number;
    role: {
      id: number;
      name: string;
    };
  };
}

export interface SupersededRefreshTokenInfo {
  sessionId: number;
  userId: number;
}

export interface ISessionCache {
  getById(sessionId: number): Promise<CachedSession | null>;
  getByTokenHash(tokenHash: string): Promise<CachedSession | null>;
  getSupersededSession(
    tokenHash: string
  ): Promise<SupersededRefreshTokenInfo | null>;
  set(session: CachedSession): Promise<void>;
  invalidate(sessionId: number): Promise<void>;
  invalidateByUserId(userId: number, excludeSessionId?: number): Promise<void>;
  updateLastSeen(sessionId: number): Promise<void>;
  updateAfterRefresh(
    session: CachedSession,
    previousRefreshTokenHash: string
  ): Promise<void>;
  isMarkedRevoked(sessionId: number): Promise<boolean>;
  /**
   * Clears a (possibly stale/false-positive) revoked marker for a session
   * that DB revalidation has confirmed is still healthy. Without this, a
   * marker set by a transient error can never self-heal — it just keeps
   * renewing its own TTL every time `invalidate` runs again.
   */
  clearRevoked(sessionId: number): Promise<void>;
  isRecentlyValidated(sessionId: number): Promise<boolean>;
  markValidated(sessionId: number): Promise<void>;
}
