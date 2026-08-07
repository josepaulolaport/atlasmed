import {
  pgTable,
  text,
  boolean,
  timestamp,
  smallint,
  integer,
  bigint,
  date,
  index,
  uniqueIndex,
  check
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { geometryPoint } from "../../types/geometry";
import {
  conformityStatusEnum,
  commercialStatusEnum,
  purchaseStatusEnum,
  purchaseIntervalSourceEnum,
  purchaseProfileEnum,
  purchaseFunnelStageEnum,
  contactTypeEnum,
  healthcareProviderTypeEnum,
  conformityRecordStatusEnum,
  facilityLegalDocumentTypeEnum,
} from "./enums";
import { territories } from "./territories";
import { businessVerticals } from "./business-verticals";
import { users } from "./users";
import {
  occupations,
  facilityTypes,
  unitTypes,
  deactivationReasons,
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
    /** CNES type code → facility_types (FK deferred until lookups are seeded). */
    facilityTypeCode: text("facility_type_code"),
    /** CNES deactivation code → deactivation_reasons (FK deferred until lookups are seeded). */
    registryDeactivationCode: text("registry_deactivation_code"),

    // --- Legal document (digits only; type CNPJ=14 / CPF=11) ---
    /** Required on every insert — no DB default (CNPJ vs CPF must be explicit). */
    legalDocumentType: facilityLegalDocumentTypeEnum("legal_document_type").notNull(),
    legalDocument: text("legal_document"),

    // --- Address ---
    country: text("country"),
    state: text("state"),
    city: text("city"),
    neighborhood: text("neighborhood"),
    streetAddress: text("street_address"),
    streetNumber: text("street_number"),
    addressComplement: text("address_complement"),
    postalCode: text("postal_code"),
    /** Admin geography FK → states.id; city/state text kept for display. */
    stateId: integer("state_id")
      .notNull()
      .references(() => states.id, { onDelete: "restrict" }),
    /** Admin geography FK → municipalities.id; must belong to `stateId`. */
    municipalityId: integer("municipality_id")
      .notNull()
      .references(() => municipalities.id, { onDelete: "restrict" }),
    location: geometryPoint("location"),

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
    conformityStatus: conformityStatusEnum("conformity_status").notNull().default("INCOMPLETE"),
    imageUrl: text("image_url"),
    /** BlurHash for the facility header image. */
    imageBlurhash: text("image_blurhash"),
    /** CNES TP_UNIDADE → unit_types (FK deferred until lookups are seeded). */
    unitTypeCode: text("unit_type_code"),
    /** CNES subtype code from rlEstabSubTipo; scoped by unit_type_code (FK deferred). */
    unitSubtypeCode: text("unit_subtype_code"),

    // --- Lifecycle ---
    deactivatedAt: timestamp("deactivated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("facilities_cnes_code_uidx")
      .on(t.cnesCode)
      .where(sql`${t.cnesCode} IS NOT NULL AND ${t.deactivatedAt} IS NULL`),
    index("facilities_deactivated_at_idx").on(t.deactivatedAt),
    index("facilities_name_idx").on(t.displayName),
    index("facilities_conformity_status_idx").on(t.conformityStatus),
    index("facilities_state_id_idx").on(t.stateId),
    index("facilities_municipality_id_idx").on(t.municipalityId),
    index("facilities_facility_type_code_idx")
      .on(t.facilityTypeCode)
      .where(sql`${t.facilityTypeCode} IS NOT NULL`),
    index("facilities_unit_type_code_idx")
      .on(t.unitTypeCode)
      .where(sql`${t.unitTypeCode} IS NOT NULL`),
  ]
);

export const professionals = pgTable(
  "professionals",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    fullName: text("full_name"),
    socialName: text("social_name"),
    taxId: text("tax_id"),
    birthDate: timestamp("birth_date"),
    mobilePhone: text("mobile_phone"),
    landlinePhone: text("landline_phone"),
    email: text("email"),
    websiteUrl: text("website_url"),
    imageUrl: text("image_url"),
    favoriteTeam: text("favorite_team"),
    imageBlurhash: text("image_blurhash"),
    favoriteSport: text("favorite_sport"),
    /** Free-text languages spoken, e.g. "Português, Inglês". */
    languages: text("languages"),
    hobbies: text("hobbies"),
    primarySpecialtyLabel: text("primary_specialty_label"),
    /** Canonical CNES CBO for this person (FK deferred until occupations are seeded). */
    primaryOccupationCode: text("primary_occupation_code"),
    /** CNES CO_PROFISSIONAL_SUS for matching. */
    cnesProfessionalId: text("cnes_professional_id"),
    crmCouncil: text("crm_council"),
    crmNumber: text("crm_number"),
    crmState: text("crm_state"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("professionals_cnes_professional_id_uidx")
      .on(t.cnesProfessionalId)
      .where(sql`${t.cnesProfessionalId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    index("professionals_deleted_at_idx").on(t.deletedAt),
    index("professionals_last_name_first_name_idx").on(t.lastName, t.firstName),
    index("professionals_tax_id_idx").on(t.taxId),
    index("professionals_primary_occupation_code_idx")
      .on(t.primaryOccupationCode)
      .where(sql`${t.primaryOccupationCode} IS NOT NULL`),
    index("professionals_cnes_professional_id_idx")
      .on(t.cnesProfessionalId)
      .where(sql`${t.cnesProfessionalId} IS NOT NULL`),
  ]
);

export const professionalNotes = pgTable(
  "professional_notes",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" })
      .notNull().references(() => users.id, { onDelete: "cascade" }),
    professionalId: bigint("professional_id", { mode: "number" })
      .notNull().references(() => professionals.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("professional_notes_professional_id_user_id_created_at_idx").on(
      t.professionalId,
      t.userId,
      t.createdAt
    ),
    index("professional_notes_user_id_created_at_idx").on(t.userId, t.createdAt),
  ]
);

/**
 * Private facility-scoped field notes for the owning user only —
 * same privacy model as professional_notes (user × facility).
 */
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
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
 * Per-user relationship strength with a CRM professional (1–10).
 * Private to the owning user — same privacy model as professional_notes.
 * Not facility-scoped.
 */
export const userProfessionalRelationships = pgTable(
  "user_professional_relationships",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" })
      .notNull().references(() => users.id, { onDelete: "cascade" }),
    professionalId: bigint("professional_id", { mode: "number" })
      .notNull().references(() => professionals.id, { onDelete: "cascade" }),
    relationshipLevel: smallint("relationship_level").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_professional_relationships_user_id_professional_id_uidx").on(
      t.userId,
      t.professionalId
    ),
    index("user_professional_relationships_professional_id_idx").on(t.professionalId),
    index("user_professional_relationships_user_id_idx").on(t.userId),
  ]
);

export const facilityProfessionals = pgTable(
  "facility_professionals",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    professionalId: bigint("professional_id", { mode: "number" }).notNull().references(() => professionals.id, { onDelete: "cascade" }),
    facilityId: bigint("facility_id", { mode: "number" }).notNull().references(() => facilities.id, { onDelete: "cascade" }),
    /** App-level role (LEGACY / MED / …) — not CNES CBO. */
    occupationCode: text("occupation_code").notNull().default("LEGACY"),
    specialtyLabel: text("specialty_label"),
    employmentTypeCode: text("employment_type_code"),
    isPrescriber: boolean("is_prescriber").notNull().default(false),
    isBuyer: boolean("is_buyer").notNull().default(false),
    isDecisionMaker: boolean("is_decision_maker").notNull().default(false),
    isPartner: boolean("is_partner").notNull().default(false),
    notes: text("notes"),
    confirmedAt: timestamp("confirmed_at"),
    confirmedByUserId: bigint("confirmed_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    endedAt: timestamp("ended_at"),
    endedByUserId: bigint("ended_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    endReason: text("end_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("facility_professionals_facility_id_professional_id_occupation_code_uidx").on(
      t.facilityId,
      t.professionalId,
      t.occupationCode
    ),
    index("facility_professionals_professional_id_idx").on(t.professionalId),
    index("facility_professionals_facility_id_idx").on(t.facilityId),
    index("facility_professionals_facility_id_confirmed_at_ended_at_idx").on(
      t.facilityId,
      t.confirmedAt,
      t.endedAt
    ),
  ]
);

export const facilityRepresentatives = pgTable(
  "facility_representatives",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    facilityId: bigint("facility_id", { mode: "number" }).notNull().references(() => facilities.id, { onDelete: "cascade" }),
    representativeName: text("representative_name").notNull(),
    roleTitle: text("role_title"),
    email: text("email"),
    taxId: text("tax_id"),
    /** Legacy single label — derived from role flags on write for back-compat. */
    contactType: contactTypeEnum("contact_type").notNull().default("PROFESSIONAL"),
    phone: text("phone"),
    notes: text("notes"),
    isPartner: boolean("is_partner").notNull().default(false),
    isAdministrator: boolean("is_administrator").notNull().default(false),
    isDecisionMaker: boolean("is_decision_maker").notNull().default(false),
    isBuyer: boolean("is_buyer").notNull().default(false),
    isBiller: boolean("is_biller").notNull().default(false),
    isSecretary: boolean("is_secretary").notNull().default(false),
    confirmedAt: timestamp("confirmed_at"),
    confirmedByUserId: bigint("confirmed_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("facility_representatives_facility_id_idx").on(t.facilityId),
    index("facility_representatives_facility_id_ended_at_idx").on(t.facilityId, t.endedAt),
  ]
);

/**
 * Per-user relationship strength with a CRM facility representative (1–10).
 * Private to the owning user — mirrors user_professional_relationships.
 */
export const userRepresentativeRelationships = pgTable(
  "user_representative_relationships",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" })
      .notNull().references(() => users.id, { onDelete: "cascade" }),
    representativeId: bigint("representative_id", { mode: "number" })
      .notNull().references(() => facilityRepresentatives.id, { onDelete: "cascade" }),
    relationshipLevel: smallint("relationship_level").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_representative_relationships_user_id_representative_id_uidx").on(
      t.userId,
      t.representativeId
    ),
    index("user_representative_relationships_representative_id_idx").on(t.representativeId),
    index("user_representative_relationships_user_id_idx").on(t.userId),
  ]
);

export const facilityConsultantAssignments = pgTable(
  "facility_consultant_assignments",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    facilityId: bigint("facility_id", { mode: "number" }).notNull().references(() => facilities.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" })
      .notNull().references(() => users.id, { onDelete: "cascade" }),
    verticalId: bigint("vertical_id", { mode: "number" })
      .notNull().references(() => businessVerticals.id, { onDelete: "restrict" }),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
    assignedByUserId: bigint("assigned_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    endReason: text("end_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("facility_consultant_assignments_facility_id_idx").on(t.facilityId),
    index("facility_consultant_assignments_user_id_idx").on(t.userId),
    index("facility_consultant_assignments_vertical_id_idx").on(t.verticalId),
    index("facility_consultant_assignments_facility_id_ended_at_idx").on(t.facilityId, t.endedAt),
    uniqueIndex("facility_consultant_assignments_facility_vertical_active_uidx")
      .on(t.facilityId, t.verticalId)
      .where(sql`${t.endedAt} IS NULL`),
  ]
);

/**
 * Vertical-specific commercial + purchase-funnel profile for a facility.
 * Funnel/recurrence is computed from orders of this verticalId only.
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
    managerZoneId: bigint("manager_zone_id", { mode: "number" }).references(() => territories.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").notNull().default(true),
    commercialStatus: commercialStatusEnum("commercial_status")
      .notNull()
      .default("UNREGISTERED"),
    purchaseStatus: purchaseStatusEnum("purchase_status")
      .notNull()
      .default("NON_BUYER"),
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
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("facility_vertical_profiles_facility_id_vertical_id_uidx").on(
      t.facilityId,
      t.verticalId
    ),
    index("facility_vertical_profiles_facility_id_idx").on(t.facilityId),
    index("facility_vertical_profiles_vertical_id_idx").on(t.verticalId),
    index("facility_vertical_profiles_manager_zone_id_idx").on(t.managerZoneId),
    index("facility_vertical_profiles_commercial_status_idx").on(t.commercialStatus),
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

export const healthcareProviders = pgTable(
  "healthcare_providers",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    type: healthcareProviderTypeEnum("type").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("healthcare_providers_is_active_idx").on(t.isActive)]
);

export const facilityHealthcareProviderShares = pgTable(
  "facility_healthcare_provider_shares",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    facilityId: bigint("facility_id", { mode: "number" }).notNull().references(() => facilities.id, { onDelete: "cascade" }),
    healthcareProviderId: bigint("healthcare_provider_id", { mode: "number" }).notNull().references(() => healthcareProviders.id, { onDelete: "restrict" }),
    sharePercent: text("share_percent").notNull(),
    /** Whether this facility treats the provider share as a package (pacote). */
    isPackage: boolean("is_package").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("facility_healthcare_provider_shares_facility_id_provider_id_uidx").on(
      t.facilityId,
      t.healthcareProviderId
    ),
    index("facility_healthcare_provider_shares_facility_id_idx").on(t.facilityId),
    index("facility_healthcare_provider_shares_healthcare_provider_id_idx").on(t.healthcareProviderId),
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  facilityType: one(facilityTypes, {
    fields: [facilities.facilityTypeCode],
    references: [facilityTypes.facilityTypeCode],
  }),
  unitTypeRef: one(unitTypes, {
    fields: [facilities.unitTypeCode],
    references: [unitTypes.unitTypeCode],
  }),
  deactivationReason: one(deactivationReasons, {
    fields: [facilities.registryDeactivationCode],
    references: [deactivationReasons.deactivationCode],
  }),
  verticalProfiles: many(facilityVerticalProfiles),
  professionalAssociations: many(facilityProfessionals),
  representatives: many(facilityRepresentatives),
  consultantAssignments: many(facilityConsultantAssignments),
  healthcareProviderShares: many(facilityHealthcareProviderShares),
  conformityRecords: many(conformityRecords),
  clinicalFocusLinks: many(facilityClinicalFocuses),
  notes: many(facilityNotes),
  photos: many(facilityPhotos),
}));

export const facilityVerticalProfilesRelations = relations(
  facilityVerticalProfiles,
  ({ one }) => ({
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
  })
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

export const professionalsRelations = relations(professionals, ({ one, many }) => ({
  primaryOccupation: one(occupations, {
    fields: [professionals.primaryOccupationCode],
    references: [occupations.occupationCode],
  }),
  facilityAssociations: many(facilityProfessionals),
  notes: many(professionalNotes),
  userRelationships: many(userProfessionalRelationships),
}));

export const professionalNotesRelations = relations(professionalNotes, ({ one }) => ({
  user: one(users, { fields: [professionalNotes.userId], references: [users.id] }),
  professional: one(professionals, {
    fields: [professionalNotes.professionalId],
    references: [professionals.id],
  }),
}));

export const facilityNotesRelations = relations(facilityNotes, ({ one }) => ({
  user: one(users, { fields: [facilityNotes.userId], references: [users.id] }),
  facility: one(facilities, {
    fields: [facilityNotes.facilityId],
    references: [facilities.id],
  }),
}));

export const userProfessionalRelationshipsRelations = relations(
  userProfessionalRelationships,
  ({ one }) => ({
    user: one(users, {
      fields: [userProfessionalRelationships.userId],
      references: [users.id],
    }),
    professional: one(professionals, {
      fields: [userProfessionalRelationships.professionalId],
      references: [professionals.id],
    }),
  })
);

export const facilityProfessionalsRelations = relations(facilityProfessionals, ({ one }) => ({
  professional: one(professionals, { fields: [facilityProfessionals.professionalId], references: [professionals.id] }),
  facility: one(facilities, { fields: [facilityProfessionals.facilityId], references: [facilities.id] }),
  confirmedBy: one(users, {
    fields: [facilityProfessionals.confirmedByUserId],
    references: [users.id],
    relationName: "FacilityProfessionalConfirmedBy",
  }),
  endedBy: one(users, {
    fields: [facilityProfessionals.endedByUserId],
    references: [users.id],
    relationName: "FacilityProfessionalEndedBy",
  }),
}));

export const facilityRepresentativesRelations = relations(facilityRepresentatives, ({ one, many }) => ({
  facility: one(facilities, { fields: [facilityRepresentatives.facilityId], references: [facilities.id] }),
  confirmedBy: one(users, {
    fields: [facilityRepresentatives.confirmedByUserId],
    references: [users.id],
  }),
  userRelationships: many(userRepresentativeRelationships),
}));

export const userRepresentativeRelationshipsRelations = relations(
  userRepresentativeRelationships,
  ({ one }) => ({
    user: one(users, {
      fields: [userRepresentativeRelationships.userId],
      references: [users.id],
    }),
    representative: one(facilityRepresentatives, {
      fields: [userRepresentativeRelationships.representativeId],
      references: [facilityRepresentatives.id],
    }),
  })
);

export const facilityConsultantAssignmentsRelations = relations(facilityConsultantAssignments, ({ one }) => ({
  facility: one(facilities, { fields: [facilityConsultantAssignments.facilityId], references: [facilities.id] }),
  vertical: one(businessVerticals, {
    fields: [facilityConsultantAssignments.verticalId],
    references: [businessVerticals.id],
  }),
  user: one(users, {
    fields: [facilityConsultantAssignments.userId],
    references: [users.id],
    relationName: "FacilityConsultantUser",
  }),
  assignedBy: one(users, {
    fields: [facilityConsultantAssignments.assignedByUserId],
    references: [users.id],
    relationName: "FacilityConsultantAssignedBy",
  }),
}));

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
