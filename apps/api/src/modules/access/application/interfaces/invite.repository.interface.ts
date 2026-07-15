export interface InviteRecord {
  id: string
  email: string | null
  phoneNumber: string | null
  status: string
  roleId: string
  role: {
    id: string
    name: string
    priority?: number | null
  }
  invitedByUserId: string
  firstName: string | null
  lastName: string | null
  managerId: string | null
  managerTerritoryId: string | null
  repTerritoryId: string | null
  expiresAt: Date
  acceptedAt: Date | null
  acceptedByUserId: string | null
  revokedAt: Date | null
  resendCount: number
  lastResendAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateInviteParams {
  email?: string | undefined
  phoneNumber?: string | undefined
  tokenHash: string
  roleId: string
  invitedByUserId: string
  firstName?: string | undefined
  lastName?: string | undefined
  managerId?: string | undefined
  managerTerritoryId?: string | undefined
  repTerritoryId?: string | undefined
  expiresAt: Date
}

export interface AcceptInviteTransactionParams {
  tokenHash: string
  email: string
  phoneNumber?: string | undefined
  username: string
  passwordHash: string
  firstName?: string | undefined
  lastName?: string | undefined
}

export interface AcceptInviteTransactionResult {
  user: {
    id: string
    email: string | null
    username: string
    firstName: string | null
    lastName: string | null
    status: string
    roleId: string
    role: { id: string; name: string }
    createdAt: Date
    updatedAt: Date
  }
  invite: InviteRecord
}

export interface InviteRepository {
  create(params: CreateInviteParams): Promise<InviteRecord>

  findValidByTokenHash(tokenHash: string): Promise<InviteRecord | null>

  findById(inviteId: string): Promise<InviteRecord | null>

  findByEmailOrPhone(
    email?: string | undefined,
    phoneNumber?: string | undefined
  ): Promise<InviteRecord | null>

  findAll(params?: {
    status?: string
    page?: number
    limit?: number
    invitedByUserId?: string
  }): Promise<{ invitations: InviteRecord[]; total: number }>

  markAccepted(inviteId: string, userId: string): Promise<void>

  revoke(inviteId: string): Promise<void>

  regenerateToken(
    inviteId: string,
    params: { tokenHash: string; expiresAt: Date }
  ): Promise<InviteRecord>

  cleanupExpired(): Promise<number>

  acceptInviteTransaction(
    params: AcceptInviteTransactionParams
  ): Promise<AcceptInviteTransactionResult>
}
