import { z } from "zod";

export const territoryTypeFlagSchema = z.object({
  canHaveBoundary: z.boolean().optional(),
  assignsClinics: z.boolean().optional(),
  assignableToUsers: z.boolean().optional(),
  assignableToManagers: z.boolean().optional(),
  isCountryLevel: z.boolean().optional(),
  blockSiblingOverlap: z.boolean().optional(),
});

export const createTerritoryTypeSchema = z
  .object({
    slug: z.string().trim().min(3).max(50),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
    sortOrder: z.number().int().optional(),
  })
  .merge(territoryTypeFlagSchema);

export const updateTerritoryTypeSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.union([z.string().trim().max(500), z.null()]).optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  .merge(territoryTypeFlagSchema);

export const territoryBoundarySchema = z.object({
  type: z.enum(["Polygon", "MultiPolygon"]),
  coordinates: z.unknown(),
});

export const createTerritorySchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(3).max(60),
  territoryTypeId: z.string().trim().min(1).optional(),
  typeSlug: z.string().trim().min(1).optional(),
  countryCode: z.string().trim().length(2).optional(),
  parentId: z.string().trim().min(1).optional(),
  reason: z.string().trim().max(500).optional(),
  boundary: territoryBoundarySchema.optional(),
});

export const territoryRollupLinkSchema = z.object({
  ancestorId: z.string().trim().min(1),
  relationshipType: z.literal("reporting").optional(),
});

export const updateTerritorySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  parentId: z.union([z.string().trim().min(1), z.null()]).optional(),
  isActive: z.boolean().optional(),
  reason: z.string().trim().max(500).optional(),
});

export const territoryApprovalRequestSchema = z.object({
  type: z.enum([
    "create_territory",
    "reparent_territory",
    "deactivate_territory",
    "facility_territory_change",
  ]),
  entityPayload: z.record(z.string(), z.unknown()).optional(),
  targetTerritoryId: z.string().trim().min(1).optional(),
  facilityId: z.string().trim().min(1).optional(),
  toTerritoryId: z.string().trim().min(1).optional(),
  reason: z.string().trim().max(500).optional(),
});

export const facilityTerritoryOverrideSchema = z.object({
  territoryId: z.string().trim().min(1),
  reason: z.string().trim().max(500).optional(),
});

export type CreateTerritoryTypeInput = z.infer<typeof createTerritoryTypeSchema>;
export type UpdateTerritoryTypeInput = z.infer<typeof updateTerritoryTypeSchema>;
export type CreateTerritoryInput = z.infer<typeof createTerritorySchema>;
export type TerritoryRollupLinkInput = z.infer<typeof territoryRollupLinkSchema>;
export type UpdateTerritoryInput = z.infer<typeof updateTerritorySchema>;
export type TerritoryBoundaryInput = z.infer<typeof territoryBoundarySchema>;
export type TerritoryApprovalRequestInput = z.infer<typeof territoryApprovalRequestSchema>;
export type ClinicTerritoryOverrideInput = z.infer<typeof clinicTerritoryOverrideSchema>;
