import {
  pgTable,
  text,
  boolean,
  timestamp,
  smallint,
  integer,
  bigint,
  date,
  numeric,
  index,
  uniqueIndex,
  unique,
  check,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { geometryPoint } from "../../types/geometry";
import {
  conformityStatusEnum,
  purchaseIntervalSourceEnum,
  purchaseProfileEnum,
  purchaseFunnelStageEnum,
  healthcareProviderTypeEnum,
  conformityRecordStatusEnum,
  facilityLegalDocumentTypeEnum,
  emultecClientLinkSourceEnum,
} from "./enums";
import { territories } from "./territories";
import { businessVerticals } from "./business-verticals";
import { users } from "./users";
import {
  unitTypes,
  unitSubtypes,
} from "./cnes-lookups";
import { clinicalFocuses } from "./clinical-focuses";
import { municipalities, states } from "./admin-geography";

export const facilities = pgTable(
  "facilities",
  {
    // --- Identity ---
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    displayName: text("name").notNull(),
    legalName: text("legal_name"),
    tradeName: text("trade_name"),

    // --- Registry provenance ---
    cnesCode: text("cnes_code"),
    /**
     * Emultec `clientes.Id`.
     *
     * @deprecated Superseded by `facility_emultec_clients`, which can hold the
     * several Emultec clientes that legitimately belong to one clinic. Read and
     * written only by the order importer; kept for one release so a rollback has
     * somewhere to land. Do not add consumers.
     */
    idClienteEmultec: bigint("id_cliente_emultec", { mode: "number" }),
    // --- Legal document (digits only; type CNPJ=14 / CPF=11) ---
    /** Required on every insert — no DB default (CNPJ vs CPF must be explicit). */
    legalDocumentType: facilityLegalDocumentTypeEnum("legal_document_type").notNull(),
    legalDocument: text("legal_document"),

    // --- Address ---
    country: text("country"),
    neighborhood: text("neighborhood"),
    streetAddress: text("street_address"),
    streetNumber: text("street_number"),
    addressComplement: text("address_complement"),
    postalCode: text("postal_code"),
    /** Admin geography FK → states.id; display name via JOIN. */
    stateId: integer("state_id").notNull(),
    /** Admin geography FK → municipalities.id; mun∈state via composite FK. */
    municipalityId: integer("municipality_id").notNull(),
    /**
     * Spec 0009 R5. Required: the whole ownership model is geometric — a clinic
     * with no point cannot sit in a manager zone, cannot be checked against a
     * rep's patch, and cannot satisfy I2. It is not a partially-filled record but
     * one the model has no meaning for, so the database refuses it rather than
     * leaving every reader to handle a state that should not exist.
     */
    location: geometryPoint("location").notNull(),

    // --- Contact ---
    phoneNumber: text("phone_number"),
    whatsappNumber: text("whatsapp_number"),
    email: text("email"),
    websiteUrl: text("website_url"),
    /** Administrative email (Cadastro required field). */
    billingEmail: text("billing_email"),

    // --- Operational profile (CRM / mobile admin) ---
    /** Technical or commercial responsible person shown on Dados administrativos. */
    responsibleName: text("responsible_name"),
    /** Free-text opening hours, e.g. "Seg–Sex 08:00–18:00". */
    openingHours: text("opening_hours"),

    // --- Classification ---
    imageUrl: text("image_url"),
    /** BlurHash for the facility header image. */
    imageBlurhash: text("image_blurhash"),
    /** CNES TP_UNIDADE → unit_types.id. */
    unitTypeId: bigint("unit_type_id", { mode: "number" }).references(
      () => unitTypes.id,
      { onDelete: "restrict" }
    ),
    /** CNES subtype → unit_subtypes.id (must belong to unitTypeId when both set). */
    unitSubtypeId: bigint("unit_subtype_id", { mode: "number" }).references(
      () => unitSubtypes.id,
      { onDelete: "restrict" }
    ),

    // --- Lifecycle ---
    deactivatedAt: timestamp("deactivated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    foreignKey({
      name: "facilities_state_id_fk",
      columns: [t.stateId],
      foreignColumns: [states.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "facilities_municipality_id_fk",
      columns: [t.municipalityId],
      foreignColumns: [municipalities.id],
    }).onDelete("restrict"),
    /** Enforces municipality.state_id = facilities.state_id. */
    foreignKey({
      name: "facilities_municipality_state_fk",
      columns: [t.municipalityId, t.stateId],
      foreignColumns: [municipalities.id, municipalities.stateId],
    }).onDelete("restrict"),
    uniqueIndex("facilities_cnes_code_uidx")
      .on(t.cnesCode)
      .where(sql`${t.cnesCode} IS NOT NULL AND ${t.deactivatedAt} IS NULL`),
    uniqueIndex("facilities_id_cliente_emultec_uidx")
      .on(t.idClienteEmultec)
      .where(sql`${t.idClienteEmultec} IS NOT NULL`),
    /**
     * CNPJ must be unique among active facilities (legal).
     * CPF clinics may share the same CPF — no unique index for CPF.
     */
    uniqueIndex("facilities_active_legal_document_cnpj_uidx")
      .on(t.legalDocument)
      .where(
        sql`${t.deactivatedAt} IS NULL AND ${t.legalDocument} IS NOT NULL AND ${t.legalDocumentType} = 'CNPJ'`
      ),
    /** Lookup by type+document (CPF non-unique; CNPJ covered by uidx above). */
    index("facilities_active_legal_document_idx")
      .on(t.legalDocumentType, t.legalDocument)
      .where(sql`${t.deactivatedAt} IS NULL AND ${t.legalDocument} IS NOT NULL`),
    index("facilities_deactivated_at_idx").on(t.deactivatedAt),
    index("facilities_name_idx").on(t.displayName),
    index("facilities_state_id_idx").on(t.stateId),
    index("facilities_municipality_id_idx").on(t.municipalityId),
    index("facilities_location_gist_idx")
      .using("gist", t.location)
      .where(sql`${t.location} IS NOT NULL`),
    index("facilities_unit_type_id_idx")
      .on(t.unitTypeId)
      .where(sql`${t.unitTypeId} IS NOT NULL`),
    index("facilities_unit_subtype_id_idx")
      .on(t.unitSubtypeId)
      .where(sql`${t.unitSubtypeId} IS NOT NULL`),
  ]
);

/**
 * Emultec `clientes.Id` → the clinic that client buys for.
 *
 * Replaces `facilities.id_cliente_emultec`, which could only ever hold one
 * client per clinic. Emultec models a surgeon operating out of a clinic as their
 * own pessoa-física row pointing at the clinic through `Id_Cliente_PJ`, so one
 * clinic legitimately has several clientes — COT Centro Ortopédico has five, and
 * 54 parent CNPJs carry 175 clientes between them. A column on `facilities`
 * cannot express that no matter what index sits on it, and the value it did hold
 * silently became "whichever of the N was written first".
 *
 * The constraint worth keeping is the other direction, and it survives as the
 * primary key: one Emultec client resolves to exactly one clinic. Two clinics
 * claiming the same client is a genuine conflict and still fails loudly.
 */
export const facilityEmultecClients = pgTable(
  "facility_emultec_clients",
  {
    /** Emultec `clientes.Id`. One client, one clinic. */
    idClienteEmultec: bigint("id_cliente_emultec", { mode: "number" }).primaryKey(),
    facilityId: bigint("facility_id", { mode: "number" })
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    /**
     * Who established the link. The old column could not distinguish a
     * deliberate operator decision from a link the importer inferred, which
     * matters now that both write here.
     */
    source: emultecClientLinkSourceEnum("source").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    /** Deliberately not unique — several clientes per clinic is the normal case. */
    index("facility_emultec_clients_facility_id_idx").on(t.facilityId),
  ]
);

export const facilityNotes = pgTable(
  "facility_notes",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" })
      .notNull().references(() => users.id, { onDelete: "cascade" }),
    facilityId: bigint("facility_id", { mode: "number" })
      .notNull().references(() => facilities.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("facility_notes_facility_id_user_id_created_at_idx").on(
      t.facilityId,
      t.userId,
      t.createdAt
    ),
    index("facility_notes_user_id_created_at_idx").on(t.userId, t.createdAt),
  ]
);

/** Gallery photos for an establishment (header avatar uses `facilities.image_url`). */
export const facilityPhotos = pgTable(
  "facility_photos",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    facilityId: bigint("facility_id", { mode: "number" })
      .notNull().references(() => facilities.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    url: text("url").notNull(),
    blurhash: text("blurhash"),
    contentType: text("content_type").notNull(),
    uploadedByUserId: bigint("uploaded_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("facility_photos_facility_id_created_at_idx").on(
      t.facilityId,
      t.createdAt
    ),
    uniqueIndex("facility_photos_storage_key_uidx").on(t.storageKey),
  ]
);

/**
 * Vertical-specific commercial + purchase-funnel profile for a facility.
 * Funnel/recurrence is computed from orders of this verticalId only.
 * Canonical: facility participates in this business vertical.
 */
export const facilityVerticalProfiles = pgTable(
  "facility_vertical_profiles",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    facilityId: bigint("facility_id", { mode: "number" })
      .notNull().references(() => facilities.id, { onDelete: "cascade" }),
    verticalId: bigint("vertical_id", { mode: "number" })
      .notNull().references(() => businessVerticals.id, { onDelete: "restrict" }),
    /**
     * Spec 0006: per-vertical geo membership = containing manager zone (not rep patch).
     * Null = unassigned/ambiguous for this vertical.
     */
    managerZoneId: bigint("manager_zone_id", { mode: "number" }),
    isActive: boolean("is_active").notNull().default(true),
    /**
     * Cadastro document completion for this facility x vertical (spec 0010
     * §1.6). Renamed from `commercial_status`: the values were always cadastro
     * state, and the old name had reps reading "Operante" as a trading status.
     * Written only by FacilityCadastroCompletionService.
     */
    conformityStatus: conformityStatusEnum("conformity_status")
      .notNull()
      .default("UNREGISTERED"),
    observedPurchaseIntervalDays: bigint("observed_purchase_interval_days", { mode: "number" }),
    purchaseIntervalDays: bigint("purchase_interval_days", { mode: "number" }).notNull().default(30),
    purchaseIntervalSource: purchaseIntervalSourceEnum("purchase_interval_source")
      .notNull()
      .default("DEFAULT"),
    manualPurchaseProfile: purchaseProfileEnum("manual_purchase_profile"),
    manualPurchaseIntervalDays: bigint("manual_purchase_interval_days", { mode: "number" }),
    lastValidPurchaseDate: date("last_valid_purchase_date"),
    purchaseRecurrenceSampleSize: smallint("purchase_recurrence_sample_size")
      .notNull()
      .default(0),
    purchaseFunnelStage: purchaseFunnelStageEnum("purchase_funnel_stage")
      .notNull()
      .default("NEVER_PURCHASED"),
    nextPurchaseFunnelTransitionDate: date("next_purchase_funnel_transition_date"),
    purchaseRecurrenceCalculatedAt: timestamp("purchase_recurrence_calculated_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    foreignKey({
      name: "facility_vertical_profiles_manager_zone_vertical_fk",
      columns: [t.managerZoneId, t.verticalId],
      foreignColumns: [territories.id, territories.verticalId],
    }).onDelete("set null"),
    uniqueIndex("facility_vertical_profiles_facility_id_vertical_id_uidx").on(
      t.facilityId,
      t.verticalId
    ),
    // Redundant beside the primary key, but a composite foreign key can only
    // reference a unique constraint. `facility_product_usage` uses it to hold a
    // usage row's profile and its definition in the same linha.
    unique("facility_vertical_profiles_id_vertical_id_key").on(t.id, t.verticalId),
    index("facility_vertical_profiles_conformity_status_idx").on(t.conformityStatus),
    index("facility_vertical_profiles_facility_id_idx").on(t.facilityId),
    index("facility_vertical_profiles_vertical_id_idx").on(t.verticalId),
    index("facility_vertical_profiles_manager_zone_id_idx").on(t.managerZoneId),
    index("facility_vertical_profiles_vertical_funnel_stage_idx").on(
      t.verticalId,
      t.purchaseFunnelStage,
    ),
    index("facility_vertical_profiles_next_funnel_transition_idx")
      .on(t.nextPurchaseFunnelTransitionDate, t.id)
      .where(
        sql`${t.isActive} = true and ${t.nextPurchaseFunnelTransitionDate} is not null`,
      ),
    check(
      "facility_vertical_profiles_observed_purchase_interval_days_check",
      sql`${t.observedPurchaseIntervalDays} is null or ${t.observedPurchaseIntervalDays} between 1 and 3650`,
    ),
    check(
      "facility_vertical_profiles_purchase_interval_days_check",
      sql`${t.purchaseIntervalDays} between 1 and 3650`,
    ),
    check(
      "facility_vertical_profiles_manual_purchase_interval_days_check",
      sql`${t.manualPurchaseIntervalDays} is null or ${t.manualPurchaseIntervalDays} between 1 and 3650`,
    ),
    check(
      "facility_vertical_profiles_manual_purchase_profile_days_check",
      sql`(${t.manualPurchaseProfile} = 'CUSTOM' and ${t.manualPurchaseIntervalDays} is not null)
        or (${t.manualPurchaseProfile} is distinct from 'CUSTOM' and ${t.manualPurchaseIntervalDays} is null)`,
    ),
    check(
      "facility_vertical_profiles_purchase_recurrence_sample_size_check",
      sql`${t.purchaseRecurrenceSampleSize} between 0 and 12`,
    ),
    check(
      "facility_vertical_profiles_purchase_interval_source_check",
      sql`(${t.purchaseIntervalSource} = 'MANUAL' and ${t.manualPurchaseProfile} is not null)
        or (${t.purchaseIntervalSource} <> 'MANUAL' and ${t.manualPurchaseProfile} is null)`,
    ),
  ]
);

