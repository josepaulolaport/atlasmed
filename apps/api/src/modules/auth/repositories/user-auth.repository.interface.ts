import type { UserContract } from "@atlasmed/access";

export interface FindUserByIdentifierParams {
  identifier: string;
}

export interface CreateUserParams {
  email: string;

  username: string;

  phoneNumber?: string;

  passwordHash: string;

  firstName?: string;

  lastName?: string;

  roleId: string;
}

export interface UserAuthRepository {
  findByIdentifier(
    params: FindUserByIdentifierParams,
  ): Promise<UserContract | null>;

  findById(id: string): Promise<UserContract | null>;

  create(params: CreateUserParams): Promise<UserContract>;

  updateLastLogin(userId: string): Promise<void>;

  updatePassword(userId: string, passwordHash: string): Promise<void>;
}
