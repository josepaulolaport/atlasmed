import {
  pgTable,
  text,
  boolean,
  timestamp,
  date,
  char,
  smallint,
  bigint,
  index,
  uniqueIndex,
  unique,
  check,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users } from "./users";
import { facilities } from "./facilities";
import { occupations } from "./cnes-lookups";

/** One real-world human (external CRM person — not an auth user). */
export const persons = pgTable(
  "persons",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    socialName: text("social_name"),
    cpf: char("cpf", { length: 11 }),
    birthDate: date("birth_date"),
    mobilePhone: text("mobile_phone"),
    landlinePhone: text("landline_phone"),
    email: text("email"),
    websiteUrl: text("website_url"),
    imageUrl: text("image_url"),
    imageBlurhash: text("image_blurhash"),
    favoriteTeam: text("favorite_team"),
    favoriteSport: text("favorite_sport"),
    languages: text("languages"),
    hobbies: text("hobbies"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("persons_last_name_first_name_idx").on(t.lastName, t.firstName),
    index("persons_deleted_at_idx").on(t.deletedAt),
    index("persons_mobile_phone_idx").on(t.mobilePhone),
    index("persons_email_idx").on(t.email),
    uniqueIndex("persons_cpf_active_uidx")
      .on(t.cpf)
      .where(sql`${t.cpf} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    check(
      "persons_cpf_digits_check",
      sql`${t.cpf} IS NULL OR ${t.cpf} ~ '^[0-9]{11}$'`
    ),
  ]
);

export const personHealthcareProfiles = pgTable(
  "person_healthcare_profiles",
  {
    personId: bigint("person_id", { mode: "number" })
      .primaryKey()
      .references(() => persons.id, { onDelete: "cascade" }),
    cnesProfessionalId: text("cnes_professional_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("person_healthcare_profiles_cnes_professional_id_uidx")
      .on(t.cnesProfessionalId)
      .where(sql`${t.cnesProfessionalId} IS NOT NULL`),
  ]
);

export const healthcareSpecialties = pgTable(
  "healthcare_specialties",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    cnesId: bigint("cnes_id", { mode: "number" }).notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [unique("healthcare_specialties_cnes_id_key").on(t.cnesId)]
);

export const personHealthcareProfileSpecialties = pgTable(
  "person_healthcare_profile_specialties",
  {
    personId: bigint("person_id", { mode: "number" })
      .notNull()
      .references(() => personHealthcareProfiles.personId, { onDelete: "cascade" }),
    specialtyId: bigint("specialty_id", { mode: "number" })
      .notNull()
      .references(() => healthcareSpecialties.id, { onDelete: "restrict" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      name: "person_healthcare_profile_specialties_pkey",
      columns: [t.personId, t.specialtyId],
    }),
    uniqueIndex("person_healthcare_profile_specialties_primary_uidx")
      .on(t.personId)
      .where(sql`${t.isPrimary}`),
  ]
);

export const personProfessionalRegistrationCouncils = pgTable(
  "person_professional_registration_councils",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    abbreviation: text("abbreviation").notNull().unique(),
    cnesId: text("cnes_id").unique(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  }
);

export const personProfessionalRegistrations = pgTable(
  "person_professional_registrations",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    personId: bigint("person_id", { mode: "number" })
      .notNull()
      .references(() => personHealthcareProfiles.personId, { onDelete: "cascade" }),
    councilId: bigint("council_id", { mode: "number" })
      .notNull()
      .references(() => personProfessionalRegistrationCouncils.id, { onDelete: "restrict" }),
    stateCode: char("state_code", { length: 2 }).notNull(),
    registrationNumber: text("registration_number").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("person_professional_registrations_person_id_idx").on(t.personId),
    unique("person_professional_registrations_council_state_number_key").on(
      t.councilId,
      t.stateCode,
      t.registrationNumber
    ),
    uniqueIndex("person_professional_registrations_primary_uidx")
      .on(t.personId)
      .where(sql`${t.isPrimary}`),
  ]
);

export const personFacilities = pgTable(
  "person_facilities",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    personId: bigint("person_id", { mode: "number" })
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    facilityId: bigint("facility_id", { mode: "number" })
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    roleTitle: text("role_title"),
    notes: text("notes"),
    confirmedAt: timestamp("confirmed_at"),
    confirmedByUserId: bigint("confirmed_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    endedAt: timestamp("ended_at"),
    endedByUserId: bigint("ended_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("person_facilities_person_id_idx").on(t.personId),
    index("person_facilities_facility_id_idx").on(t.facilityId),
    uniqueIndex("person_facilities_active_facility_person_uidx")
      .on(t.facilityId, t.personId)
      .where(sql`${t.endedAt} IS NULL`),
    check(
      "person_facilities_ended_pair_check",
      sql`(${t.endedAt} IS NULL) = (${t.endedByUserId} IS NULL)`
    ),
  ]
);

/**
 * Person×facility classification catalog (occupation-shaped: bigint id + stable code).
 * Seed: HEALTHCARE_PROFESSIONAL, ADMINISTRATIVE_CONTACT.
 */
export const personFacilityClassifications = pgTable(
  "person_facility_classifications",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [unique("person_facility_classifications_code_key").on(t.code)]
);

export const personFacilityClassificationAssignments = pgTable(
  "person_facility_classification_assignments",
  {
    personFacilityId: bigint("person_facility_id", { mode: "number" })
      .notNull()
      .references(() => personFacilities.id, { onDelete: "cascade" }),
    classificationId: bigint("classification_id", { mode: "number" })
      .notNull()
      .references(() => personFacilityClassifications.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      name: "person_facility_classification_assignments_pkey",
      columns: [t.personFacilityId, t.classificationId],
    }),
  ]
);

/**
 * Person×facility role catalog — admin-dynamic (no seed, no machine code).
 * UNIQUE on lower(trim(name)) so duplicate labels cannot accumulate.
 */
export const personFacilityRoles = pgTable(
  "person_facility_roles",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("person_facility_roles_name_normalized_uidx").on(
      sql`lower(trim(${t.name}))`
    ),
  ]
);

export const personFacilityRoleAssignments = pgTable(
  "person_facility_role_assignments",
  {
    personFacilityId: bigint("person_facility_id", { mode: "number" })
      .notNull()
      .references(() => personFacilities.id, { onDelete: "cascade" }),
    roleId: bigint("role_id", { mode: "number" })
      .notNull()
      .references(() => personFacilityRoles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      name: "person_facility_role_assignments_pkey",
      columns: [t.personFacilityId, t.roleId],
    }),
  ]
);

export const personFacilityOccupations = pgTable(
  "person_facility_occupations",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    personFacilityId: bigint("person_facility_id", { mode: "number" })
      .notNull()
      .references(() => personFacilities.id, { onDelete: "cascade" }),
    occupationId: bigint("occupation_id", { mode: "number" })
      .notNull()
      .references(() => occupations.id, { onDelete: "restrict" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    unique("person_facility_occupations_person_facility_occupation_key").on(
      t.personFacilityId,
      t.occupationId
    ),
    /**
     * At most one primary occupation per association, matching the identical
     * guards already on `person_professional_registrations` and
     * `person_healthcare_profile_specialties`. Without it this was the only one of
     * the three `is_primary` groups where the "exactly one primary" rule lived
     * solely in application code.
     */
    uniqueIndex("person_facility_occupations_primary_uidx")
      .on(t.personFacilityId)
      .where(sql`${t.isPrimary}`),
    index("person_facility_occupations_person_facility_id_idx").on(t.personFacilityId),
    index("person_facility_occupations_occupation_id_idx").on(t.occupationId),
  ]
);

export const personNotes = pgTable(
  "person_notes",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    personId: bigint("person_id", { mode: "number" })
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("person_notes_person_id_user_id_created_at_idx").on(
      t.personId,
      t.userId,
      t.createdAt
    ),
    index("person_notes_user_id_created_at_idx").on(t.userId, t.createdAt),
  ]
);

export const userPersonRelationships = pgTable(
  "user_person_relationships",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    personId: bigint("person_id", { mode: "number" })
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    relationshipLevel: smallint("relationship_level").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    unique("user_person_relationships_user_id_person_id_key").on(t.userId, t.personId),
    index("user_person_relationships_person_id_idx").on(t.personId),
    index("user_person_relationships_user_id_idx").on(t.userId),
    check(
      "user_person_relationships_level_check",
      sql`${t.relationshipLevel} >= 1 AND ${t.relationshipLevel} <= 10`
    ),
  ]
);

// --- Relations ---

export const personsRelations = relations(persons, ({ one, many }) => ({
  healthcareProfile: one(personHealthcareProfiles, {
    fields: [persons.id],
    references: [personHealthcareProfiles.personId],
  }),
  facilityLinks: many(personFacilities),
  notes: many(personNotes),
  userRelationships: many(userPersonRelationships),
}));

export const personHealthcareProfilesRelations = relations(
  personHealthcareProfiles,
  ({ one, many }) => ({
    person: one(persons, {
      fields: [personHealthcareProfiles.personId],
      references: [persons.id],
    }),
    specialties: many(personHealthcareProfileSpecialties),
    registrations: many(personProfessionalRegistrations),
  })
);

export const personProfessionalRegistrationsRelations = relations(
  personProfessionalRegistrations,
  ({ one }) => ({
    profile: one(personHealthcareProfiles, {
      fields: [personProfessionalRegistrations.personId],
      references: [personHealthcareProfiles.personId],
    }),
    council: one(personProfessionalRegistrationCouncils, {
      fields: [personProfessionalRegistrations.councilId],
      references: [personProfessionalRegistrationCouncils.id],
    }),
  })
);

export const healthcareSpecialtiesRelations = relations(healthcareSpecialties, ({ many }) => ({
  profileLinks: many(personHealthcareProfileSpecialties),
}));

export const personHealthcareProfileSpecialtiesRelations = relations(
  personHealthcareProfileSpecialties,
  ({ one }) => ({
    profile: one(personHealthcareProfiles, {
      fields: [personHealthcareProfileSpecialties.personId],
      references: [personHealthcareProfiles.personId],
    }),
    specialty: one(healthcareSpecialties, {
      fields: [personHealthcareProfileSpecialties.specialtyId],
      references: [healthcareSpecialties.id],
    }),
  })
);

export const personFacilitiesRelations = relations(personFacilities, ({ one, many }) => ({
  person: one(persons, { fields: [personFacilities.personId], references: [persons.id] }),
  facility: one(facilities, {
    fields: [personFacilities.facilityId],
    references: [facilities.id],
  }),
  classifications: many(personFacilityClassificationAssignments),
  roles: many(personFacilityRoleAssignments),
  occupations: many(personFacilityOccupations),
}));

export const personFacilityClassificationAssignmentsRelations = relations(
  personFacilityClassificationAssignments,
  ({ one }) => ({
    personFacility: one(personFacilities, {
      fields: [personFacilityClassificationAssignments.personFacilityId],
      references: [personFacilities.id],
    }),
    classification: one(personFacilityClassifications, {
      fields: [personFacilityClassificationAssignments.classificationId],
      references: [personFacilityClassifications.id],
    }),
  })
);

export const personFacilityRoleAssignmentsRelations = relations(
  personFacilityRoleAssignments,
  ({ one }) => ({
    personFacility: one(personFacilities, {
      fields: [personFacilityRoleAssignments.personFacilityId],
      references: [personFacilities.id],
    }),
    role: one(personFacilityRoles, {
      fields: [personFacilityRoleAssignments.roleId],
      references: [personFacilityRoles.id],
    }),
  })
);

export const personFacilityOccupationsRelations = relations(
  personFacilityOccupations,
  ({ one }) => ({
    personFacility: one(personFacilities, {
      fields: [personFacilityOccupations.personFacilityId],
      references: [personFacilities.id],
    }),
    occupation: one(occupations, {
      fields: [personFacilityOccupations.occupationId],
      references: [occupations.id],
    }),
  })
);

export const personNotesRelations = relations(personNotes, ({ one }) => ({
  user: one(users, { fields: [personNotes.userId], references: [users.id] }),
  person: one(persons, { fields: [personNotes.personId], references: [persons.id] }),
}));

export const userPersonRelationshipsRelations = relations(userPersonRelationships, ({ one }) => ({
  user: one(users, { fields: [userPersonRelationships.userId], references: [users.id] }),
  person: one(persons, {
    fields: [userPersonRelationships.personId],
    references: [persons.id],
  }),
}));
