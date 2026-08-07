export interface CachedAuthContext {
  userId: number;
  roleId: number;
  roleName: string;
  status: string;
  tokenVersion: number;
}

export interface IAuthCache {
  get(userId: number): Promise<CachedAuthContext | null>;
  set(userId: number, context: CachedAuthContext): Promise<void>;
  invalidate(userId: number): Promise<void>;
  invalidateMultiple(userIds: number[]): Promise<void>;
  exists(userId: number): Promise<boolean>;
  isRecentlyValidated(userId: number): Promise<boolean>;
  markValidated(userId: number): Promise<void>;
}
