import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { geometryMultiPolygon } from "../../types/geometry";

/**
 * Administrative geography (IBGE / CNES) — not commercial territories.
 * Hierarchy: states → municipalities → districts → subdistricts → neighborhoods.
 *
 * Internal PK = integer identity (1, 2, 3…). Omit `id` on insert.
 * Stable natural keys = `ibge_id` (+ optional `cnes_code` on state/mun), unique.
 * No sentinel "unknown" rows — every FK must point at a real IBGE entity.
 * Bbox/area are not cached — derive from `boundary` via PostGIS when needed.
 *
 * Facilities keep free-text `neighborhood` — no facility FKs into this graph.
 *
 * Neighborhood district/subdistrict FKs are composite so a district always
 * belongs to the same municipality as the neighborhood (and a subdistrict to
 * the same district). SQL migration uses `ON DELETE SET NULL (district_id)` /
 * `(subdistrict_id)` so municipality_id is never wiped.
 */

export const states = pgTable(
  "states",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    /** IBGE UF code (2 digits), e.g. "35". */
    ibgeId: text("ibge_id").notNull(),
    /** CNES state code when distinct from IBGE. */
    cnesCode: text("cnes_code"),
    /** UF abbreviation, e.g. "SP". */
    abbreviation: text("abbreviation").notNull(),
    boundary: geometryMultiPolygon("boundary"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("states_ibge_id_uidx").on(t.ibgeId),
    uniqueIndex("states_abbreviation_uidx").on(t.abbreviation),
    uniqueIndex("states_cnes_code_uidx")
      .on(t.cnesCode)
      .where(sql`${t.cnesCode} IS NOT NULL`),
    index("states_boundary_gist_idx")
      .using("gist", t.boundary)
      .where(sql`${t.boundary} IS NOT NULL`),
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
    ibgeId: text("ibge_id").notNull(),
    /** CNES municipality code (IBGE without check digit, 6 digits). */
    cnesCode: text("cnes_code"),
    boundary: geometryMultiPolygon("boundary"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("municipalities_ibge_id_uidx").on(t.ibgeId),
    uniqueIndex("municipalities_cnes_code_uidx")
      .on(t.cnesCode)
      .where(sql`${t.cnesCode} IS NOT NULL`),
    /** Enables facilities (municipality_id, state_id) → municipalities (id, state_id). */
    uniqueIndex("municipalities_id_state_id_uidx").on(t.id, t.stateId),
    index("municipalities_state_id_idx").on(t.stateId),
    index("municipalities_name_idx").on(t.name),
    index("municipalities_boundary_gist_idx")
      .using("gist", t.boundary)
      .where(sql`${t.boundary} IS NOT NULL`),
  ]
);

export const districts = pgTable(
  "districts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    municipalityId: integer("municipality_id")
      .notNull()
      .references(() => municipalities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** IBGE district code. */
    ibgeId: text("ibge_id").notNull(),
    boundary: geometryMultiPolygon("boundary"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("districts_ibge_id_uidx").on(t.ibgeId),
    /** Enables neighborhoods (district_id, municipality_id) → districts (id, municipality_id). */
    uniqueIndex("districts_id_municipality_id_uidx").on(t.id, t.municipalityId),
    index("districts_municipality_id_idx").on(t.municipalityId),
    index("districts_name_idx").on(t.name),
    index("districts_boundary_gist_idx")
      .using("gist", t.boundary)
      .where(sql`${t.boundary} IS NOT NULL`),
  ]
);

export const subdistricts = pgTable(
  "subdistricts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    districtId: integer("district_id")
      .notNull()
      .references(() => districts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** IBGE subdistrict code. */
    ibgeId: text("ibge_id").notNull(),
    boundary: geometryMultiPolygon("boundary"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("subdistricts_ibge_id_uidx").on(t.ibgeId),
    /** Enables neighborhoods (subdistrict_id, district_id) → subdistricts (id, district_id). */
    uniqueIndex("subdistricts_id_district_id_uidx").on(t.id, t.districtId),
    index("subdistricts_district_id_idx").on(t.districtId),
    index("subdistricts_name_idx").on(t.name),
    index("subdistricts_boundary_gist_idx")
      .using("gist", t.boundary)
      .where(sql`${t.boundary} IS NOT NULL`),
  ]
);

export const neighborhoods = pgTable(
  "neighborhoods",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    municipalityId: integer("municipality_id")
      .notNull()
      .references(() => municipalities.id, { onDelete: "cascade" }),
    /** Optional; must belong to same municipality (composite FK). */
    districtId: integer("district_id"),
    /** Optional; must belong to same district (composite FK). */
    subdistrictId: integer("subdistrict_id"),
    name: text("name").notNull(),
    /** IBGE bairro code (Censo 2022 malha). */
    ibgeId: text("ibge_id").notNull(),
    boundary: geometryMultiPolygon("boundary"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("neighborhoods_ibge_id_uidx").on(t.ibgeId),
    index("neighborhoods_municipality_id_idx").on(t.municipalityId),
    index("neighborhoods_district_id_idx").on(t.districtId),
    index("neighborhoods_subdistrict_id_idx").on(t.subdistrictId),
    index("neighborhoods_name_idx").on(t.name),
    index("neighborhoods_boundary_gist_idx")
      .using("gist", t.boundary)
      .where(sql`${t.boundary} IS NOT NULL`),
    foreignKey({
      name: "neighborhoods_district_municipality_fk",
      columns: [t.districtId, t.municipalityId],
      foreignColumns: [districts.id, districts.municipalityId],
    }).onDelete("set null"),
    foreignKey({
      name: "neighborhoods_subdistrict_district_fk",
      columns: [t.subdistrictId, t.districtId],
      foreignColumns: [subdistricts.id, subdistricts.districtId],
    }).onDelete("set null"),
    check(
      "neighborhoods_subdistrict_requires_district",
      sql`${t.subdistrictId} IS NULL OR ${t.districtId} IS NOT NULL`,
    ),
  ]
);
