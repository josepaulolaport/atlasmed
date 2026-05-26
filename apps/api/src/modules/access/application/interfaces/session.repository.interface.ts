export interface CreateSessionParams {
  id: string;

  userId: string;

  refreshTokenHash: string;

  ipAddress?: string | undefined;

  userAgent?: string | undefined;

  browserName?: string | null | undefined;

  browserVersion?: string | null | undefined;

  osName?: string | null | undefined;

  deviceType?: string | undefined;

  deviceFingerprint?: string | null | undefined;

  expiresAt: Date;
}

export interface RotateRefreshTokenParams {
  sessionId: string;
  expectedRefreshTokenHash: string;
  newRefreshTokenHash: string;
  newExpiresAt: Date;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface CreateLoginSessionParams extends CreateSessionParams {
  deviceMatch: {
    deviceFingerprint?: string | null;
    userAgent?: string | null;
    deviceType?: string | null;
  };
  revokeReason?: string;
}

export interface CreateLoginSessionResult {
  session: any;
  revokedSessionIds: string[];
}

export interface SessionStatus {
  userId: string;
  revokedAt: Date | null;
  expiresAt: Date;
}

export interface SessionRepository {
  create(params: CreateSessionParams): Promise<any>;

  findActiveByTokenHash(tokenHash: string): Promise<any>;

  findById(sessionId: string): Promise<any>;

  findSessionStatus(sessionId: string): Promise<SessionStatus | null>;

  findByUserId(userId: string): Promise<any[]>;

  revoke(sessionId: string): Promise<void>;

  revokeForSecurityViolation(sessionId: string): Promise<void>;

  revokeAllByUserId(userId: string, excludeSessionId?: string): Promise<void>;

  revokeActiveByUserAndDeviceFingerprint(
    userId: string,
    deviceFingerprint: string,
    options?: {
      reason?: string;
      excludeSessionId?: string;
    }
  ): Promise<string[]>;

  revokeAllActiveForDevice(
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
  ): Promise<string[]>;

  updateLastSeen(sessionId: string): Promise<void>;

  rotateRefreshTokenTransaction(params: RotateRefreshTokenParams): Promise<any>;

  createLoginSessionTransaction(
    params: CreateLoginSessionParams
  ): Promise<CreateLoginSessionResult>;

  revokeAllExceptDevice(
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
  ): Promise<string[]>;
}
