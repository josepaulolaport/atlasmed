export interface CreateInviteParams {
  email?: string | undefined;
  phoneNumber?: string | undefined;
  tokenHash: string;
  roleId: string;
  invitedByUserId: string;
  expiresAt: Date;
}

export interface AcceptInviteTransactionParams {
  tokenHash: string;
  email: string;
  phoneNumber?: string | undefined;
  username: string;
  passwordHash: string;
  firstName?: string | undefined;
  lastName?: string | undefined;
}

export interface AcceptInviteTransactionResult {
  user: any;
  invite: any;
}

export interface InviteRepository {
  create(params: CreateInviteParams): Promise<any>;

  findValidByTokenHash(tokenHash: string): Promise<any>;

  findById(inviteId: string): Promise<any>;

  findByEmailOrPhone(email?: string | undefined, phoneNumber?: string | undefined): Promise<any>;

  findAll(params?: {
    status?: string;
    page?: number;
    limit?: number;
    invitedByUserId?: string;
  }): Promise<{ invitations: any[]; total: number }>;

  markAccepted(inviteId: string, userId: string): Promise<void>;

  revoke(inviteId: string): Promise<void>;

  cleanupExpired(): Promise<number>;

  acceptInviteTransaction(params: AcceptInviteTransactionParams): Promise<AcceptInviteTransactionResult>;
}
