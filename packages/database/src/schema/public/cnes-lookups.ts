import {
  pgTable,
  text,
  boolean,
  timestamp,
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
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [unique("occupations_cnes_id_key").on(t.cnesId)]
);

/**
 * CNES TP_UNIDADE catalog (occupation-shaped: bigint id + external cnes_id).
 * Empty until post-overhaul load — Slice E dropped text-PK shape / facility_types axis.
 */
export const unitTypes = pgTable(
  "unit_types",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    cnesId: text("cnes_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [unique("unit_types_cnes_id_key").on(t.cnesId)]
);

/**
 * CNES unit subtypes scoped by parent unit type.
 * UNIQUE (unit_type_id, cnes_id) — codes are not globally unique.
 */
export const unitSubtypes = pgTable(
  "unit_subtypes",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    unitTypeId: bigint("unit_type_id", { mode: "number" })
      .notNull()
      .references(() => unitTypes.id, { onDelete: "restrict" }),
    cnesId: text("cnes_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [unique("unit_subtypes_unit_type_id_cnes_id_key").on(t.unitTypeId, t.cnesId)]
);

/**
 * CNES motivo desativação catalog (occupation-shaped: bigint id + external cnes_id).
 * Empty until post-overhaul load.
 */
export const deactivationReasons = pgTable(
  "deactivation_reasons",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    cnesId: text("cnes_id").notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [unique("deactivation_reasons_cnes_id_key").on(t.cnesId)]
);

// --- Relations ---

export const unitTypesRelations = relations(unitTypes, ({ many }) => ({
  subtypes: many(unitSubtypes),
}));

export const unitSubtypesRelations = relations(unitSubtypes, ({ one }) => ({
  unitType: one(unitTypes, {
    fields: [unitSubtypes.unitTypeId],
    references: [unitTypes.id],
  }),
}));
