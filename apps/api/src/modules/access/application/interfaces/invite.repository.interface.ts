export interface InviteRecord {
  id: number;
  email: string | null;
  phoneNumber: string | null;
  status: string;
  roleId: number;
  role: {
    id: number;
    name: string;
    priority?: number | null;
  };
  invitedByUserId: number;
  firstName: string | null;
  lastName: string | null;
  birthDate: Date | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: number | null;
  revokedAt: Date | null;
  resendCount: number;
  lastResendAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InviteVerticalAssignmentParams {
  verticalId: number;
  territoryIds: number[];
}

export interface CreateInviteParams {
  email?: string | undefined;
  phoneNumber?: string | undefined;
  tokenHash: string;
  roleId: number;
  invitedByUserId: number;
  firstName?: string | undefined;
  lastName?: string | undefined;
  birthDate?: Date | undefined;
  verticalAssignments?: InviteVerticalAssignmentParams[];
  expiresAt: Date;
}

export interface AcceptInviteTransactionParams {
  tokenHash: string;
  email: string;
  phoneNumber?: string | undefined;
  username: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
}

export interface AcceptInviteTransactionResult {
  user: {
    id: number;
    email: string | null;
    username: string;
    firstName: string | null;
    lastName: string | null;
    status: string;
    roleId: number;
    role: { id: number; name: string };
    createdAt: Date;
    updatedAt: Date;
  };
  invite: InviteRecord;
}

export interface InviteStagedVerticalAssignment {
  invitationId: number;
  verticalId: number;
  territoryIds: number[];
}

export interface UpdatePendingInviteParams {
  inviteId: number;
  email?: string | undefined;
  phoneNumber?: string | null | undefined;
  roleId?: number | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  birthDate?: Date | undefined;
  verticalAssignments?: InviteVerticalAssignmentParams[];
}

export interface InviteRepository {
  create(params: CreateInviteParams): Promise<InviteRecord>;

  findValidByTokenHash(tokenHash: string): Promise<InviteRecord | null>;

  findById(inviteId: number): Promise<InviteRecord | null>;

  findByEmailOrPhone(email?: string | undefined, phoneNumber?: string | undefined): Promise<InviteRecord | null>;

  findAll(params?: {
    status?: string;
    page?: number;
    limit?: number;
    invitedByUserId?: number;
  }): Promise<{ invitations: InviteRecord[]; total: number }>;

  findStagedVerticalAssignments(
    invitationIds: number[],
  ): Promise<InviteStagedVerticalAssignment[]>;

  updatePending(params: UpdatePendingInviteParams): Promise<InviteRecord>;

  markAccepted(inviteId: number, userId: number): Promise<void>;

  revoke(inviteId: number): Promise<void>;

  regenerateToken(
    inviteId: number,
    params: { tokenHash: string; expiresAt: Date }
  ): Promise<InviteRecord>;

  cleanupExpired(): Promise<number>;

  acceptInviteTransaction(params: AcceptInviteTransactionParams): Promise<AcceptInviteTransactionResult>;
}
