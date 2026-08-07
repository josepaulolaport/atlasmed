import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  index,
  uniqueIndex,
  numeric,
  date,
  unique,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { businessVerticals } from "./business-verticals";
import { facilities } from "./facilities";

export const products = pgTable(
  "products",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    /** Emultec product id. */
    idProdutoEmultec: bigint("id_produto_emultec", { mode: "number" }),
    description: text("description"),
    barcode: text("barcode"),
    commercialCode: text("commercial_code"),
    productGroup: text("product_group"),
    productClassification: text("product_classification"),
    internalClassification: text("internal_classification"),
    brand: text("brand"),
    unit: text("unit"),
    requiresSterilization: boolean("requires_sterilization").notNull().default(false),
    anvisaRegistration: text("anvisa_registration"),
    ncm: text("ncm"),
    pictureUrl: text("picture_url"),
    pictureBlurhash: text("picture_blurhash"),
    // Pricing and coding columns
    simproCode: text("simpro_code").notNull(),
    brasindiceCode: text("brasindice_code").notNull(),
    tissCode: text("tiss_code").notNull(),
    manufacturer: text("manufacturer").notNull(),
    countryOfOrigin: text("country_of_origin").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    price17: numeric("price_17", { precision: 12, scale: 2 }).notNull(),
    price18: numeric("price_18", { precision: 12, scale: 2 }).notNull(),
    price20: numeric("price_20", { precision: 12, scale: 2 }).notNull(),
    brasindiceUpdatedAt: date("brasindice_updated_at").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("products_is_active_idx").on(t.isActive),
    index("products_product_group_idx").on(t.productGroup),
    uniqueIndex("products_simpro_code_unique").on(t.simproCode),
    uniqueIndex("products_brasindice_code_unique").on(t.brasindiceCode),
    uniqueIndex("products_tiss_code_unique").on(t.tissCode),
    unique("products_id_produto_emultec_key").on(t.idProdutoEmultec),
  ]
);

export const productVerticals = pgTable(
  "product_verticals",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id, { onDelete: "cascade" }),
    verticalId: bigint("vertical_id", { mode: "number" })
      .notNull().references(() => businessVerticals.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("product_verticals_product_id_idx").on(t.productId),
    index("product_verticals_vertical_id_idx").on(t.verticalId),
    unique("product_verticals_unique").on(t.productId, t.verticalId),
  ]
);

export const competitorProducts = pgTable(
  "competitor_products",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    code: text("code"),
    name: text("name").notNull(),
    manufacturer: text("manufacturer"),
    brand: text("brand"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
    countryOfOrigin: text("country_of_origin"),
    price17: numeric("price_17", { precision: 12, scale: 2 }),
    price18: numeric("price_18", { precision: 12, scale: 2 }),
    price20: numeric("price_20", { precision: 12, scale: 2 }),
    brasindiceUpdatedAt: date("brasindice_updated_at"),
  },
  (t) => [
    index("competitor_products_is_active_idx").on(t.isActive),
    index("competitor_products_manufacturer_idx").on(t.manufacturer),
  ]
);

export const competitorProductVerticals = pgTable(
  "competitor_product_verticals",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    competitorProductId: bigint("competitor_product_id", { mode: "number" })
      .notNull().references(() => competitorProducts.id, { onDelete: "cascade" }),
    verticalId: bigint("vertical_id", { mode: "number" })
      .notNull().references(() => businessVerticals.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("competitor_product_verticals_cp_id_idx").on(t.competitorProductId),
    index("competitor_product_verticals_vertical_id_idx").on(t.verticalId),
    unique("competitor_product_verticals_unique").on(
      t.competitorProductId,
      t.verticalId
    ),
  ]
);

export const productEquivalences = pgTable(
  "product_equivalences",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id, { onDelete: "cascade" }),
    competitorProductId: bigint("competitor_product_id", { mode: "number" }).notNull().references(() => competitorProducts.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("product_equivalences_cp_id_idx").on(t.competitorProductId),
    index("product_equivalences_product_id_idx").on(t.productId),
    unique("product_equivalences_unique").on(t.competitorProductId, t.productId),
  ]
);

export const productsRelations = relations(products, ({ many }) => ({
  productVerticals: many(productVerticals),
  equivalences: many(productEquivalences),
}));

export const productVerticalsRelations = relations(productVerticals, ({ one }) => ({
  product: one(products, { fields: [productVerticals.productId], references: [products.id] }),
  vertical: one(businessVerticals, {
    fields: [productVerticals.verticalId],
    references: [businessVerticals.id],
  }),
}));

export const competitorProductsRelations = relations(competitorProducts, ({ many }) => ({
  competitorProductVerticals: many(competitorProductVerticals),
  equivalences: many(productEquivalences),
  facilityStandards: many(facilityCompetitorProductStandards),
}));

export const competitorProductVerticalsRelations = relations(
  competitorProductVerticals,
  ({ one }) => ({
    competitorProduct: one(competitorProducts, {
      fields: [competitorProductVerticals.competitorProductId],
      references: [competitorProducts.id],
    }),
    vertical: one(businessVerticals, {
      fields: [competitorProductVerticals.verticalId],
      references: [businessVerticals.id],
    }),
  })
);

export const productEquivalencesRelations = relations(productEquivalences, ({ one }) => ({
  product: one(products, { fields: [productEquivalences.productId], references: [products.id] }),
  competitorProduct: one(competitorProducts, { fields: [productEquivalences.competitorProductId], references: [competitorProducts.id] }),
}));

export const facilityCompetitorProductStandards = pgTable(
  "facility_competitor_product_standards",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    facilityId: bigint("facility_id", { mode: "number" }).notNull().references(() => facilities.id, { onDelete: "cascade" }),
    competitorProductId: bigint("competitor_product_id", { mode: "number" }).notNull().references(() => competitorProducts.id, { onDelete: "restrict" }),
    standardizedQuantity: bigint("standardized_quantity", { mode: "number" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("facility_competitor_product_standards_pair_uidx").on(t.facilityId, t.competitorProductId),
    index("facility_competitor_product_standards_facility_idx").on(t.facilityId),
    index("facility_competitor_product_standards_competitor_idx").on(t.competitorProductId),
  ]
);

export const facilityCompetitorProductStandardsRelations = relations(facilityCompetitorProductStandards, ({ one }) => ({
  facility: one(facilities, { fields: [facilityCompetitorProductStandards.facilityId], references: [facilities.id] }),
  competitorProduct: one(competitorProducts, { fields: [facilityCompetitorProductStandards.competitorProductId], references: [competitorProducts.id] }),
}));

