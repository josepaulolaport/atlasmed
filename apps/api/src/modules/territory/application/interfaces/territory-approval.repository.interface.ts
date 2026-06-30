import type {
  TerritoryApprovalStatus,
  TerritoryApprovalType,
} from "@atlasmed/database";

export interface TerritoryApprovalRecord {
  id: string;
  type: TerritoryApprovalType;
  status: TerritoryApprovalStatus;
  requesterId: string;
  reviewerId: string | null;
  entityPayload: Record<string, unknown>;
  targetTerritoryId: string | null;
  facilityId: string | null;
  toTerritoryId: string | null;
  reason: string | null;
  resolutionNote: string | null;
  supersededById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApprovalInput {
  type: TerritoryApprovalType;
  requesterId: string;
  entityPayload: Record<string, unknown>;
  targetTerritoryId?: string | null;
  facilityId?: string | null;
  toTerritoryId?: string | null;
  reason?: string | null;
}

export interface TerritoryApprovalRepository {
  create(input: CreateApprovalInput): Promise<TerritoryApprovalRecord>;

  findById(id: string): Promise<TerritoryApprovalRecord | null>;

  findPendingByEntity(params: {
    type: TerritoryApprovalType;
    targetTerritoryId?: string | null;
    facilityId?: string | null;
  }): Promise<TerritoryApprovalRecord[]>;

  findPendingByRequesterAndEntity(params: {
    type: TerritoryApprovalType;
    requesterId: string;
    targetTerritoryId?: string | null;
    facilityId?: string | null;
  }): Promise<TerritoryApprovalRecord | null>;

  supersede(id: string, supersededById: string): Promise<void>;

  resolve(
    id: string,
    data: {
      status: "approved" | "rejected";
      reviewerId: string;
      resolutionNote?: string | null;
    }
  ): Promise<TerritoryApprovalRecord>;

  list(params: {
    status?: TerritoryApprovalStatus;
    page: number;
    limit: number;
  }): Promise<{ items: TerritoryApprovalRecord[]; total: number }>;
}
