export interface PasswordResetRecord {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}

export interface PasswordResetWithUserRecord extends PasswordResetRecord {
  user: {
    id: string
    email: string | null
    username: string
    phoneNumber: string | null
    passwordHash: string
    passwordHistory: string[]
    role: { id: string; name: string }
  }
}

export interface CreatePasswordResetParams {
  userId: string

  tokenHash: string

  expiresAt: Date
}

export interface FindPasswordResetByTokenParams {
  tokenHash: string
}

export interface PasswordResetRepository {
  create(params: CreatePasswordResetParams): Promise<PasswordResetRecord>

  findByToken(params: FindPasswordResetByTokenParams): Promise<PasswordResetWithUserRecord | null>

  markAsUsed(id: string): Promise<void>

  invalidateUnusedForUser(userId: string): Promise<void>

  deleteExpired(): Promise<void>
}
