export interface PasswordResetRecord {
  id: number;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface PasswordResetWithUserRecord extends PasswordResetRecord {
  user: {
    id: number;
    email: string | null;
    username: string;
    phoneNumber: string | null;
    passwordHash: string;
    passwordHistory: string[];
    role: { id: number; name: string };
  };
}

export interface CreatePasswordResetParams {
  userId: number;

  tokenHash: string;

  expiresAt: Date;
}

export interface FindPasswordResetByTokenParams {
  tokenHash: string;
}

export interface PasswordResetRepository {
  create(params: CreatePasswordResetParams): Promise<PasswordResetRecord>;

  findByToken(params: FindPasswordResetByTokenParams): Promise<PasswordResetWithUserRecord | null>;

  markAsUsed(id: number): Promise<void>;

  invalidateUnusedForUser(userId: number): Promise<void>;

  deleteExpired(): Promise<void>;
}
