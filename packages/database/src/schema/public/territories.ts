import {
  pgTable,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  bigint,
  check,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { geometryMultiPolygon } from "../../types/geometry";
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
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
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
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("territories_vertical_id_slug_uidx").on(t.verticalId, t.slug),
    uniqueIndex("territories_vertical_id_code_uidx").on(t.verticalId, t.code),
    /** Target for composite FKs that must match territory vertical. */
    unique("territories_id_vertical_id_uidx").on(t.id, t.verticalId),
    foreignKey({
      name: "territories_manager_territory_vertical_fk",
      columns: [t.managerTerritoryId, t.verticalId],
      foreignColumns: [t.id, t.verticalId],
    }).onDelete("restrict"),
    check(
      "territories_manager_territory_id_no_self_check",
      sql`${t.managerTerritoryId} IS NULL OR ${t.managerTerritoryId} <> ${t.id}`,
    ),
    index("territories_vertical_id_idx").on(t.verticalId),
    index("territories_manager_territory_id_idx").on(t.managerTerritoryId),
    index("territories_is_active_idx").on(t.isActive),
    index("territories_territory_type_id_idx").on(t.territoryTypeId),
    index("territories_boundary_gist_idx")
      .using("gist", t.boundary)
      .where(sql`${t.boundary} IS NOT NULL`),
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
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("user_territory_assignments_user_id_territory_id_uidx").on(t.userId, t.territoryId),
    index("user_territory_assignments_user_id_idx").on(t.userId),
    index("user_territory_assignments_territory_id_idx").on(t.territoryId),
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
}));

export const userTerritoryAssignmentsRelations = relations(userTerritoryAssignments, ({ one }) => ({
  user: one(users, { fields: [userTerritoryAssignments.userId], references: [users.id] }),
  territory: one(territories, { fields: [userTerritoryAssignments.territoryId], references: [territories.id] }),
}));
