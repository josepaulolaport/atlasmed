import {
  pgTable,
  text,
  boolean,
  timestamp,
  primaryKey,
  bigint,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * CNES lookup catalogs (public schema).
 * Seeded separately from CNES CSV import — schema only here.
 */

/** CBO occupation catalog (ADR 0004 remake — empty until post-overhaul load). */
export const occupations = pgTable(
  "occupations",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    cnesId: text("cnes_id").notNull(),
    name: text("name").notNull(),
    isHealthOccupation: boolean("is_health_occupation"),
    isRegulated: boolean("is_regulated"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("occupations_cnes_id_key").on(t.cnesId)]
);

export const facilityTypes = pgTable("facility_types", {
  facilityTypeCode: text("facility_type_code").primaryKey(),
  facilityTypeName: text("facility_type_name").notNull(),
  conceptDescription: text("concept_description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const unitTypes = pgTable("unit_types", {
  unitTypeCode: text("unit_type_code").primaryKey(),
  unitTypeName: text("unit_type_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const unitSubtypes = pgTable(
  "unit_subtypes",
  {
    unitTypeCode: text("unit_type_code")
      .notNull()
      .references(() => unitTypes.unitTypeCode, { onDelete: "restrict" }),
    subtypeCode: text("subtype_code").notNull(),
    subtypeName: text("subtype_name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      name: "unit_subtypes_pkey",
      columns: [t.unitTypeCode, t.subtypeCode],
    }),
  ]
);

export const deactivationReasons = pgTable("deactivation_reasons", {
  deactivationCode: text("deactivation_code").primaryKey(),
  deactivationReason: text("deactivation_reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// --- Relations ---

export const unitTypesRelations = relations(unitTypes, ({ many }) => ({
  subtypes: many(unitSubtypes),
}));

export const unitSubtypesRelations = relations(unitSubtypes, ({ one }) => ({
  unitType: one(unitTypes, {
    fields: [unitSubtypes.unitTypeCode],
    references: [unitTypes.unitTypeCode],
  }),
}));
