import type {
  TerritoryApprovalStatus,
  TerritoryApprovalType,
} from "@atlasmed/database";

export interface TerritoryApprovalRecord {
  id: number;
  type: TerritoryApprovalType;
  status: TerritoryApprovalStatus;
  requesterId: number;
  reviewerId: number | null;
  entityPayload: Record<string, unknown>;
  targetTerritoryId: number | null;
  facilityId: number | null;
  toTerritoryId: number | null;
  reason: string | null;
  resolutionNote: string | null;
  supersededById: number | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApprovalInput {
  type: TerritoryApprovalType;
  requesterId: number;
  entityPayload: Record<string, unknown>;
  targetTerritoryId?: number | null;
  facilityId?: number | null;
  toTerritoryId?: number | null;
  reason?: string | null;
}

export interface TerritoryApprovalRepository {
  create(input: CreateApprovalInput): Promise<TerritoryApprovalRecord>;

  findById(id: number): Promise<TerritoryApprovalRecord | null>;

  findPendingByEntity(params: {
    type: TerritoryApprovalType;
    targetTerritoryId?: number | null;
    facilityId?: number | null;
  }): Promise<TerritoryApprovalRecord[]>;

  findPendingByRequesterAndEntity(params: {
    type: TerritoryApprovalType;
    requesterId: number;
    targetTerritoryId?: number | null;
    facilityId?: number | null;
  }): Promise<TerritoryApprovalRecord | null>;

  supersede(id: number, supersededById: number): Promise<void>;

  resolve(
    id: number,
    data: {
      status: "approved" | "rejected";
      reviewerId: number;
      resolutionNote?: string | null;
    }
  ): Promise<TerritoryApprovalRecord>;

  list(params: {
    status?: TerritoryApprovalStatus;
    page: number;
    limit: number;
  }): Promise<{ items: TerritoryApprovalRecord[]; total: number }>;
}
