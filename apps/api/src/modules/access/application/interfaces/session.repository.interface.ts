export interface SessionRecord {
  id: number;
  userId: number;
  refreshTokenHash: string;
  previousRefreshTokenHash: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  browserName: string | null;
  browserVersion: string | null;
  osName: string | null;
  deviceType: string | null;
  deviceFingerprint: string | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionWithUserRecord extends SessionRecord {
  user: {
    id: number;
    email: string | null;
    username: string;
    status: string;
    tokenVersion: number;
    role: {
      id: number;
      name: string;
    };
  };
}

export interface CreateSessionParams {
  userId: number;

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
  sessionId: number;
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
  maxActiveSessions?: number;
}

export interface CreateLoginSessionResult {
  session: SessionRecord;
  revokedSessionIds: number[];
}

export interface SessionStatus {
  userId: number;
  revokedAt: Date | null;
  expiresAt: Date;
}

export interface PreviousRefreshTokenSession {
  id: number;
  userId: number;
  updatedAt: Date;
}

export interface RotateRefreshTokenResult {
  session: SessionWithUserRecord;
}

export type RotateRefreshTokenTransactionResult =
  | { status: "rotated"; session: SessionWithUserRecord }
  | { status: "reuse_detected"; userId: number; sessionId: number }
  | { status: "already_rotated"; userId: number; sessionId: number };

export interface SessionRepository {
  create(params: CreateSessionParams): Promise<SessionRecord>;

  findActiveByTokenHash(tokenHash: string): Promise<SessionWithUserRecord | null>;

  findActiveByPreviousRefreshTokenHash(
    tokenHash: string
  ): Promise<PreviousRefreshTokenSession | null>;

  findById(sessionId: number): Promise<SessionWithUserRecord | null>;

  findSessionStatus(sessionId: number): Promise<SessionStatus | null>;

  findByUserId(userId: number): Promise<SessionRecord[]>;

  revoke(sessionId: number): Promise<void>;

  revokeForSecurityViolation(sessionId: number): Promise<void>;

  revokeAllByUserId(userId: number, excludeSessionId?: number): Promise<void>;

  revokeActiveByUserAndDeviceFingerprint(
    userId: number,
    deviceFingerprint: string,
    options?: {
      reason?: string;
      excludeSessionId?: number;
    }
  ): Promise<number[]>;

  revokeAllActiveForDevice(
    userId: number,
    targetSession: {
      id: number;
      deviceFingerprint?: string | null;
      userAgent?: string | null;
      deviceType?: string | null;
    },
    options?: {
      reason?: string;
    }
  ): Promise<number[]>;

  updateLastSeen(sessionId: number): Promise<void>;

  rotateRefreshTokenTransaction(
    params: RotateRefreshTokenParams
  ): Promise<RotateRefreshTokenTransactionResult>;

  createLoginSessionTransaction(
    params: CreateLoginSessionParams
  ): Promise<CreateLoginSessionResult>;

  revokeAllExceptDevice(
    userId: number,
    currentSession: {
      id: number;
      deviceFingerprint?: string | null;
      userAgent?: string | null;
      deviceType?: string | null;
    },
    options?: {
      reason?: string;
    }
  ): Promise<number[]>;
}
