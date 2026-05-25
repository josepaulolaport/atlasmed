export interface FindUserByIdentifierParams {
  identifier: string;
}

export interface CreateUserParams {
  email: string;

  username: string;

  phoneNumber?: string | undefined;

  passwordHash: string;

  roleId: string;

  firstName?: string | undefined;

  lastName?: string | undefined;

  emailVerified?: boolean | undefined;

  phoneVerified?: boolean | undefined;

  status?: string | undefined;
}

export interface UpdatePasswordParams {
  userId: string;
  passwordHash: string;
}

export interface ResetPasswordTransactionParams {
  tokenHash: string;
  newPasswordHash: string;
}

export interface ResetPasswordTransactionResult {
  user: any;
  passwordReset: any;
}

export interface UserRepository {
  findByIdentifier(params: FindUserByIdentifierParams): Promise<any>;

  findById(id: string): Promise<any>;

  create(params: CreateUserParams): Promise<any>;

  updateLastLogin(userId: string): Promise<void>;

  updatePassword(params: UpdatePasswordParams): Promise<void>;

  deactivate(userId: string): Promise<void>;

  activate(userId: string): Promise<void>;

  suspend(userId: string): Promise<void>;

  unsuspend(userId: string): Promise<void>;

  delete(userId: string): Promise<void>;

  resetPasswordTransaction(params: ResetPasswordTransactionParams): Promise<ResetPasswordTransactionResult>;
}
