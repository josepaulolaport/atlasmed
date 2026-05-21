export interface InviteRepository {
  create(params: any): Promise<any>;

  findValidByTokenHash(tokenHash: string): Promise<any>;

  markAccepted(inviteId: string, createdUserId: string): Promise<void>;
}
