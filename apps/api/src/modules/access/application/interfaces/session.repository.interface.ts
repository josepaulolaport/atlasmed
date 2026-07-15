export interface SessionRecord {
  id: string
  userId: string
  refreshTokenHash: string
  previousRefreshTokenHash: string | null
  expiresAt: Date
  revokedAt: Date | null
  revokedReason: string | null
  ipAddress: string | null
  userAgent: string | null
  browserName: string | null
  browserVersion: string | null
  osName: string | null
  deviceType: string | null
  deviceFingerprint: string | null
  lastSeenAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface SessionWithUserRecord extends SessionRecord {
  user: {
    id: string
    email: string | null
    username: string
    status: string
    tokenVersion: number
    role: {
      id: string
      name: string
    }
  }
}

export interface CreateSessionParams {
  id: string

  userId: string

  refreshTokenHash: string

  ipAddress?: string | undefined

  userAgent?: string | undefined

  browserName?: string | null | undefined

  browserVersion?: string | null | undefined

  osName?: string | null | undefined

  deviceType?: string | undefined

  deviceFingerprint?: string | null | undefined

  expiresAt: Date
}

export interface RotateRefreshTokenParams {
  sessionId: string
  expectedRefreshTokenHash: string
  newRefreshTokenHash: string
  newExpiresAt: Date
  ipAddress?: string | undefined
  userAgent?: string | undefined
}

export interface CreateLoginSessionParams extends CreateSessionParams {
  deviceMatch: {
    deviceFingerprint?: string | null
    userAgent?: string | null
    deviceType?: string | null
  }
  revokeReason?: string
  maxActiveSessions?: number
}

export interface CreateLoginSessionResult {
  session: SessionRecord
  revokedSessionIds: string[]
}

export interface SessionStatus {
  userId: string
  revokedAt: Date | null
  expiresAt: Date
}

export interface PreviousRefreshTokenSession {
  id: string
  userId: string
  updatedAt: Date
}

export interface RotateRefreshTokenResult {
  session: SessionWithUserRecord
}

export type RotateRefreshTokenTransactionResult =
  | { status: 'rotated'; session: SessionWithUserRecord }
  | { status: 'reuse_detected'; userId: string; sessionId: string }
  | { status: 'already_rotated'; userId: string; sessionId: string }

export interface SessionRepository {
  create(params: CreateSessionParams): Promise<SessionRecord>

  findActiveByTokenHash(tokenHash: string): Promise<SessionWithUserRecord | null>

  findActiveByPreviousRefreshTokenHash(
    tokenHash: string
  ): Promise<PreviousRefreshTokenSession | null>

  findById(sessionId: string): Promise<SessionWithUserRecord | null>

  findSessionStatus(sessionId: string): Promise<SessionStatus | null>

  findByUserId(userId: string): Promise<SessionRecord[]>

  revoke(sessionId: string): Promise<void>

  revokeForSecurityViolation(sessionId: string): Promise<void>

  revokeAllByUserId(userId: string, excludeSessionId?: string): Promise<void>

  revokeActiveByUserAndDeviceFingerprint(
    userId: string,
    deviceFingerprint: string,
    options?: {
      reason?: string
      excludeSessionId?: string
    }
  ): Promise<string[]>

  revokeAllActiveForDevice(
    userId: string,
    targetSession: {
      id: string
      deviceFingerprint?: string | null
      userAgent?: string | null
      deviceType?: string | null
    },
    options?: {
      reason?: string
    }
  ): Promise<string[]>

  updateLastSeen(sessionId: string): Promise<void>

  rotateRefreshTokenTransaction(
    params: RotateRefreshTokenParams
  ): Promise<RotateRefreshTokenTransactionResult>

  createLoginSessionTransaction(params: CreateLoginSessionParams): Promise<CreateLoginSessionResult>

  revokeAllExceptDevice(
    userId: string,
    currentSession: {
      id: string
      deviceFingerprint?: string | null
      userAgent?: string | null
      deviceType?: string | null
    },
    options?: {
      reason?: string
    }
  ): Promise<string[]>
}
