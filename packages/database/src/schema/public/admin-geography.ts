import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { geometryMultiPolygon } from "../../types/geometry";

/**
 * Administrative geography (IBGE / CNES) — not commercial territories.
 * Hierarchy: states → municipalities → neighborhoods.
 *
 * Internal PK = integer identity (1, 2, 3…). Omit `id` on insert.
 * Stable natural keys = `ibge_code` (+ optional `cnes_code`), unique.
 * No sentinel "unknown" rows — every FK must point at a real IBGE entity.
 * Bbox/area are not cached — derive from `boundary` via PostGIS when needed.
 */

export const states = pgTable(
  "states",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    /** IBGE UF code (2 digits), e.g. "35". */
    ibgeCode: text("ibge_code").notNull(),
    /** CNES state code when distinct from IBGE. */
    cnesCode: text("cnes_code"),
    /** UF abbreviation, e.g. "SP". */
    abbreviation: text("abbreviation").notNull(),
    boundary: geometryMultiPolygon("boundary"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("states_ibge_code_uidx").on(t.ibgeCode),
    uniqueIndex("states_abbreviation_uidx").on(t.abbreviation),
    uniqueIndex("states_cnes_code_uidx")
      .on(t.cnesCode)
      .where(sql`${t.cnesCode} IS NOT NULL`),
  ]
);

export const municipalities = pgTable(
  "municipalities",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    stateId: integer("state_id")
      .notNull()
      .references(() => states.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    /** IBGE municipality geocode (7 digits). */
    ibgeCode: text("ibge_code").notNull(),
    /** CNES municipality code (IBGE without check digit, 6 digits). */
    cnesCode: text("cnes_code"),
    boundary: geometryMultiPolygon("boundary"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("municipalities_ibge_code_uidx").on(t.ibgeCode),
    uniqueIndex("municipalities_cnes_code_uidx")
      .on(t.cnesCode)
      .where(sql`${t.cnesCode} IS NOT NULL`),
    /** Enables facilities (municipality_id, state_id) → municipalities (id, state_id). */
    uniqueIndex("municipalities_id_state_id_uidx").on(t.id, t.stateId),
    index("municipalities_state_id_idx").on(t.stateId),
    index("municipalities_name_idx").on(t.name),
  ]
);

export const neighborhoods = pgTable(
  "neighborhoods",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    municipalityId: integer("municipality_id")
      .notNull()
      .references(() => municipalities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** IBGE bairro code (Censo 2022 malha). */
    ibgeCode: text("ibge_code").notNull(),
    boundary: geometryMultiPolygon("boundary"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("neighborhoods_ibge_code_uidx").on(t.ibgeCode),
    index("neighborhoods_municipality_id_idx").on(t.municipalityId),
    index("neighborhoods_name_idx").on(t.name),
  ]
);
