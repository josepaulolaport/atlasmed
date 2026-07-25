import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  doublePrecision,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { geometryMultiPolygon } from "../../types/geometry";
import {
  territoryApprovalTypeEnum,
  territoryApprovalStatusEnum,
} from "./enums";
import { users } from "./users";

export const territoryTypes = pgTable(
  "territory_types",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    canHaveBoundary: boolean("can_have_boundary").notNull().default(true),
    assignsClinics: boolean("assigns_clinics").notNull().default(false),
    assignableToUsers: boolean("assignable_to_users").notNull().default(false),
    assignableToManagers: boolean("assignable_to_managers").notNull().default(false),
    blockSiblingOverlap: boolean("block_sibling_overlap").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("territory_types_is_active_idx").on(t.isActive)]
);

export const territories = pgTable(
  "territories",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    code: text("code").notNull().unique(),
    territoryTypeId: text("territory_type_id").notNull().references(() => territoryTypes.id, { onDelete: "restrict" }),
    managerTerritoryId: text("manager_territory_id"),
    isActive: boolean("is_active").notNull().default(true),
    boundary: geometryMultiPolygon("boundary"),
    boundaryMinLng: doublePrecision("boundary_min_lng"),
    boundaryMinLat: doublePrecision("boundary_min_lat"),
    boundaryMaxLng: doublePrecision("boundary_max_lng"),
    boundaryMaxLat: doublePrecision("boundary_max_lat"),
    boundaryAreaSqKm: doublePrecision("boundary_area_sq_km"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("territories_slug_uidx").on(t.slug),
    index("territories_manager_territory_id_idx").on(t.managerTerritoryId),
    index("territories_is_active_idx").on(t.isActive),
    index("territories_territory_type_id_idx").on(t.territoryTypeId),
  ]
);

export const userTerritoryAssignments = pgTable(
  "user_territory_assignments",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    territoryId: text("territory_id").notNull().references(() => territories.id, { onDelete: "restrict" }),
    assignedBy: text("assigned_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_territory_assignments_user_id_territory_id_uidx").on(t.userId, t.territoryId),
    index("user_territory_assignments_user_id_idx").on(t.userId),
    index("user_territory_assignments_territory_id_idx").on(t.territoryId),
  ]
);

export const territoryApprovalRequests = pgTable(
  "territory_approval_requests",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    type: territoryApprovalTypeEnum("type").notNull(),
    status: territoryApprovalStatusEnum("status").notNull().default("pending"),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reviewerId: text("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    entityPayload: json("entity_payload").notNull().default({}),
    targetTerritoryId: text("target_territory_id").references(() => territories.id, { onDelete: "set null" }),
    facilityId: text("facility_id"),
    toTerritoryId: text("to_territory_id").references(() => territories.id, { onDelete: "set null" }),
    reason: text("reason"),
    resolutionNote: text("resolution_note"),
    supersededById: text("superseded_by_id"),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("territory_approval_requests_status_type_idx").on(t.status, t.type),
    index("territory_approval_requests_requester_id_idx").on(t.requesterId),
    index("territory_approval_requests_target_territory_id_status_idx").on(t.targetTerritoryId, t.status),
    index("territory_approval_requests_facility_id_status_type_idx").on(t.facilityId, t.status, t.type),
  ]
);

// --- Relations ---

export const territoryTypesRelations = relations(territoryTypes, ({ many }) => ({
  territories: many(territories),
}));

export const territoriesRelations = relations(territories, ({ one, many }) => ({
  territoryType: one(territoryTypes, {
    fields: [territories.territoryTypeId],
    references: [territoryTypes.id],
  }),
  managerTerritory: one(territories, {
    fields: [territories.managerTerritoryId],
    references: [territories.id],
    relationName: "ManagerZonePatches",
  }),
  repPatches: many(territories, { relationName: "ManagerZonePatches" }),
  userAssignments: many(userTerritoryAssignments),
  approvalRequests: many(territoryApprovalRequests, { relationName: "ApprovalTargetTerritory" }),
  facilityApprovalRequests: many(territoryApprovalRequests, { relationName: "ApprovalFacilityTerritory" }),
}));

export const userTerritoryAssignmentsRelations = relations(userTerritoryAssignments, ({ one }) => ({
  user: one(users, { fields: [userTerritoryAssignments.userId], references: [users.id] }),
  territory: one(territories, { fields: [userTerritoryAssignments.territoryId], references: [territories.id] }),
}));

export const territoryApprovalRequestsRelations = relations(territoryApprovalRequests, ({ one, many }) => ({
  targetTerritory: one(territories, {
    fields: [territoryApprovalRequests.targetTerritoryId],
    references: [territories.id],
    relationName: "ApprovalTargetTerritory",
  }),
  toTerritory: one(territories, {
    fields: [territoryApprovalRequests.toTerritoryId],
    references: [territories.id],
    relationName: "ApprovalFacilityTerritory",
  }),
  supersededBy: one(territoryApprovalRequests, {
    fields: [territoryApprovalRequests.supersededById],
    references: [territoryApprovalRequests.id],
    relationName: "ApprovalSupersession",
  }),
  supersedes: many(territoryApprovalRequests, { relationName: "ApprovalSupersession" }),
}));
