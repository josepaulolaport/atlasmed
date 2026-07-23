import {
  pgTable,
  text,
  boolean,
  timestamp,
  smallint,
  integer,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { geometryPoint } from "../../types/geometry";
import {
  conformityStatusEnum,
  commercialStatusEnum,
  purchaseStatusEnum,
  contactTypeEnum,
  healthcareProviderTypeEnum,
  healthcareProviderShareSourceEnum,
  conformityRecordStatusEnum,
  territoryAssignmentStatusEnum,
  territoryAssignmentSourceEnum,
  facilityTaxIdTypeEnum,
} from "./enums";
import { territories } from "./territories";
import { sectors } from "./sectors";
import { users } from "./users";

export { sectors } from "./sectors";

export const facilities = pgTable(
  "facilities",
  {
    // --- Identity ---
    id: text("id").primaryKey().$defaultFn(() => createId()),
    displayName: text("name").notNull(),
    legalName: text("legal_name"),
    tradeName: text("trade_name"),

    // --- Registry provenance ---
    cnesCode: text("cnes_code"),
    facilityTypeCode: text("facility_type_code"),
    isActiveInRegistry: boolean("is_active_in_registry").notNull().default(true),
    registryDeactivationCode: text("registry_deactivation_code"),

    // --- Tax identifiers ---
    taxIdType: facilityTaxIdTypeEnum("tax_id_type").notNull().default("PJ"),
    cnpj: text("cnpj"),
    cpf: text("cpf"),

    // --- Address ---
    country: text("country"),
    state: text("state"),
    city: text("city"),
    neighborhood: text("neighborhood"),
    streetAddress: text("street_address"),
    streetNumber: text("street_number"),
    addressComplement: text("address_complement"),
    postalCode: text("postal_code"),
    location: geometryPoint("location"),

    // --- Contact ---
    phoneNumber: text("phone_number"),
    whatsappNumber: text("whatsapp_number"),
    faxNumber: text("fax_number"),
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
    primarySectorId: text("primary_sector_id").references(() => sectors.id, { onDelete: "set null" }),
    conformityStatus: conformityStatusEnum("conformity_status").notNull().default("INCOMPLETE"),
    commercialStatus: commercialStatusEnum("commercial_status"),
    purchaseStatus: purchaseStatusEnum("purchase_status"),
    imageUrl: text("image_url"),
    unitType: text("unit_type"),
    unitSubtype: text("unit_subtype"),

    // --- Territory ---
    territoryId: text("territory_id").references(() => territories.id, { onDelete: "set null" }),
    territoryAssignmentStatus: territoryAssignmentStatusEnum("territory_assignment_status").notNull().default("unassigned"),
    territoryAssignmentSource: territoryAssignmentSourceEnum("territory_assignment_source").notNull().default("geo"),

    // --- Source tracking ---
    sourceProvider: text("source_provider"),
    externalSourceId: text("external_source_id"),
    sourceContentHash: text("source_content_hash"),
    sourceFirstSeenAt: timestamp("source_first_seen_at"),
    sourceLastSeenAt: timestamp("source_last_seen_at"),
    sourcePresent: boolean("source_present").notNull().default(false),
    sourceTracked: boolean("source_tracked").notNull().default(false),

    // --- Lifecycle ---
    manuallyEditedAt: timestamp("manually_edited_at"),
    deactivatedAt: timestamp("deactivated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("facilities_source_provider_external_source_id_uidx").on(t.sourceProvider, t.externalSourceId),
    uniqueIndex("facilities_source_provider_cnes_code_uidx").on(t.sourceProvider, t.cnesCode),
    index("facilities_territory_id_idx").on(t.territoryId),
    index("facilities_deactivated_at_idx").on(t.deactivatedAt),
    index("facilities_name_idx").on(t.displayName),
    index("facilities_source_provider_source_present_idx").on(t.sourceProvider, t.sourcePresent),
    index("facilities_territory_assignment_status_idx").on(t.territoryAssignmentStatus),
    index("facilities_primary_sector_id_idx").on(t.primarySectorId),
    index("facilities_conformity_status_idx").on(t.conformityStatus),
  ]
);

export const professionals = pgTable(
  "professionals",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    fullName: text("full_name"),
    socialName: text("social_name"),
    taxId: text("tax_id"),
    birthDate: timestamp("birth_date"),
    mobilePhone: text("mobile_phone"),
    whatsappNumber: text("whatsapp_number"),
    landlinePhone: text("landline_phone"),
    email: text("email"),
    websiteUrl: text("website_url"),
    imageUrl: text("image_url"),
    faculty: text("faculty"),
    residency: text("residency"),
    languages: text("languages"),
    favoriteTeam: text("favorite_team"),
    favoriteSport: text("favorite_sport"),
    hobbies: text("hobbies"),
    notes: text("notes"),
    primarySpecialtyLabel: text("primary_specialty_label"),
    crmCouncil: text("crm_council"),
    crmNumber: text("crm_number"),
    crmState: text("crm_state"),
    sourceProvider: text("source_provider"),
    externalSourceId: text("external_source_id"),
    sourceContentHash: text("source_content_hash"),
    sourceFirstSeenAt: timestamp("source_first_seen_at"),
    sourceLastSeenAt: timestamp("source_last_seen_at"),
    sourcePresent: boolean("source_present").notNull().default(false),
    sourceTracked: boolean("source_tracked").notNull().default(false),
    manuallyEditedAt: timestamp("manually_edited_at"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("professionals_source_provider_external_source_id_uidx").on(t.sourceProvider, t.externalSourceId),
    index("professionals_deleted_at_idx").on(t.deletedAt),
    index("professionals_last_name_first_name_idx").on(t.lastName, t.firstName),
    index("professionals_source_provider_source_present_idx").on(t.sourceProvider, t.sourcePresent),
    index("professionals_tax_id_idx").on(t.taxId),
  ]
);

export const professionalNotes = pgTable(
  "professional_notes",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    professionalId: text("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
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
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    facilityId: text("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
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
    id: text("id").primaryKey().$defaultFn(() => createId()),
    facilityId: text("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    url: text("url").notNull(),
    contentType: text("content_type").notNull(),
    uploadedByUserId: text("uploaded_by_user_id").references(() => users.id, {
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
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    professionalId: text("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
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
    id: text("id").primaryKey().$defaultFn(() => createId()),
    professionalId: text("professional_id").notNull().references(() => professionals.id, { onDelete: "cascade" }),
    facilityId: text("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    occupationCode: text("occupation_code").notNull().default("LEGACY"),
    specialtyLabel: text("specialty_label"),
    employmentTypeCode: text("employment_type_code"),
    sourceOccupationCode: text("source_occupation_code"),
    isPrescriber: boolean("is_prescriber").notNull().default(false),
    isBuyer: boolean("is_buyer").notNull().default(false),
    isDecisionMaker: boolean("is_decision_maker").notNull().default(false),
    isPartner: boolean("is_partner").notNull().default(false),
    notes: text("notes"),
    sourceActive: boolean("source_active").notNull().default(false),
    sourceFirstSeenAt: timestamp("source_first_seen_at"),
    sourceLastSeenAt: timestamp("source_last_seen_at"),
    confirmedAt: timestamp("confirmed_at"),
    confirmedByUserId: text("confirmed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    endedAt: timestamp("ended_at"),
    endedByUserId: text("ended_by_user_id").references(() => users.id, {
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
    index("facility_professionals_facility_id_source_active_ended_at_idx").on(
      t.facilityId,
      t.sourceActive,
      t.endedAt
    ),
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
    id: text("id").primaryKey().$defaultFn(() => createId()),
    facilityId: text("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
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
    sourceProvider: text("source_provider"),
    externalSourceKey: text("external_source_key"),
    sourceActive: boolean("source_active").notNull().default(false),
    confirmedAt: timestamp("confirmed_at"),
    confirmedByUserId: text("confirmed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    endedAt: timestamp("ended_at"),
    manuallyEditedAt: timestamp("manually_edited_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("facility_representatives_facility_id_external_source_key_uidx").on(
      t.facilityId,
      t.externalSourceKey
    ),
    index("facility_representatives_facility_id_idx").on(t.facilityId),
    index("facility_representatives_facility_id_source_active_ended_at_idx").on(
      t.facilityId,
      t.sourceActive,
      t.endedAt
    ),
  ]
);

/**
 * Per-user relationship strength with a CRM facility representative (1–10).
 * Private to the owning user — mirrors user_professional_relationships.
 */
export const userRepresentativeRelationships = pgTable(
  "user_representative_relationships",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    representativeId: text("representative_id")
      .notNull()
      .references(() => facilityRepresentatives.id, { onDelete: "cascade" }),
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
    id: text("id").primaryKey().$defaultFn(() => createId()),
    facilityId: text("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
    assignedByUserId: text("assigned_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    endReason: text("end_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("facility_consultant_assignments_facility_id_idx").on(t.facilityId),
    index("facility_consultant_assignments_user_id_idx").on(t.userId),
    index("facility_consultant_assignments_facility_id_ended_at_idx").on(t.facilityId, t.endedAt),
  ]
);

export const healthcareProviders = pgTable(
  "healthcare_providers",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
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
    id: text("id").primaryKey().$defaultFn(() => createId()),
    facilityId: text("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    healthcareProviderId: text("healthcare_provider_id").notNull().references(() => healthcareProviders.id, { onDelete: "restrict" }),
    sharePercent: text("share_percent").notNull(),
    source: healthcareProviderShareSourceEnum("source").notNull().default("MANUAL"),
    sourceFirstSeenAt: timestamp("source_first_seen_at"),
    sourceLastSeenAt: timestamp("source_last_seen_at"),
    manuallyEditedAt: timestamp("manually_edited_at"),
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
    id: text("id").primaryKey().$defaultFn(() => createId()),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    sectorId: text("sector_id").references(() => sectors.id, { onDelete: "set null" }),
    /** When set, requirement applies only to facilities with this tax id type. */
    appliesToTaxIdType: facilityTaxIdTypeEnum("applies_to_tax_id_type"),
    isActive: boolean("is_active").notNull().default(true),
    /** Per-document-type upload limits (cadastro multi-file). */
    allowedMimeTypes: text("allowed_mime_types")
      .array()
      .notNull()
      .default(["image/jpeg", "image/png", "application/pdf"]),
    maxFiles: integer("max_files").notNull().default(10),
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
    index("conformity_requirements_sector_id_idx").on(t.sectorId),
    index("conformity_requirements_is_active_idx").on(t.isActive),
    index("conformity_requirements_applies_to_tax_id_type_idx").on(t.appliesToTaxIdType),
  ]
);

export const conformityRecords = pgTable(
  "conformity_records",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    facilityId: text("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    requirementId: text("requirement_id").notNull().references(() => conformityRequirements.id, { onDelete: "restrict" }),
    status: conformityRecordStatusEnum("status").notNull().default("PENDING"),
    submittedAt: timestamp("submitted_at"),
    validatedAt: timestamp("validated_at"),
    expiresAt: timestamp("expires_at"),
    validatedByUserId: text("validated_by_user_id").references(() => users.id, {
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

/**
 * Healthcare services offered by a facility, sourced from CNES rlEstabServClass.
 * Synced from registry.facility_services during ingestion reconciliation.
 */
export const facilityServices = pgTable(
  "facility_services",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    facilityId: text("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    serviceCode: text("service_code").notNull(),
    classificationCode: text("classification_code").notNull(),
    sourceProvider: text("source_provider").notNull().default("cnes"),
    sourceFirstSeenAt: timestamp("source_first_seen_at"),
    sourceLastSeenAt: timestamp("source_last_seen_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("facility_services_facility_id_service_code_classification_code_uidx").on(
      t.facilityId,
      t.serviceCode,
      t.classificationCode
    ),
    index("facility_services_facility_id_idx").on(t.facilityId),
    index("facility_services_service_code_idx").on(t.serviceCode),
  ]
);

// --- Relations ---

export const facilitiesRelations = relations(facilities, ({ one, many }) => ({
  territory: one(territories, { fields: [facilities.territoryId], references: [territories.id] }),
  primarySector: one(sectors, { fields: [facilities.primarySectorId], references: [sectors.id] }),
  professionalAssociations: many(facilityProfessionals),
  representatives: many(facilityRepresentatives),
  consultantAssignments: many(facilityConsultantAssignments),
  healthcareProviderShares: many(facilityHealthcareProviderShares),
  conformityRecords: many(conformityRecords),
  services: many(facilityServices),
  notes: many(facilityNotes),
  photos: many(facilityPhotos),
}));

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

export const facilityServicesRelations = relations(facilityServices, ({ one }) => ({
  facility: one(facilities, { fields: [facilityServices.facilityId], references: [facilities.id] }),
}));

export const professionalsRelations = relations(professionals, ({ many }) => ({
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
  sector: one(sectors, { fields: [conformityRequirements.sectorId], references: [sectors.id] }),
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
