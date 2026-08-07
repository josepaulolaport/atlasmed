export interface UserRecord {
  id: number;
  email: string | null;
  username: string;
  firstName: string | null;
  lastName: string | null;
  birthDate?: Date | null;
  status: string;
  passwordHash: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  phoneNumber: string | null;
  emailVerifiedAt?: Date | null;
  phoneVerifiedAt?: Date | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  avatarUrl: string | null;
  avatarBlurhash: string | null;
  tokenVersion: number;
  passwordHistory: string[];
  lastLoginAt?: Date | null;
  suspendedAt?: Date | null;
  deactivatedAt?: Date | null;
  roleId: number;
  role: {
    id: number;
    name: string;
    description?: string | null;
    priority?: number | null;
  };
  createdAt: Date;
  updatedAt: Date;
  metadata?: unknown;
}

export interface FindUserByIdentifierParams {
  identifier: string;
}

export interface CreateUserParams {
  email: string;

  username: string;

  phoneNumber?: string | undefined;

  passwordHash: string;

  roleId: number;

  firstName?: string | undefined;

  lastName?: string | undefined;

  emailVerified?: boolean | undefined;

  phoneVerified?: boolean | undefined;

  status?: string | undefined;
}

export interface UpdatePasswordParams {
  userId: number;
  passwordHash: string;
}

export interface ResetPasswordTransactionParams {
  tokenHash: string;
  newPasswordHash: string;
}

export interface ResetPasswordTransactionResult {
  user: UserRecord;
  passwordReset: { id: number; usedAt: Date | null };
}

export interface UserAuthStatus {
  status: string;
  tokenVersion: number;
  roleId: number;
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
  id: number;
}

export type ListUsersSortBy = "name" | "role" | "status" | "createdAt";
export type ListUsersSortDir = "asc" | "desc";

export interface FindAllUsersParams {
  page: number;
  limit: number;
  status?: string;
  role?: string;
  search?: string;
  verticalId?: number;
  sortBy?: ListUsersSortBy;
  sortDir?: ListUsersSortDir;
  scope?: UserListScopeFilter;
}

export interface UserListScopeFilter {
  isGlobal: boolean;
  territoryIds: number[];
  managedUserIds?: number[];
}

export interface UpdateProfileParams {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  avatarBlurhash?: string | null;
}

export interface UpdateUserAsAdminParams {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string | null;
  username?: string;
  birthDate?: Date | null;
}

export interface ChangeRoleTransactionParams {
  userId: number;
  newRoleId: number;
}

export interface ChangePasswordTransactionParams {
  userId: number;
  newPasswordHash: string;
  previousPasswordHash: string;
  passwordHistory: string[];
  revokeOtherSessions: boolean;
  keepSessionId?: number;
}

export interface ChangePasswordTransactionResult {
  user: UserRecord;
}

export interface EnableTwoFactorParams {
  userId: number;
  encryptedSecret: string;
}

export interface UserRepository {
  findByIdentifier(
    params: FindUserByIdentifierParams,
  ): Promise<UserRecord | null>;

  findById(id: number): Promise<UserRecord | null>;

  findUserAuthStatus(userId: number): Promise<UserAuthStatus | null>;

  create(params: CreateUserParams): Promise<UserRecord>;

  updateLastLogin(userId: number): Promise<void>;

  updatePassword(params: UpdatePasswordParams): Promise<void>;

  deactivate(userId: number): Promise<void>;

  activate(userId: number): Promise<void>;

  suspend(userId: number): Promise<void>;

  unsuspend(userId: number): Promise<void>;

  updateRole(userId: number, roleId: number): Promise<void>;

  changeRoleTransaction(params: ChangeRoleTransactionParams): Promise<void>;

  changePasswordTransaction(
    params: ChangePasswordTransactionParams,
  ): Promise<ChangePasswordTransactionResult>;

  enableTwoFactor(params: EnableTwoFactorParams): Promise<void>;

  disableTwoFactor(userId: number): Promise<void>;

  incrementTokenVersion(userId: number): Promise<number>;

  resetPasswordTransaction(
    params: ResetPasswordTransactionParams,
  ): Promise<ResetPasswordTransactionResult>;

  findEmailVerificationState(
    userId: number,
  ): Promise<EmailVerificationState | null>;

  findPhoneVerificationState(
    userId: number,
  ): Promise<PhoneVerificationState | null>;

  findByEmail(email: string): Promise<UserIdentifierMatch | null>;

  findByPhone(phoneNumber: string): Promise<UserIdentifierMatch | null>;

  markEmailVerified(userId: number): Promise<void>;

  markPhoneVerified(userId: number): Promise<void>;

  updateEmail(userId: number, newEmail: string): Promise<void>;

  updatePhone(userId: number, newPhone: string): Promise<void>;

  findAll(
    params: FindAllUsersParams,
  ): Promise<{ users: UserRecord[]; total: number }>;

  updateProfile(userId: number, data: UpdateProfileParams): Promise<UserRecord>;

  updateAsAdmin(
    userId: number,
    data: UpdateUserAsAdminParams,
  ): Promise<UserRecord>;

  findByUsername(username: string): Promise<UserIdentifierMatch | null>;

  getMetadata(userId: number): Promise<unknown>;

  updateMetadata(
    userId: number,
    metadata: Record<string, unknown>,
  ): Promise<void>;
}
