import {
  pgSchema,
  text,
  integer,
  boolean,
  timestamp,
  bigint,
  primaryKey,
  foreignKey,
  unique,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * CNES registry — an externally-sourced, read-only mirror of the monthly DATASUS
 * export. Kept in its own schema because it is wholly replaceable: `public` is
 * authored by our users and authoritative, this is reference data that a reload
 * may discard entirely.
 *
 * Two consequences run through every table below:
 *
 * 1. **Natural CNES keys are the primary keys.** `cnes_id` is whatever CNES calls
 *    the row (CO_CNES, CO_PROFISSIONAL_SUS, CBO, IBGE code). A surrogate would
 *    add a layer whose only job is to hide the key the source already guarantees.
 *
 * 2. **`atlasmed_id` is a logical bridge, never a hard FK.** A real FK into
 *    `public` would couple migration and delete ordering across two schemas with
 *    opposite lifecycles. Uniqueness is enforced here; set-correctness is the
 *    ETL's job.
 */
export const registrySchema = pgSchema("registry");

// ─── Aux dimensions — insert-new-only ────────────────────────────────────────
//
// These grow forever and are never wiped: a code that disappears from one month's
// export has not stopped existing, and rows already referencing it must not break.

/**
 * Órgão emissor, **not** `tbConselhoClasse`.
 *
 * The dump ships two different council code systems and they disagree: in
 * `tbConselhoClasse` CRM is `10`, while the órgão-emissor codes actually carried
 * on `tbCargaHorariaSus.CO_CONSELHO_CLASSE` use `71`. Seeding from the wrong one
 * silently mislabels every doctor's council, so only curated órgão-emissor codes
 * are ever inserted here.
 */
export const registryProfessionalCouncils = registrySchema.table(
  "professional_councils",
  {
    cnesId: text("cnes_id").primaryKey(),
    name: text("name").notNull(),
    abbreviation: text("abbreviation").notNull(),
    /** → public.person_professional_registration_councils.id */
    atlasmedId: bigint("atlasmed_id", { mode: "number" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    unique("registry_professional_councils_abbreviation_key").on(t.abbreviation),
    uniqueIndex("registry_professional_councils_atlasmed_id_uidx")
      .on(t.atlasmedId)
      .where(sql`${t.atlasmedId} IS NOT NULL`),
  ]
);

/** CBO occupation catalog — source `tbAtividadeProfissional`. */
export const registryOccupations = registrySchema.table(
  "occupations",
  {
    cnesId: text("cnes_id").primaryKey(),
    name: text("name").notNull(),
    isHealthOccupation: boolean("is_health_occupation"),
    isRegulated: boolean("is_regulated"),
    /** → public.occupations.id */
    atlasmedId: bigint("atlasmed_id", { mode: "number" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("registry_occupations_atlasmed_id_uidx")
      .on(t.atlasmedId)
      .where(sql`${t.atlasmedId} IS NOT NULL`),
    index("registry_occupations_is_health_occupation_idx")
      .on(t.isHealthOccupation)
      .where(sql`${t.isHealthOccupation}`),
  ]
);

export const registryStates = registrySchema.table(
  "states",
  {
    /** UF, e.g. `SP`. */
    cnesId: text("cnes_id").primaryKey(),
    name: text("name").notNull(),
    /** → public.states.id */
    atlasmedId: integer("atlasmed_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    check("registry_states_cnes_id_len_check", sql`char_length(${t.cnesId}) = 2`),
    uniqueIndex("registry_states_atlasmed_id_uidx")
      .on(t.atlasmedId)
      .where(sql`${t.atlasmedId} IS NOT NULL`),
  ]
);

export const registryMunicipalities = registrySchema.table(
  "municipalities",
  {
    /** IBGE code. */
    cnesId: text("cnes_id").primaryKey(),
    name: text("name").notNull(),
    stateCnesId: text("state_cnes_id").notNull(),
    /** → public.municipalities.id */
    atlasmedId: integer("atlasmed_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    foreignKey({
      name: "registry_municipalities_state_cnes_id_fk",
      columns: [t.stateCnesId],
      foreignColumns: [registryStates.cnesId],
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    uniqueIndex("registry_municipalities_atlasmed_id_uidx")
      .on(t.atlasmedId)
      .where(sql`${t.atlasmedId} IS NOT NULL`),
    index("registry_municipalities_state_cnes_id_idx").on(t.stateCnesId),
  ]
);

// ─── Facilities — upsert every run ───────────────────────────────────────────

/**
 * CNES establishment mirror.
 *
 * Rows may exist without `atlasmed_id` — a facility we do not operate is harmless
 * here and simply never reaches the staff pipeline. What gates the staff import is
 * `atlasmed_id IS NOT NULL`, not membership in this table.
 */
export const registryFacilities = registrySchema.table(
  "facilities",
  {
    /** CO_CNES (7 digits). */
    cnesId: text("cnes_id").primaryKey(),
    /**
     * CO_UNIDADE — a 30-character opaque key, UF letters then a zero-padded
     * number (`AP00000000000000099990010000004`, dump 202605). This, not
     * `cnes_id`, is what `tbCargaHorariaSus` joins on, so the staff scan needs it
     * resolvable.
     *
     * It is **not** derivable from anything we hold: an earlier note here
     * described it as município + CNES, which the real export disproves. The
     * establishment file is the only source, which is why it must be read before
     * the carga scan.
     */
    cnesUnitCode: text("cnes_unit_code"),
    /** → public.facilities.id */
    atlasmedId: bigint("atlasmed_id", { mode: "number" }),
    legalName: text("legal_name"),
    tradeName: text("trade_name"),
    taxIdCnpj: text("tax_id_cnpj"),
    taxIdCpf: text("tax_id_cpf"),
    streetAddress: text("street_address"),
    streetNumber: text("street_number"),
    addressComplement: text("address_complement"),
    neighborhood: text("neighborhood"),
    postalCode: text("postal_code"),
    /**
     * Source `CO_MUNICIPIO_GESTOR` — the município that *manages* the unit.
     * `tbEstabelecimento` carries no plain `CO_MUNICIPIO`, so this is the only
     * municipality the export offers.
     *
     * For everything this table holds the two are the same thing: the loader
     * only upserts clinics we operate, and the gestor matched our own
     * `facilities.municipality_id` on 1423 of 1423, with no divergence and no
     * blanks (202605). **If the scope ever widens** to units we do not operate —
     * state- or federally-managed hospitals — the gestor can differ from where
     * the establishment actually is, and this column would quietly stop meaning
     * what its name says.
     */
    municipalityCnesId: text("municipality_cnes_id"),
    phoneNumber: text("phone_number"),
    email: text("email"),
    unitTypeCode: text("unit_type_code"),
    unitTypeName: text("unit_type_name"),
    unitSubtypeName: text("unit_subtype_name"),
    deactivationReasonCode: text("deactivation_reason_code"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    foreignKey({
      name: "registry_facilities_municipality_cnes_id_fk",
      columns: [t.municipalityCnesId],
      foreignColumns: [registryMunicipalities.cnesId],
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    uniqueIndex("registry_facilities_cnes_unit_code_uidx")
      .on(t.cnesUnitCode)
      .where(sql`${t.cnesUnitCode} IS NOT NULL`),
    /** Also serves the "which registry row is this Atlas facility" lookup. */
    uniqueIndex("registry_facilities_atlasmed_id_uidx")
      .on(t.atlasmedId)
      .where(sql`${t.atlasmedId} IS NOT NULL`),
    index("registry_facilities_municipality_cnes_id_idx").on(t.municipalityCnesId),
  ]
);

// ─── Professionals — need-to-know, never deleted ─────────────────────────────

/**
 * One row per human CNES knows about, restricted to those linked to a facility we
 * operate.
 *
 * **Never deleted.** Absence from a month's export is not evidence someone left —
 * CNES reporting lags, and a deletion would drop a bridge (`atlasmed_id`) a user
 * established by hand. Only `source_last_seen_at` moves.
 *
 * `tax_id` is nullable and, in practice, useless for matching: CNES masks CPF in
 * the public dump (`XXX.392.286.XX` — 5 of 11 digits redacted, on 100 % of the
 * 7.7 M rows in 202605). The join key is the CRM registration, not the CPF.
 */
export const registryProfessionals = registrySchema.table(
  "professionals",
  {
    /** CO_PROFISSIONAL_SUS. */
    cnesId: text("cnes_id").primaryKey(),
    /** → public.persons.id — set on link or promote, never by the loader. */
    atlasmedId: bigint("atlasmed_id", { mode: "number" }),
    fullName: text("full_name").notNull(),
    socialName: text("social_name"),
    /** Masked in the public dump; kept for completeness, not for matching. */
    taxId: text("tax_id"),
    healthCardNumber: text("health_card_number"),
    sourceFirstSeenAt: timestamp("source_first_seen_at").notNull().defaultNow(),
    sourceLastSeenAt: timestamp("source_last_seen_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    /** Also serves the "which registry row is this person" lookup. */
    uniqueIndex("registry_professionals_atlasmed_id_uidx")
      .on(t.atlasmedId)
      .where(sql`${t.atlasmedId} IS NOT NULL`),
    index("registry_professionals_tax_id_idx")
      .on(t.taxId)
      .where(sql`${t.taxId} IS NOT NULL`),
    index("registry_professionals_full_name_idx").on(t.fullName),
  ]
);

/**
 * Council registration — **the join key to `public`**.
 *
 * `(council, UF, number)` is what resolves a CNES professional to one of ours,
 * against the identically-unique `public.person_professional_registrations`. It is
 * measured at ~100 % coverage for doctors (CBO `225*`: 18 620 of 18 621 unique SUS
 * ids on Atlas-scoped carga, dump 202605) and ~52.6 % for everyone else — which is
 * why v1 imports doctors only.
 *
 * Surrogate PK rather than the composite: nothing FKs into this table, and a wide
 * composite key buys nothing.
 */
export const registryProfessionalRegistrations = registrySchema.table(
  "professional_registrations",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    professionalCnesId: text("professional_cnes_id").notNull(),
    councilCnesId: text("council_cnes_id").notNull(),
    stateCode: text("state_code").notNull(),
    registrationNumber: text("registration_number").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    foreignKey({
      name: "registry_professional_registrations_professional_cnes_id_fk",
      columns: [t.professionalCnesId],
      foreignColumns: [registryProfessionals.cnesId],
    })
      .onUpdate("cascade")
      /** Identity is never cascade-deleted — the staff replace deletes vínculos, not people. */
      .onDelete("restrict"),
    foreignKey({
      name: "registry_professional_registrations_council_cnes_id_fk",
      columns: [t.councilCnesId],
      foreignColumns: [registryProfessionalCouncils.cnesId],
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    check(
      "registry_professional_registrations_state_code_len_check",
      sql`char_length(${t.stateCode}) = 2`
    ),
    check(
      "registry_professional_registrations_number_not_blank_check",
      sql`char_length(btrim(${t.registrationNumber})) > 0`
    ),
    /**
     * Global identity: no two people may hold the same council + UF + number.
     * A violation means two SUS ids claim one CRM — the loader logs and keeps the
     * first owner rather than reassigning, because silently moving a registration
     * between people is how a doctor's history gets attributed to a stranger.
     */
    unique("registry_professional_registrations_council_state_number_key").on(
      t.councilCnesId,
      t.stateCode,
      t.registrationNumber
    ),
    /** One slot per professional per council per UF — the number upserts in place. */
    unique("registry_prof_registrations_prof_council_state_key").on(
      t.professionalCnesId,
      t.councilCnesId,
      t.stateCode
    ),
    index("registry_professional_registrations_professional_cnes_id_idx").on(
      t.professionalCnesId
    ),
  ]
);

// ─── Facility ↔ professional — latest snapshot only ──────────────────────────

/**
 * Who CNES says works at a clinic, **current export only**.
 *
 * Deliberately carries no hours, competence, or seen-flags: this table is replaced
 * wholesale per scoped facility on every run, so per-row history would be a lie.
 * CNES has no leave event — only absence from the next dump — and conflating the
 * two would let a late-reporting clinic read as staff turnover.
 */
export const registryFacilityProfessionals = registrySchema.table(
  "facility_professionals",
  {
    facilityCnesId: text("facility_cnes_id").notNull(),
    professionalCnesId: text("professional_cnes_id").notNull(),
    /** Denormalised CO_UNIDADE the carga row arrived on. */
    cnesUnitCode: text("cnes_unit_code"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({
      name: "registry_facility_professionals_pkey",
      columns: [t.facilityCnesId, t.professionalCnesId],
    }),
    foreignKey({
      name: "registry_facility_professionals_facility_cnes_id_fk",
      columns: [t.facilityCnesId],
      foreignColumns: [registryFacilities.cnesId],
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      name: "registry_facility_professionals_professional_cnes_id_fk",
      columns: [t.professionalCnesId],
      foreignColumns: [registryProfessionals.cnesId],
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    /** "Every clinic this professional works at." */
    index("registry_facility_professionals_professional_cnes_id_idx").on(
      t.professionalCnesId
    ),
  ]
);

/**
 * A professional's CBOs at one clinic.
 *
 * Split out rather than folded into the vínculo PK because one person genuinely
 * holds several CBOs at the same establishment; keeping occupation in the parent
 * key would multiply the vínculo row and break "one row per person at clinic".
 */
export const registryFacilityProfessionalOccupations = registrySchema.table(
  "facility_professional_occupations",
  {
    facilityCnesId: text("facility_cnes_id").notNull(),
    professionalCnesId: text("professional_cnes_id").notNull(),
    occupationCnesId: text("occupation_cnes_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({
      name: "registry_facility_professional_occupations_pkey",
      columns: [t.facilityCnesId, t.professionalCnesId, t.occupationCnesId],
    }),
    foreignKey({
      name: "registry_facility_professional_occupations_vinculo_fk",
      columns: [t.facilityCnesId, t.professionalCnesId],
      foreignColumns: [
        registryFacilityProfessionals.facilityCnesId,
        registryFacilityProfessionals.professionalCnesId,
      ],
    })
      .onUpdate("cascade")
      /** Occupations belong to the vínculo — they go when the snapshot is replaced. */
      .onDelete("cascade"),
    foreignKey({
      name: "registry_facility_prof_occupations_occupation_fk",
      columns: [t.occupationCnesId],
      foreignColumns: [registryOccupations.cnesId],
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    index("registry_facility_professional_occupations_occupation_idx").on(
      t.occupationCnesId
    ),
    index("registry_facility_professional_occupations_professional_idx").on(
      t.professionalCnesId
    ),
  ]
);
