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
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { productOwnershipEnum } from "./enums";
import { businessVerticals } from "./business-verticals";
import { facilities } from "./facilities";

export const products = pgTable(
  "products",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    /**
     * Internal catalogue code. Nullable since spec 0013 §2: a competitor's
     * product lives in this table too and we do not assign it one.
     */
    code: text("code"),
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
    /**
     * Pricing-table codes. NULLABLE by correctness, not by relaxation
     * (spec 0013 §2): these were NOT NULL + unique, so the Emultec importer
     * invented `EMULTEC-SIM-{id}` / `EMULTEC-BRA-{id}` values purely to satisfy
     * the constraint. All 12 production rows hold synthetic codes today. The
     * constraint never guaranteed a real code — only a string — and the invented
     * ones would have to be reconciled against the real Brasíndice import.
     */
    simproCode: text("simpro_code"),
    brasindiceCode: text("brasindice_code"),
    tissCode: text("tiss_code"),
    manufacturer: text("manufacturer").notNull(),
    countryOfOrigin: text("country_of_origin").notNull(),
    /**
     * Our list price. Null for `ownership = COMPETITOR` — we do not sell it, so
     * there is no price of ours to record. Comparison reads price17/18/20,
     * which both sides have.
     */
    price: numeric("price", { precision: 12, scale: 2 }),
    price17: numeric("price_17", { precision: 12, scale: 2 }).notNull(),
    price18: numeric("price_18", { precision: 12, scale: 2 }).notNull(),
    price20: numeric("price_20", { precision: 12, scale: 2 }).notNull(),
    /** Meaningless without a brasindice_code, so nullable alongside it. */
    brasindiceUpdatedAt: date("brasindice_updated_at"),
    /**
     * Whether this is our product or a competitor's (spec 0013 §2).
     *
     * "Competitor" is a statement about our commercial relationship to a
     * product, not a kind of product — modelling it as a separate table
     * produced two near-identical tables, two vertical M2M tables, two
     * repositories and a bridging table whose job was to reconnect what should
     * never have been split.
     */
    ownership: productOwnershipEnum("ownership").notNull().default("OWN"),
    /**
     * How many metric units one product unit represents — a box of 5 ampoules
     * is 5, a single ampoule is 1 (spec 0013 §4.2).
     *
     * A correctness fix, not an enhancement: the penetration numerator sums
     * `order_items.quantity` raw, so ten boxes of five register as 10 ampoules
     * instead of 50. Every share figure computed today is wrong, and wrong
     * plausibly enough that nobody noticed.
     */
    metricUnits: numeric("metric_units", { precision: 12, scale: 3 })
      .notNull()
      .default("1"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("products_is_active_idx").on(t.isActive),
    index("products_product_group_idx").on(t.productGroup),
    index("products_ownership_idx").on(t.ownership),
    uniqueIndex("products_code_unique")
      .on(t.code)
      .where(sql`${t.code} IS NOT NULL`),
    // Partial-unique: a code must be unique when present, but most products have
    // none. A plain unique index over a nullable column would technically allow
    // this too, but stating the predicate keeps the intent explicit.
    uniqueIndex("products_simpro_code_unique")
      .on(t.simproCode)
      .where(sql`${t.simproCode} IS NOT NULL`),
    uniqueIndex("products_brasindice_code_unique")
      .on(t.brasindiceCode)
      .where(sql`${t.brasindiceCode} IS NOT NULL`),
    uniqueIndex("products_tiss_code_unique")
      .on(t.tissCode)
      .where(sql`${t.tissCode} IS NOT NULL`),
    unique("products_id_produto_emultec_key").on(t.idProdutoEmultec),
    // Redundant on its own — `id` is already the primary key — but a composite
    // foreign key can only reference a unique constraint, and this is what lets
    // other tables pin *which ownership* they accept (spec 0013 §2.1).
    unique("products_id_ownership_key").on(t.id, t.ownership),
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

/**
 * "This competitor product is the equivalent of that product of ours."
 *
 * The two sides are not interchangeable: `product_id` is always ours,
 * `competitor_product_id` is always theirs. Until 0085 that was true only
 * because the use case happened to look each id up through a differently scoped
 * repository — an emergent property of two reads, stated nowhere. A direct
 * insert could link a product to itself.
 *
 * Now the pair of ownerships is in the schema, plus an explicit check that the
 * two ids differ. That check is redundant once the composite keys are in place
 * (a row cannot be both OWN and COMPETITOR) and is kept anyway, because
 * "a product cannot be its own competitor" should be legible without deriving
 * it from two foreign keys.
 */
export const productEquivalences = pgTable(
  "product_equivalences",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id, { onDelete: "cascade" }),
    /** Pinned to OWN by the composite foreign key below. Never written. */
    productOwnership: productOwnershipEnum("product_ownership")
      .notNull()
      .generatedAlwaysAs(sql`'OWN'::product_ownership`),
    /**
     * A competitor product is a `products` row with ownership = COMPETITOR
     * (spec 0013 §2). The column keeps its name so nothing above the repository
     * changes shape; only what it references moved.
     */
    competitorProductId: bigint("competitor_product_id", { mode: "number" }).notNull().references(() => products.id, { onDelete: "cascade" }),
    /** Pinned to COMPETITOR by the composite foreign key below. Never written. */
    competitorOwnership: productOwnershipEnum("competitor_ownership")
      .notNull()
      .generatedAlwaysAs(sql`'COMPETITOR'::product_ownership`),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("product_equivalences_cp_id_idx").on(t.competitorProductId),
    index("product_equivalences_product_id_idx").on(t.productId),
    unique("product_equivalences_unique").on(t.competitorProductId, t.productId),
    foreignKey({
      name: "product_equivalences_own_side_fk",
      columns: [t.productId, t.productOwnership],
      foreignColumns: [products.id, products.ownership],
    }).onDelete("cascade"),
    foreignKey({
      name: "product_equivalences_competitor_side_fk",
      columns: [t.competitorProductId, t.competitorOwnership],
      foreignColumns: [products.id, products.ownership],
    }).onDelete("cascade"),
    check(
      "product_equivalences_not_self",
      sql`${t.productId} <> ${t.competitorProductId}`
    ),
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

export const facilityCompetitorProductStandards = pgTable(
  "facility_competitor_product_standards",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    facilityId: bigint("facility_id", { mode: "number" }).notNull().references(() => facilities.id, { onDelete: "cascade" }),
    competitorProductId: bigint("competitor_product_id", { mode: "number" }).notNull().references(() => products.id, { onDelete: "restrict" }),
    /** Pinned to COMPETITOR by the composite foreign key below. Never written. */
    competitorOwnership: productOwnershipEnum("competitor_ownership")
      .notNull()
      .generatedAlwaysAs(sql`'COMPETITOR'::product_ownership`),
    standardizedQuantity: bigint("standardized_quantity", { mode: "number" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("facility_competitor_product_standards_pair_uidx").on(t.facilityId, t.competitorProductId),
    index("facility_competitor_product_standards_facility_idx").on(t.facilityId),
    index("facility_competitor_product_standards_competitor_idx").on(t.competitorProductId),
    // A clinic's "standard" is what it uses *instead of* ours, so only a
    // competitor row belongs here. Retired by P4-2 in favour of
    // `facility_product_usage`; constrained meanwhile because it is live.
    foreignKey({
      name: "facility_competitor_standards_competitor_fk",
      columns: [t.competitorProductId, t.competitorOwnership],
      foreignColumns: [products.id, products.ownership],
    }).onDelete("restrict"),
  ]
);

export const facilityCompetitorProductStandardsRelations = relations(facilityCompetitorProductStandards, ({ one }) => ({
  facility: one(facilities, { fields: [facilityCompetitorProductStandards.facilityId], references: [facilities.id] }),
  competitorProduct: one(products, { fields: [facilityCompetitorProductStandards.competitorProductId], references: [products.id] }),
}));