/**
 * Time-bounded REP responsibility under a facility×vertical profile.
 * One active assignment per profile (`ended_at IS NULL`).
 */
export const facilityVerticalRepAssignments = pgTable(
  "facility_vertical_rep_assignments",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    /*
     * Invariant I5: rep assignment rows are never deleted — ending one sets
     * `ended_at`. Both of these were ON DELETE CASCADE, which meant deleting a
     * user or a vertical profile erased their entire assignment history: no
     * `ended_at`, no `end_reason`, no `ended_by_user_id`, no row.
     *
     * That contradicted the invariant the rest of spec 0009 is built on. R1
     * reorders validate-before-destroy precisely because an ended assignment
     * cannot be restored by re-creating it — and underneath, two foreign keys
     * could delete the history outright.
     *
     * RESTRICT costs nothing today: nothing in the codebase hard-deletes a user
     * or a profile. Users carry `deleted_at`, profiles carry `is_active`. It
     * turns "you may not do this" from a convention into a rule.
     */
    facilityVerticalProfileId: bigint("facility_vertical_profile_id", { mode: "number" }).notNull(),
    userId: bigint("user_id", { mode: "number" }).notNull(),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
    assignedByUserId: bigint("assigned_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    endReason: text("end_reason"),
    /**
     * Spec 0009 R5/R2: who ended it. `end_reason` recorded *why* and nothing
     * recorded *who* — and manager-zone boundary edits are ADMIN-only, so an
     * admin's redraw ended rep assignments a manager had made, untraceably.
     * Nullable with no backfill: we genuinely do not know for existing rows.
     */
    endedByUserId: bigint("ended_by_user_id", { mode: "number" }),
    /**
     * Spec 0009 R2. The informal market requires assigning a rep outside their
     * patch, so I2 becomes "a patch covers the clinic **or** this is set".
     *
     * Modelled on the assignment rather than as an exception type, because the
     * override is a property of *this* rep holding *this* clinic — and because
     * recompute must be able to see it. An overridden assignment is skipped by
     * de-assignment sweeps and excluded from boundary-impact sets: an override
     * that a recompute can erase is not an override.
     */
    overrideReason: text("override_reason"),
    overrideByUserId: bigint("override_by_user_id", { mode: "number" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("facility_vertical_rep_assignments_profile_id_ended_at_idx").on(
      t.facilityVerticalProfileId,
      t.endedAt,
    ),
    /** The out-of-territory report: active overrides, newest first. */
    index("facility_vertical_rep_assignments_override_idx")
      .on(t.overrideByUserId)
      .where(sql`${t.overrideReason} IS NOT NULL AND ${t.endedAt} IS NULL`),
    /*
     * Named explicitly. Drizzle's derived name for the override FK would be
     * `facility_vertical_rep_assignments_override_by_user_id_users_id_fk` — 65
     * characters, which Postgres silently truncates to 63. This table already
     * carries two such casualties (`..._assigned_by_user_id_users_id_`, missing
     * its `fk` suffix), and a truncated name is one a later DROP CONSTRAINT
     * cannot find.
     */
    /*
     * Named explicitly for the same reason as the override FK below: Drizzle's
     * derived name for the profile FK is 95 characters, and Postgres stored it
     * truncated at 63. The generated migration then tried to DROP the *full*
     * name — a constraint that does not exist — which would have failed on
     * apply. Short explicit names make the file and the database agree.
     */
    foreignKey({
      name: "fvra_profile_id_fk",
      columns: [t.facilityVerticalProfileId],
      foreignColumns: [facilityVerticalProfiles.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "fvra_user_id_fk",
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "fvra_ended_by_user_id_fk",
      columns: [t.endedByUserId],
      foreignColumns: [users.id],
    }).onDelete("set null"),
    foreignKey({
      name: "fvra_override_by_user_id_fk",
      columns: [t.overrideByUserId],
      foreignColumns: [users.id],
    }).onDelete("set null"),
    index("facility_vertical_rep_assignments_user_id_ended_at_idx").on(t.userId, t.endedAt),
    uniqueIndex("facility_vertical_rep_assignments_profile_active_uidx")
      .on(t.facilityVerticalProfileId)
      .where(sql`${t.endedAt} IS NULL`),
    check(
      "facility_vertical_rep_assignments_ended_at_gte_started_at_check",
      sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.startedAt}`,
    ),
    /*
     * Spec 0009 R2: an override records who and why, or it is not an override.
     * The use case always writes both, but nothing stopped a script or a
     * backfill writing a reason with no author — and the out-of-territory
     * report would then answer "why" and not "who", which is the exact gap
     * `ended_by_user_id` was added to close elsewhere in this table.
     */
    check(
      "fvra_override_reason_and_author_together_check",
      sql`(${t.overrideReason} IS NULL) = (${t.overrideByUserId} IS NULL)`,
    ),
  ],
);

export const healthcareProviders = pgTable(
  "healthcare_providers",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    type: healthcareProviderTypeEnum("type").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("healthcare_providers_is_active_idx").on(t.isActive)]
);

export const facilityHealthcareProviderShares = pgTable(
  "facility_healthcare_provider_shares",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    facilityId: bigint("facility_id", { mode: "number" }).notNull().references(() => facilities.id, { onDelete: "cascade" }),
    healthcareProviderId: bigint("healthcare_provider_id", { mode: "number" }).notNull().references(() => healthcareProviders.id, { onDelete: "restrict" }),
    sharePercent: numeric("share_percent", { precision: 5, scale: 2 }).notNull(),
    /** Whether this facility treats the provider share as a package (pacote). */
    isPackage: boolean("is_package").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("facility_healthcare_provider_shares_facility_id_provider_id_uidx").on(
      t.facilityId,
      t.healthcareProviderId
    ),
    index("facility_healthcare_provider_shares_facility_id_idx").on(t.facilityId),
    index("facility_healthcare_provider_shares_healthcare_provider_id_idx").on(t.healthcareProviderId),
    check(
      "facility_healthcare_provider_shares_share_percent_check",
      sql`${t.sharePercent} >= 0 AND ${t.sharePercent} <= 100`
    ),
  ]
);

export const conformityRequirements = pgTable(
  "conformity_requirements",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    verticalId: bigint("vertical_id", { mode: "number" }).references(() => businessVerticals.id, {
      onDelete: "set null",
    }),
    /** When set, requirement applies only to facilities with this legal document type. */
    appliesToLegalDocumentType: facilityLegalDocumentTypeEnum(
      "applies_to_legal_document_type"
    ),
    isActive: boolean("is_active").notNull().default(true),
    /** Per-document-type upload limits (cadastro multi-file). */
    allowedMimeTypes: text("allowed_mime_types")
      .array()
      .notNull()
      .default(["image/jpeg", "image/png", "application/pdf"]),
    maxFiles: bigint("max_files", { mode: "number" }).notNull().default(10),
    maxFileSizeBytes: bigint("max_file_size_bytes", { mode: "number" })
      .notNull()
      .default(52_428_800),
    maxCombinedSizeBytes: bigint("max_combined_size_bytes", { mode: "number" })
      .notNull()
      .default(209_715_200),
    requiresFrontAndBack: boolean("requires_front_and_back").notNull().default(false),
    /**
     * Whether the rep is asked for a validity date when submitting this
     * requirement, and the reviewer asked to confirm it on approval
     * (spec 0011 §3.3, ADR 0008 §4/§6).
     *
     * It is a property of the *requirement*, not of the document: a Cartão CNPJ
     * never expires, a Licença Sanitária always does. The date itself lives on
     * the document, and the expiry warning is derived from it at read time —
     * there is no stored EXPIRING_SOON status to keep in step.
     */
    requiresValidityDate: boolean("requires_validity_date").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("conformity_requirements_vertical_id_idx").on(t.verticalId),
    index("conformity_requirements_is_active_idx").on(t.isActive),
    index("conformity_requirements_applies_to_legal_document_type_idx").on(
      t.appliesToLegalDocumentType
    ),
  ]
);

export const conformityRecords = pgTable(
  "conformity_records",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    facilityId: bigint("facility_id", { mode: "number" }).notNull().references(() => facilities.id, { onDelete: "cascade" }),
    requirementId: bigint("requirement_id", { mode: "number" }).notNull().references(() => conformityRequirements.id, { onDelete: "restrict" }),
    status: conformityRecordStatusEnum("status").notNull().default("PENDING"),
    submittedAt: timestamp("submitted_at"),
    validatedAt: timestamp("validated_at"),
    expiresAt: timestamp("expires_at"),
    validatedByUserId: bigint("validated_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    storageKey: text("storage_key"),
    url: text("url"),
    contentType: text("content_type"),
    fileName: text("file_name"),
    reviewerNote: text("reviewer_note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("conformity_records_facility_id_requirement_id_uidx").on(t.facilityId, t.requirementId),
    index("conformity_records_facility_id_idx").on(t.facilityId),
    index("conformity_records_requirement_id_idx").on(t.requirementId),
    index("conformity_records_status_idx").on(t.status),
    uniqueIndex("conformity_records_storage_key_uidx").on(t.storageKey),
  ]
);

/** Join: facility ↔ clinical focus (catalog in clinical_focuses). */
export const facilityClinicalFocuses = pgTable(
  "facility_clinical_focuses",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    facilityId: bigint("facility_id", { mode: "number" })
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    clinicalFocusId: bigint("clinical_focus_id", { mode: "number" })
      .notNull()
      .references(() => clinicalFocuses.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("facility_clinical_focuses_facility_id_clinical_focus_id_uidx").on(
      t.facilityId,
      t.clinicalFocusId
    ),
    index("facility_clinical_focuses_facility_id_idx").on(t.facilityId),
    index("facility_clinical_focuses_clinical_focus_id_idx").on(t.clinicalFocusId),
  ]
);

// --- Relations ---

export const facilitiesRelations = relations(facilities, ({ one, many }) => ({
  unitType: one(unitTypes, {
    fields: [facilities.unitTypeId],
    references: [unitTypes.id],
  }),
  unitSubtype: one(unitSubtypes, {
    fields: [facilities.unitSubtypeId],
    references: [unitSubtypes.id],
  }),
  verticalProfiles: many(facilityVerticalProfiles),
  healthcareProviderShares: many(facilityHealthcareProviderShares),
  conformityRecords: many(conformityRecords),
  clinicalFocusLinks: many(facilityClinicalFocuses),
  notes: many(facilityNotes),
  photos: many(facilityPhotos),
}));

export const facilityVerticalProfilesRelations = relations(
  facilityVerticalProfiles,
  ({ one, many }) => ({
    facility: one(facilities, {
      fields: [facilityVerticalProfiles.facilityId],
      references: [facilities.id],
    }),
    vertical: one(businessVerticals, {
      fields: [facilityVerticalProfiles.verticalId],
      references: [businessVerticals.id],
    }),
    territory: one(territories, {
      fields: [facilityVerticalProfiles.managerZoneId],
      references: [territories.id],
    }),
    repAssignments: many(facilityVerticalRepAssignments),
  })
);

export const facilityVerticalRepAssignmentsRelations = relations(
  facilityVerticalRepAssignments,
  ({ one }) => ({
    profile: one(facilityVerticalProfiles, {
      fields: [facilityVerticalRepAssignments.facilityVerticalProfileId],
      references: [facilityVerticalProfiles.id],
    }),
    user: one(users, {
      fields: [facilityVerticalRepAssignments.userId],
      references: [users.id],
      relationName: "FacilityVerticalRepUser",
    }),
    assignedBy: one(users, {
      fields: [facilityVerticalRepAssignments.assignedByUserId],
      references: [users.id],
      relationName: "FacilityVerticalRepAssignedBy",
    }),
  }),
);

export const facilityPhotosRelations = relations(facilityPhotos, ({ one }) => ({
  facility: one(facilities, {
    fields: [facilityPhotos.facilityId],
    references: [facilities.id],
  }),
  uploadedBy: one(users, {
    fields: [facilityPhotos.uploadedByUserId],
    references: [users.id],
  }),
}));

export const facilityClinicalFocusesRelations = relations(
  facilityClinicalFocuses,
  ({ one }) => ({
    facility: one(facilities, {
      fields: [facilityClinicalFocuses.facilityId],
      references: [facilities.id],
    }),
    clinicalFocus: one(clinicalFocuses, {
      fields: [facilityClinicalFocuses.clinicalFocusId],
      references: [clinicalFocuses.id],
    }),
  })
);

export const healthcareProvidersRelations = relations(healthcareProviders, ({ many }) => ({
  facilityShares: many(facilityHealthcareProviderShares),
}));

export const facilityHealthcareProviderSharesRelations = relations(facilityHealthcareProviderShares, ({ one }) => ({
  facility: one(facilities, { fields: [facilityHealthcareProviderShares.facilityId], references: [facilities.id] }),
  healthcareProvider: one(healthcareProviders, {
    fields: [facilityHealthcareProviderShares.healthcareProviderId],
    references: [healthcareProviders.id],
  }),
}));

export const conformityRequirementsRelations = relations(conformityRequirements, ({ one, many }) => ({
  vertical: one(businessVerticals, {
    fields: [conformityRequirements.verticalId],
    references: [businessVerticals.id],
  }),
  records: many(conformityRecords),
}));

export const conformityRecordsRelations = relations(conformityRecords, ({ one }) => ({
  facility: one(facilities, { fields: [conformityRecords.facilityId], references: [facilities.id] }),
  requirement: one(conformityRequirements, {
    fields: [conformityRecords.requirementId],
    references: [conformityRequirements.id],
  }),
  validatedBy: one(users, {
    fields: [conformityRecords.validatedByUserId],
    references: [users.id],
  }),
}));
