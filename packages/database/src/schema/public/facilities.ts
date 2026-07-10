import {
  pgTable,
  text,
  boolean,
  timestamp,
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
  relationshipLevelEnum,
  healthcareProviderTypeEnum,
  healthcareProviderShareSourceEnum,
  conformityRecordStatusEnum,
  territoryAssignmentStatusEnum,
  territoryAssignmentSourceEnum,
} from "./enums";
import { territories } from "./territories";

export const sectors = pgTable(
  "sectors",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [index("sectors_isActive_idx").on(t.isActive)]
);

export const facilities = pgTable(
  "facilities",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    displayName: text("name").notNull(),
    address: text("address"),
    location: geometryPoint("location"),
    cnesCode: text("cnes_code"),
    legalName: text("legal_name"),
    tradeName: text("trade_name"),
    streetAddress: text("street_address"),
    streetNumber: text("street_number"),
    addressComplement: text("address_complement"),
    neighborhood: text("neighborhood"),
    postalCode: text("postal_code"),
    phoneNumber: text("phone_number"),
    faxNumber: text("fax_number"),
    email: text("email"),
    websiteUrl: text("website_url"),
    taxIdCnpj: text("tax_id_cnpj"),
    taxIdCpf: text("tax_id_cpf"),
    ownerTaxId: text("owner_tax_id"),
    facilityTypeCode: text("facility_type_code"),
    registryDeactivationCode: text("registry_deactivation_code"),
    isActiveInRegistry: boolean("is_active_in_registry").notNull().default(true),
    referenceMunicipalityCode: text("reference_municipality_code"),
    conformityStatus: conformityStatusEnum("conformityStatus").notNull().default("INCOMPLETE"),
    commercialStatus: commercialStatusEnum("commercial_status"),
    purchaseStatus: purchaseStatusEnum("purchase_status"),
    city: text("city"),
    stateCode: text("state_code"),
    primarySectorId: text("primary_sector_id").references(() => sectors.id, { onDelete: "set null" }),
    imageUrl: text("image_url"),
    territoryId: text("territoryId").references(() => territories.id, { onDelete: "set null" }),
    territoryAssignmentStatus: territoryAssignmentStatusEnum("territoryAssignmentStatus").notNull().default("unassigned"),
    territoryAssignmentSource: territoryAssignmentSourceEnum("territoryAssignmentSource").notNull().default("geo"),
    sourceProvider: text("sourceProvider"),
    externalSourceId: text("externalSourceId"),
    sourceContentHash: text("sourceContentHash"),
    sourceFirstSeenAt: timestamp("sourceFirstSeenAt"),
    sourceLastSeenAt: timestamp("sourceLastSeenAt"),
    sourcePresent: boolean("sourcePresent").notNull().default(false),
    sourceTracked: boolean("sourceTracked").notNull().default(false),
    manuallyEditedAt: timestamp("manuallyEditedAt"),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("facilities_sourceProvider_externalSourceId_uidx").on(t.sourceProvider, t.externalSourceId),
    uniqueIndex("facilities_sourceProvider_cnesCode_uidx").on(t.sourceProvider, t.cnesCode),
    index("facilities_territoryId_idx").on(t.territoryId),
    index("facilities_deletedAt_idx").on(t.deletedAt),
    index("facilities_displayName_idx").on(t.displayName),
    index("facilities_sourceProvider_sourcePresent_idx").on(t.sourceProvider, t.sourcePresent),
    index("facilities_territoryAssignmentStatus_idx").on(t.territoryAssignmentStatus),
    index("facilities_primarySectorId_idx").on(t.primarySectorId),
    index("facilities_conformityStatus_idx").on(t.conformityStatus),
  ]
);

export const professionals = pgTable(
  "professionals",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    firstName: text("firstName").notNull(),
    lastName: text("lastName").notNull(),
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
    favoriteSport: text("favorite_sport"),
    hobbies: text("hobbies"),
    notes: text("notes"),
    primarySpecialtyLabel: text("primary_specialty_label"),
    crmCouncil: text("crm_council"),
    crmNumber: text("crm_number"),
    crmState: text("crm_state"),
    sourceProvider: text("sourceProvider"),
    externalSourceId: text("externalSourceId"),
    sourceContentHash: text("sourceContentHash"),
    sourceFirstSeenAt: timestamp("sourceFirstSeenAt"),
    sourceLastSeenAt: timestamp("sourceLastSeenAt"),
    sourcePresent: boolean("sourcePresent").notNull().default(false),
    sourceTracked: boolean("sourceTracked").notNull().default(false),
    manuallyEditedAt: timestamp("manuallyEditedAt"),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("professionals_sourceProvider_externalSourceId_uidx").on(t.sourceProvider, t.externalSourceId),
    index("professionals_deletedAt_idx").on(t.deletedAt),
    index("professionals_lastName_firstName_idx").on(t.lastName, t.firstName),
    index("professionals_sourceProvider_sourcePresent_idx").on(t.sourceProvider, t.sourcePresent),
    index("professionals_taxId_idx").on(t.taxId),
  ]
);

