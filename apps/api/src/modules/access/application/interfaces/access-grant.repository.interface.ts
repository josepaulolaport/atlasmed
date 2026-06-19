import type { AccessGrantRecord } from "@atlasmed/access";

export interface AccessGrantRepository {
  findActiveByUserId(userId: string): Promise<AccessGrantRecord[]>;

  create(params: {
    userId: string;
    resource: string;
    resourceId?: string;
    action: string;
    conditions?: Record<string, unknown>;
    grantedBy: string;
    expiresAt?: Date;
  }): Promise<AccessGrantRecord>;

  deleteMany(params: {
    userId: string;
    resource: string;
    resourceId?: string;
    action: string;
  }): Promise<number>;

  deleteExpired(): Promise<number>;
}
