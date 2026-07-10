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
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { geometryMultiPolygon, geometryPoint } from "../../types/geometry";
import {
  territoryNodeTypeEnum,
  territoryAssignmentStatusEnum,
  territoryAssignmentSourceEnum,
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
    canHaveBoundary: boolean("canHaveBoundary").notNull().default(true),
    assignsClinics: boolean("assignsClinics").notNull().default(false),
    assignableToUsers: boolean("assignableToUsers").notNull().default(false),
    assignableToManagers: boolean("assignableToManagers").notNull().default(false),
    isCountryLevel: boolean("isCountryLevel").notNull().default(false),
    blockSiblingOverlap: boolean("blockSiblingOverlap").notNull().default(false),
    participatesInGroupingHierarchy: boolean("participatesInGroupingHierarchy").notNull().default(false),
    sortOrder: integer("sortOrder").notNull().default(0),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [index("territory_types_isActive_idx").on(t.isActive)]
);

export const territories = pgTable(
  "territories",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    code: text("code").notNull().unique(),
    nodeType: territoryNodeTypeEnum("nodeType").notNull(),
    territoryTypeId: text("territoryTypeId").notNull().references(() => territoryTypes.id, { onDelete: "restrict" }),
    countryCode: text("countryCode"),
    regionSlug: text("regionSlug"),
    stateCode: text("stateCode"),
    parentId: text("parentId"),
    managerTerritoryId: text("managerTerritoryId"),
    isActive: boolean("isActive").notNull().default(true),
    organizationId: text("organizationId"),
    boundary: geometryMultiPolygon("boundary"),
    centroid: geometryPoint("centroid"),
    boundaryMinLng: doublePrecision("boundaryMinLng"),
    boundaryMinLat: doublePrecision("boundaryMinLat"),
    boundaryMaxLng: doublePrecision("boundaryMaxLng"),
    boundaryMaxLat: doublePrecision("boundaryMaxLat"),
    boundaryAreaSqKm: doublePrecision("boundaryAreaSqKm"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("territories_slug_uidx").on(t.slug),
    index("territories_parentId_idx").on(t.parentId),
    index("territories_managerTerritoryId_idx").on(t.managerTerritoryId),
    index("territories_isActive_idx").on(t.isActive),
    index("territories_nodeType_idx").on(t.nodeType),
    index("territories_countryCode_idx").on(t.countryCode),
    index("territories_territoryTypeId_idx").on(t.territoryTypeId),
  ]
);

export const territoryClosure = pgTable(
  "territory_closure",
  {
    ancestorId: text("ancestorId").notNull().references(() => territories.id, { onDelete: "cascade" }),
    descendantId: text("descendantId").notNull().references(() => territories.id, { onDelete: "cascade" }),
    depth: integer("depth").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.ancestorId, t.descendantId] }),
    index("territory_closure_descendantId_idx").on(t.descendantId),
  ]
);

export const userTerritoryAssignments = pgTable(
  "user_territory_assignments",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    territoryId: text("territoryId").notNull().references(() => territories.id, { onDelete: "restrict" }),
    assignedBy: text("assignedBy"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_territory_assignments_userId_territoryId_uidx").on(t.userId, t.territoryId),
    index("user_territory_assignments_userId_idx").on(t.userId),
    index("user_territory_assignments_territoryId_idx").on(t.territoryId),
  ]
);

export const territoryApprovalRequests = pgTable(
  "territory_approval_requests",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    type: territoryApprovalTypeEnum("type").notNull(),
    status: territoryApprovalStatusEnum("status").notNull().default("pending"),
    requesterId: text("requesterId").notNull(),
    reviewerId: text("reviewerId"),
    entityPayload: json("entityPayload").notNull().default({}),
    targetTerritoryId: text("targetTerritoryId").references(() => territories.id, { onDelete: "set null" }),
    facilityId: text("facilityId"),
    toTerritoryId: text("toTerritoryId").references(() => territories.id, { onDelete: "set null" }),
    reason: text("reason"),
    resolutionNote: text("resolutionNote"),
    supersededById: text("supersededById"),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    index("territory_approval_requests_status_type_idx").on(t.status, t.type),
    index("territory_approval_requests_requesterId_idx").on(t.requesterId),
    index("territory_approval_requests_targetTerritoryId_status_idx").on(t.targetTerritoryId, t.status),
    index("territory_approval_requests_facilityId_status_type_idx").on(t.facilityId, t.status, t.type),
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
  parent: one(territories, {
    fields: [territories.parentId],
    references: [territories.id],
    relationName: "TerritoryHierarchy",
  }),
  children: many(territories, { relationName: "TerritoryHierarchy" }),
  managerTerritory: one(territories, {
    fields: [territories.managerTerritoryId],
    references: [territories.id],
    relationName: "ManagerZonePatches",
  }),
  repPatches: many(territories, { relationName: "ManagerZonePatches" }),
  userAssignments: many(userTerritoryAssignments),
  closureAsAncestor: many(territoryClosure, { relationName: "ClosureAncestor" }),
  closureAsDescendant: many(territoryClosure, { relationName: "ClosureDescendant" }),
  approvalRequests: many(territoryApprovalRequests, { relationName: "ApprovalTargetTerritory" }),
  facilityApprovalRequests: many(territoryApprovalRequests, { relationName: "ApprovalFacilityTerritory" }),
}));

export const territoryClosureRelations = relations(territoryClosure, ({ one }) => ({
  ancestor: one(territories, {
    fields: [territoryClosure.ancestorId],
    references: [territories.id],
    relationName: "ClosureAncestor",
  }),
  descendant: one(territories, {
    fields: [territoryClosure.descendantId],
    references: [territories.id],
    relationName: "ClosureDescendant",
  }),
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