export const facilityProfessionals = pgTable(
  "facility_professionals",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    professionalId: text("professionalId").notNull().references(() => professionals.id, { onDelete: "cascade" }),
    facilityId: text("facilityId").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    occupationCode: text("occupation_code").notNull().default("LEGACY"),
    specialtyLabel: text("specialty_label"),
    employmentTypeCode: text("employment_type_code"),
    sourceOccupationCode: text("source_occupation_code"),
    isPrescriber: boolean("is_prescriber").notNull().default(false),
    isBuyer: boolean("is_buyer").notNull().default(false),
    isDecisionMaker: boolean("is_decision_maker").notNull().default(false),
    isPartner: boolean("is_partner").notNull().default(false),
    relationshipLevel: relationshipLevelEnum("relationship_level"),
    notes: text("notes"),
    sourceActive: boolean("sourceActive").notNull().default(false),
    sourceFirstSeenAt: timestamp("sourceFirstSeenAt"),
    sourceLastSeenAt: timestamp("sourceLastSeenAt"),
    confirmedAt: timestamp("confirmedAt"),
    confirmedByUserId: text("confirmedByUserId"),
    endedAt: timestamp("endedAt"),
    endedByUserId: text("endedByUserId"),
    endReason: text("endReason"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("facility_professionals_facilityId_professionalId_occupationCode_uidx").on(
      t.facilityId,
      t.professionalId,
      t.occupationCode
    ),
    index("facility_professionals_professionalId_idx").on(t.professionalId),
    index("facility_professionals_facilityId_idx").on(t.facilityId),
    index("facility_professionals_facilityId_sourceActive_endedAt_idx").on(
      t.facilityId,
      t.sourceActive,
      t.endedAt
    ),
    index("facility_professionals_facilityId_confirmedAt_endedAt_idx").on(
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
    facilityId: text("facilityId").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    representativeName: text("representative_name").notNull(),
    roleTitle: text("role_title"),
    email: text("email"),
    taxId: text("tax_id"),
    contactType: contactTypeEnum("contact_type").notNull().default("PROFESSIONAL"),
    relationshipLevel: text("relationship_level"),
    phone: text("phone"),
    notes: text("notes"),
    sourceProvider: text("source_provider"),
    externalSourceKey: text("external_source_key"),
    sourceActive: boolean("source_active").notNull().default(false),
    confirmedAt: timestamp("confirmed_at"),
    confirmedByUserId: text("confirmed_by_user_id"),
    endedAt: timestamp("ended_at"),
    manuallyEditedAt: timestamp("manually_edited_at"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("facility_representatives_facilityId_externalSourceKey_uidx").on(
      t.facilityId,
      t.externalSourceKey
    ),
    index("facility_representatives_facilityId_idx").on(t.facilityId),
    index("facility_representatives_facilityId_sourceActive_endedAt_idx").on(
      t.facilityId,
      t.sourceActive,
      t.endedAt
    ),
  ]
);

export const facilityConsultantAssignments = pgTable(
  "facility_consultant_assignments",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    facilityId: text("facilityId").notNull().references(() => facilities.id, { onDelete: "cascade" }),
    userId: text("userId").notNull(),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
    assignedByUserId: text("assigned_by_user_id"),
    endReason: text("end_reason"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    index("facility_consultant_assignments_facilityId_idx").on(t.facilityId),
    index("facility_consultant_assignments_userId_idx").on(t.userId),
    index("facility_consultant_assignments_facilityId_endedAt_idx").on(t.facilityId, t.endedAt),
  ]
);

export const healthcareProviders = pgTable(
  "healthcare_providers",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    name: text("name").notNull(),
    type: healthcareProviderTypeEnum("type").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [index("healthcare_providers_isActive_idx").on(t.isActive)]
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
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("facility_healthcare_provider_shares_facilityId_providerId_uidx").on(
      t.facilityId,
      t.healthcareProviderId
    ),
    index("facility_healthcare_provider_shares_facilityId_idx").on(t.facilityId),
    index("facility_healthcare_provider_shares_healthcareProviderId_idx").on(t.healthcareProviderId),
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
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    index("conformity_requirements_sectorId_idx").on(t.sectorId),
    index("conformity_requirements_isActive_idx").on(t.isActive),
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
    validatedByUserId: text("validated_by_user_id"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("conformity_records_facilityId_requirementId_uidx").on(t.facilityId, t.requirementId),
    index("conformity_records_facilityId_idx").on(t.facilityId),
    index("conformity_records_requirementId_idx").on(t.requirementId),
    index("conformity_records_status_idx").on(t.status),
  ]
);

// --- Relations ---

export const sectorsRelations = relations(sectors, ({ many }) => ({
  facilities: many(facilities),
  conformityRequirements: many(conformityRequirements),
}));

export const facilitiesRelations = relations(facilities, ({ one, many }) => ({
  territory: one(territories, { fields: [facilities.territoryId], references: [territories.id] }),
  primarySector: one(sectors, { fields: [facilities.primarySectorId], references: [sectors.id] }),
  professionalAssociations: many(facilityProfessionals),
  representatives: many(facilityRepresentatives),
  consultantAssignments: many(facilityConsultantAssignments),
  healthcareProviderShares: many(facilityHealthcareProviderShares),
  conformityRecords: many(conformityRecords),
}));

export const professionalsRelations = relations(professionals, ({ many }) => ({
  facilityAssociations: many(facilityProfessionals),
}));

export const facilityProfessionalsRelations = relations(facilityProfessionals, ({ one }) => ({
  professional: one(professionals, { fields: [facilityProfessionals.professionalId], references: [professionals.id] }),
  facility: one(facilities, { fields: [facilityProfessionals.facilityId], references: [facilities.id] }),
}));

export const facilityRepresentativesRelations = relations(facilityRepresentatives, ({ one }) => ({
  facility: one(facilities, { fields: [facilityRepresentatives.facilityId], references: [facilities.id] }),
}));

export const facilityConsultantAssignmentsRelations = relations(facilityConsultantAssignments, ({ one }) => ({
  facility: one(facilities, { fields: [facilityConsultantAssignments.facilityId], references: [facilities.id] }),
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
}));
