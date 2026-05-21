export interface SessionRepository {
  create(params: any): Promise<any>;

  findActiveByTokenHash(tokenHash: string): Promise<any>;

  revoke(sessionId: string): Promise<void>;
}
