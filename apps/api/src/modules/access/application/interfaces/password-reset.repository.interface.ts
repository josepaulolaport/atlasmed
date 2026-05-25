export interface CreatePasswordResetParams {
  userId: string;

  tokenHash: string;

  expiresAt: Date;
}

export interface FindPasswordResetByTokenParams {
  tokenHash: string;
}

export interface PasswordResetRepository {
  create(params: CreatePasswordResetParams): Promise<any>;

  findByToken(params: FindPasswordResetByTokenParams): Promise<any | null>;

  markAsUsed(id: string): Promise<void>;

  deleteExpired(): Promise<void>;
}
