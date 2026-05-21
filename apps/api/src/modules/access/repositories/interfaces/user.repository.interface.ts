export interface FindUserByIdentifierParams {
  identifier: string;
}

export interface CreateUserParams {
  email: string;

  username: string;

  phoneNumber?: string;

  passwordHash: string;

  roleId: string;
}

export interface UserRepository {
  findByIdentifier(params: FindUserByIdentifierParams): Promise<any>;

  findById(id: string): Promise<any>;

  create(params: CreateUserParams): Promise<any>;

  updateLastLogin(userId: string): Promise<void>;
}
