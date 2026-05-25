export interface CreateSessionParams {
  id: string;

  userId: string;

  refreshTokenHash: string;

  ipAddress?: string | undefined;

  userAgent?: string | undefined;

  expiresAt: Date;
}

export interface RotateSessionParams {
  oldSessionId: string;
  newSessionId: string;
  newRefreshTokenHash: string;
  newExpiresAt: Date;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface SessionRepository {
  create(params: CreateSessionParams): Promise<any>;

  findActiveByTokenHash(tokenHash: string): Promise<any>;

  findById(sessionId: string): Promise<any>;

  findByUserId(userId: string): Promise<any[]>;

  revoke(sessionId: string): Promise<void>;

  revokeAllByUserId(userId: string, excludeSessionId?: string): Promise<void>;

  updateLastSeen(sessionId: string): Promise<void>;

  rotateSessionTransaction(params: RotateSessionParams): Promise<any>;
}
