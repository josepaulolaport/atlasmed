import {
  pgTable,
  text,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * CNES lookup catalogs (public schema).
 * Seeded separately from CNES CSV import — schema only here.
 */

export const services = pgTable("services", {
  serviceCode: text("service_code").primaryKey(),
  serviceName: text("service_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const serviceClassifications = pgTable(
  "service_classifications",
  {
    serviceCode: text("service_code")
      .notNull()
      .references(() => services.serviceCode, { onDelete: "restrict" }),
    classificationCode: text("classification_code").notNull(),
    classificationName: text("classification_name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      name: "service_classifications_pkey",
      columns: [t.serviceCode, t.classificationCode],
    }),
  ]
);

export const occupations = pgTable("occupations", {
  occupationCode: text("occupation_code").primaryKey(),
  occupationName: text("occupation_name").notNull(),
  professionalClassification: text("professional_classification"),
  isHealthOccupation: text("is_health_occupation"),
  isRegulated: text("is_regulated"),
  referenceYear: text("reference_year"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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

export const servicesRelations = relations(services, ({ many }) => ({
  classifications: many(serviceClassifications),
}));

export const serviceClassificationsRelations = relations(
  serviceClassifications,
  ({ one }) => ({
    service: one(services, {
      fields: [serviceClassifications.serviceCode],
      references: [services.serviceCode],
    }),
  })
);

export const unitTypesRelations = relations(unitTypes, ({ many }) => ({
  subtypes: many(unitSubtypes),
}));

export const unitSubtypesRelations = relations(unitSubtypes, ({ one }) => ({
  unitType: one(unitTypes, {
    fields: [unitSubtypes.unitTypeCode],
    references: [unitTypes.unitTypeCode],
  }),
}));
