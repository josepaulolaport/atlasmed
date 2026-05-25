export interface CachedAuthContext {
  userId: string;
  roleId: string;
  roleName: string;
  status: string;
  tokenVersion: number;
}

export interface IAuthCache {
  get(userId: string): Promise<CachedAuthContext | null>;
  set(userId: string, context: CachedAuthContext): Promise<void>;
  invalidate(userId: string): Promise<void>;
  invalidateMultiple(userIds: string[]): Promise<void>;
  exists(userId: string): Promise<boolean>;
}
