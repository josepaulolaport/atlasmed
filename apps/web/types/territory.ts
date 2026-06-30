export type TerritoryParentAssignmentStatus = "resolved" | "ambiguous" | "manual";
export type TerritoryParentAssignmentSource = "geo" | "inferred" | "manual";
export type TerritoryRollupLinkSource = "geo" | "manual";

export interface TerritoryType {
  id: string;
  slug: string;
  name: string;
  description?: string;
  canHaveBoundary: boolean;
  assignsClinics: boolean;
  assignableToUsers: boolean;
  assignableToManagers: boolean;
  isCountryLevel: boolean;
  blockSiblingOverlap: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface Territory {
  id: string;
  name: string;
  slug: string;
  code: string;
  territoryTypeId: string;
  territoryType: TerritoryType;
  countryCode?: string;
  parentId?: string;
  isActive: boolean;
  parentAssignmentStatus?: TerritoryParentAssignmentStatus;
  parentAssignmentSource?: TerritoryParentAssignmentSource;
  clinicCount: number;
  assignedUserCount: number;
  hasBoundary: boolean;
  isLeaf: boolean;
  isCountryLevel?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TerritoryTreeNode extends Territory {
  children: TerritoryTreeNode[];
}

export interface GeoJsonPolygon {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
}

export interface TerritoryDescendantsResponse {
  territoryId: string;
  descendantIds: string[];
}

export interface CreateTerritoryRequest {
  name: string;
  slug: string;
  territoryTypeId?: string;
  typeSlug?: string;
  countryCode?: string;
  parentId?: string;
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
  isCountryLevel?: boolean;
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
  parentId?: string | null;
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

export type TerritoryApprovalType =
  | "create_territory"
  | "reparent_territory"
  | "deactivate_territory"
  | "facility_territory_change";

export type TerritoryApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "superseded";

export type TerritoryAssignmentStatus = "assigned" | "unassigned" | "ambiguous";

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

export interface TerritoryRollupAncestor {
  id: string;
  name: string;
  code: string;
  slug: string;
  territoryType: Pick<TerritoryType, "slug" | "name">;
}

export interface TerritoryRollupLink {
  id: string;
  territoryId: string;
  ancestorId: string;
  relationshipType: "reporting";
  source: TerritoryRollupLinkSource;
  createdAt: string;
  ancestor?: TerritoryRollupAncestor;
}

export interface AddTerritoryRollupLinkRequest {
  ancestorId: string;
  relationshipType?: "reporting";
}

export interface SaveBoundaryReferenceResponse {
  success: boolean;
  mode: "reference";
  parentAssignmentStatus: TerritoryParentAssignmentStatus;
  parentAssignmentSource: TerritoryParentAssignmentSource;
  primaryParentId: string | null;
  rollupAncestorIds: string[];
  candidates: Array<{ id: string; code: string; overlapRatio: number }>;
}

export interface SaveBoundaryOperationalResponse {
  success: boolean;
  mode: "operational";
  geoMembershipStatus: "ready";
  membershipCount: number;
  referenceTerritoryIds: string[];
}

export type SaveBoundaryResponse =
  | SaveBoundaryReferenceResponse
  | SaveBoundaryOperationalResponse;

export interface TerritoryGeoMembership {
  id: string;
  operationalTerritoryId: string;
  referenceTerritoryId: string;
  referenceTypeSlug: string;
  overlapRatio: number;
  intersectionAreaSqKm: number;
  computedAt: string;
  operationalTerritory?: Pick<Territory, "id" | "name" | "slug" | "code"> & {
    territoryType: Pick<TerritoryType, "slug" | "name">;
  };
  referenceTerritory?: Pick<Territory, "id" | "name" | "slug" | "code"> & {
    territoryType: Pick<TerritoryType, "slug" | "name">;
  };
}
