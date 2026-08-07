import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  json,
  index,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { geometryMultiPolygon } from "../../types/geometry";
import {
  territoryApprovalTypeEnum,
  territoryApprovalStatusEnum,
} from "./enums";
import { users } from "./users";
import { businessVerticals } from "./business-verticals";

export const territoryTypes = pgTable(
  "territory_types",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    canHaveBoundary: boolean("can_have_boundary").notNull().default(true),
    blockSiblingOverlap: boolean("block_sibling_overlap").notNull().default(false),
    sortOrder: bigint("sort_order", { mode: "number" }).notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("territory_types_is_active_idx").on(t.isActive)]
);

export const territories = pgTable(
  "territories",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    code: text("code").notNull(),
    /** Commercial vertical this territory row belongs to (zones/patches are per vertical). */
    verticalId: bigint("vertical_id", { mode: "number" })
      .notNull().references(() => businessVerticals.id, { onDelete: "restrict" }),
    territoryTypeId: bigint("territory_type_id", { mode: "number" }).notNull().references(() => territoryTypes.id, { onDelete: "restrict" }),
    managerTerritoryId: bigint("manager_territory_id", { mode: "number" }),
    isActive: boolean("is_active").notNull().default(true),
    boundary: geometryMultiPolygon("boundary"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("territories_vertical_id_slug_uidx").on(t.verticalId, t.slug),
    uniqueIndex("territories_vertical_id_code_uidx").on(t.verticalId, t.code),
    index("territories_vertical_id_idx").on(t.verticalId),
    index("territories_manager_territory_id_idx").on(t.managerTerritoryId),
    index("territories_is_active_idx").on(t.isActive),
    index("territories_territory_type_id_idx").on(t.territoryTypeId),
  ]
);

export const userTerritoryAssignments = pgTable(
  "user_territory_assignments",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    territoryId: bigint("territory_id", { mode: "number" }).notNull().references(() => territories.id, { onDelete: "restrict" }),
    assignedBy: bigint("assigned_by", { mode: "number" }).references(() => users.id, { onDelete: "set null" }),
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
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    type: territoryApprovalTypeEnum("type").notNull(),
    status: territoryApprovalStatusEnum("status").notNull().default("pending"),
    requesterId: bigint("requester_id", { mode: "number" })
      .notNull().references(() => users.id, { onDelete: "restrict" }),
    reviewerId: bigint("reviewer_id", { mode: "number" }).references(() => users.id, { onDelete: "set null" }),
    entityPayload: json("entity_payload").notNull().default({}),
    targetTerritoryId: bigint("target_territory_id", { mode: "number" }).references(() => territories.id, { onDelete: "set null" }),
    facilityId: bigint("facility_id", { mode: "number" }),
    toTerritoryId: bigint("to_territory_id", { mode: "number" }).references(() => territories.id, { onDelete: "set null" }),
    reason: text("reason"),
    resolutionNote: text("resolution_note"),
    supersededById: bigint("superseded_by_id", { mode: "number" }),
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
  vertical: one(businessVerticals, {
    fields: [territories.verticalId],
    references: [businessVerticals.id],
  }),
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
