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

export interface UserAuthStatus {
  status: string;
  tokenVersion: number;
  roleId: string;
  roleName: string;
}

export interface EmailVerificationState {
  email: string;
  emailVerified: boolean;
}

export interface PhoneVerificationState {
  phoneNumber: string | null;
  phoneVerified: boolean;
}

export interface UserIdentifierMatch {
  id: string;
}

export interface FindAllUsersParams {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  scope?: UserListScopeFilter;
}

export interface UserListScopeFilter {
  isGlobal: boolean;
  territoryIds: string[];
  managedUserIds?: string[];
}

export interface UpdateProfileParams {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface ChangeRoleTransactionParams {
  userId: string;
  newRoleId: string;
}

export interface ChangePasswordTransactionParams {
  userId: string;
  newPasswordHash: string;
  previousPasswordHash: string;
  passwordHistory: string[];
  revokeOtherSessions: boolean;
  keepSessionId?: string;
}

export interface ChangePasswordTransactionResult {
  user: any;
}

export interface EnableTwoFactorParams {
  userId: string;
  encryptedSecret: string;
}

export interface UserRepository {
  findByIdentifier(params: FindUserByIdentifierParams): Promise<any>;

  findById(id: string): Promise<any>;

  findUserAuthStatus(userId: string): Promise<UserAuthStatus | null>;

  create(params: CreateUserParams): Promise<any>;

  updateLastLogin(userId: string): Promise<void>;

  updatePassword(params: UpdatePasswordParams): Promise<void>;

  deactivate(userId: string): Promise<void>;

  activate(userId: string): Promise<void>;

  suspend(userId: string): Promise<void>;

  unsuspend(userId: string): Promise<void>;

  updateRole(userId: string, roleId: string): Promise<void>;

  changeRoleTransaction(params: ChangeRoleTransactionParams): Promise<void>;

  changePasswordTransaction(
    params: ChangePasswordTransactionParams
  ): Promise<ChangePasswordTransactionResult>;

  enableTwoFactor(params: EnableTwoFactorParams): Promise<void>;

  disableTwoFactor(userId: string): Promise<void>;

  incrementTokenVersion(userId: string): Promise<number>;

  resetPasswordTransaction(params: ResetPasswordTransactionParams): Promise<ResetPasswordTransactionResult>;

  findEmailVerificationState(userId: string): Promise<EmailVerificationState | null>;

  findPhoneVerificationState(userId: string): Promise<PhoneVerificationState | null>;

  findByEmail(email: string): Promise<UserIdentifierMatch | null>;

  findByPhone(phoneNumber: string): Promise<UserIdentifierMatch | null>;

  markEmailVerified(userId: string): Promise<void>;

  markPhoneVerified(userId: string): Promise<void>;

  updateEmail(userId: string, newEmail: string): Promise<void>;

  updatePhone(userId: string, newPhone: string): Promise<void>;

  findAll(params: FindAllUsersParams): Promise<{ users: any[]; total: number }>;

  updateProfile(userId: string, data: UpdateProfileParams): Promise<any>;

  updateManagerId(userId: string, managerId: string | null): Promise<any>;
}
