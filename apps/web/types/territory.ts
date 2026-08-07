export interface TerritoryType {
  id: string;
  slug: string;
  name: string;
  description?: string;
  canHaveBoundary: boolean;
  assignsClinics: boolean;
  assignableToUsers: boolean;
  assignableToManagers: boolean;
  blockSiblingOverlap: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface Territory {
  id: string;
  name: string;
  slug: string;
  code: string;
  verticalId: string;
  territoryTypeId: string;
  territoryType: TerritoryType;
  managerTerritoryId?: string;
  isActive: boolean;
  clinicCount: number;
  assignedUserCount: number;
  repPatchCount?: number;
  hasBoundary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeoJsonPolygon {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
}

export interface CreateTerritoryRequest {
  name: string;
  verticalId: string;
  code?: string;
  slug?: string;
  territoryTypeId?: string;
  typeSlug?: string;
  reason?: string;
  boundary?: GeoJsonPolygon;
}

export interface CreateTerritoryResult extends Territory {
  boundaryResolution?: SaveBoundaryResponse;
}

export interface TerritoryTypeFlags {
  canHaveBoundary?: boolean;
  assignsClinics?: boolean;
  assignableToUsers?: boolean;
  assignableToManagers?: boolean;
  blockSiblingOverlap?: boolean;
}

export interface CreateTerritoryTypeRequest extends TerritoryTypeFlags {
  slug: string;
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateTerritoryTypeRequest extends TerritoryTypeFlags {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateTerritoryRequest {
  name?: string;
  isActive?: boolean;
  reason?: string;
}

export interface TerritoryApprovalRequest {
  id: string;
  type: TerritoryApprovalType;
  status: TerritoryApprovalStatus;
  requesterId: string;
  reviewerId?: string | null;
  entityPayload: Record<string, unknown>;
  targetTerritoryId?: string | null;
  facilityId?: string | null;
  toTerritoryId?: string | null;
  reason?: string | null;
  resolutionNote?: string | null;
  supersededById?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TerritoryApprovalType = "deactivate_territory";

export type TerritoryApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "superseded";

export type TerritoryAssignmentStatus = "assigned" | "unassigned";

export interface SubmitApprovalRequest {
  type: TerritoryApprovalType;
  entityPayload?: Record<string, unknown>;
  targetTerritoryId?: string;
  facilityId?: string;
  toTerritoryId?: string;
  reason?: string;
}

export interface UnassignedFacility {
  id: string;
  lat?: number;
  lng?: number;
  territoryId?: string;
  territoryAssignmentStatus: TerritoryAssignmentStatus;
}

export interface RecomputeMembershipResponse {
  processed: number;
  updated: number;
}

export interface ClinicTerritoryOverrideRequest {
  territoryId: string;
  reason?: string;
}

export interface SaveBoundaryRepPatchResponse {
  success: boolean;
  mode: "rep_patch";
  managerTerritoryId: string;
  managerZoneCandidates: Array<{ id: string; code: string; name: string }>;
  clinicRecomputeEnqueued: boolean;
}

export interface SaveBoundaryManagerZoneResponse {
  success: boolean;
  mode: "manager_zone";
  repPatchCount: number;
}

export interface SaveBoundaryOtherResponse {
  success: boolean;
  mode: "other";
}

export type SaveBoundaryResponse =
  | SaveBoundaryRepPatchResponse
  | SaveBoundaryManagerZoneResponse
  | SaveBoundaryOtherResponse;
