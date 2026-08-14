import {
  pgTable,
  text,
  boolean,
  timestamp,
  numeric,
  date,
  index,
  uniqueIndex,
  unique,
  bigint,
  primaryKey,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { businessVerticals } from "./business-verticals";
import { facilityVerticalProfiles } from "./facilities";
import { products } from "./catalog";
import { productOwnershipEnum } from "./enums";
import { users } from "./users";

/**
 * Admin-defined potential metric fields per commercial Linha (vertical).
 * Soft-deleted via deleted_at — unique (vertical_id, key) among active rows.
 */
export const productPotentialDefinitions = pgTable(
  "product_potential_definitions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    verticalId: bigint("vertical_id", { mode: "number" })
      .notNull().references(() => businessVerticals.id, { onDelete: "cascade" }),
    /** Stable key, e.g. ampolas_mes, prp. */
    key: text("key").notNull(),
    label: text("label").notNull(),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("product_potential_definitions_vertical_id_idx").on(t.verticalId),
    uniqueIndex("product_potential_definitions_vertical_key_active_uidx")
      .on(t.verticalId, t.key)
      .where(sql`${t.deletedAt} is null`),
    // Redundant beside the primary key, but a composite foreign key can only
    // reference a unique constraint. This is what lets a link pin the vertical
    // it claims against the vertical its definition actually has.
    unique("product_potential_definitions_id_vertical_id_key").on(t.id, t.verticalId),
  ],
);

/**
 * What a clinic uses of each *competitor* product, per metric, per month
 * (spec 0013 §4.1). The rep picks the product and types one number.
 *
 * This is the market denominator, and it replaces
 * `facility_potential_values.quantity` — a single hand-entered guess at the
 * whole market that penetração divided by. Two sources for one number produce
 * disagreements nobody can resolve; an itemised list of who supplies what does
 * not.
 *
 * Also replaces `facility_competitor_product_standards`, which was
 * facility-scoped rather than per-linha, unlinked to any metric, and carried a
 * single `standardized_quantity` that nothing read.
 *
 * `vertical_id` is denormalised to carry one invariant the schema could not
 * otherwise state: **a usage row's profile and its definition must be in the
 * same linha.** Two composite foreign keys reference that single column, so the
 * two sides cannot disagree.
 */
export const facilityProductUsage = pgTable(
  "facility_product_usage",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    facilityVerticalProfileId: bigint("facility_vertical_profile_id", { mode: "number" })
      .notNull(),
    definitionId: bigint("definition_id", { mode: "number" }).notNull(),
    /** Equal to both the profile's and the definition's vertical; FKs enforce it. */
    verticalId: bigint("vertical_id", { mode: "number" }).notNull(),
    productId: bigint("product_id", { mode: "number" }).notNull(),
    /** Pinned to COMPETITOR by the composite foreign key below. Never written. */
    productOwnership: productOwnershipEnum("product_ownership")
      .notNull()
      .generatedAlwaysAs(sql`'COMPETITOR'::product_ownership`),
    /**
     * How many per month, in the product's own units, as the rep entered it.
     *
     * Not multiplied by anything on read: `products.metric_units` is an
     * information field since spec 0013 §4.6, so a metric's products must all
     * be measured in the same unit. Nothing enforces that — see §7.
     */
    quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(),
    updatedByUserId: bigint("updated_by_user_id", { mode: "number" }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    // One quantity per competitor product per metric per clinic-linha. Not per
    // month (§4.6): a rep answers "quantas por mês" once and the figure stands
    // until they replace it, so a second row for the same product would be a
    // second answer to a question with one answer.
    unique("facility_product_usage_profile_definition_product_key").on(
      t.facilityVerticalProfileId,
      t.definitionId,
      t.productId,
    ),
    index("facility_product_usage_profile_idx").on(t.facilityVerticalProfileId),
    index("facility_product_usage_definition_idx").on(t.definitionId),
    index("facility_product_usage_product_idx").on(t.productId),
    // The reconciliation sweep asks "what changed since T". Without this it
    // seq-scans; the table is empty today and will not stay that way.
    index("facility_product_usage_updated_at_idx").on(t.updatedAt),
    foreignKey({
      name: "facility_product_usage_profile_vertical_fk",
      columns: [t.facilityVerticalProfileId, t.verticalId],
      foreignColumns: [facilityVerticalProfiles.id, facilityVerticalProfiles.verticalId],
    }).onDelete("cascade"),
    foreignKey({
      name: "facility_product_usage_definition_vertical_fk",
      columns: [t.definitionId, t.verticalId],
      foreignColumns: [productPotentialDefinitions.id, productPotentialDefinitions.verticalId],
    }).onDelete("cascade"),
    // Orders are authoritative for our own quantities, so only a competitor's
    // product can be recorded by hand (spec 0013 §2.1).
    foreignKey({
      name: "facility_product_usage_competitor_fk",
      columns: [t.productId, t.productOwnership],
      foreignColumns: [products.id, products.ownership],
    }).onDelete("restrict"),
    // Strictly positive (§4.6). A zero is not a quantity — "they sell none
    // here" is the `no_other_brands` claim on the snapshot, which is dated.
    // A zero row would say the same thing undated and would keep the product
    // in a list of what the clinic uses.
    check("facility_product_usage_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

/**
 * The computed metric for one (profile, definition, month) — spec 0013 §4.4.
 *
 * **This table is a cache, not a source of truth.** Both inputs carry history:
 * `ours` is exactly recomputable from `orders.ordered_at` forever, and since the
 * 2026-08-11 amendment `theirs` is keyed by month too. So every row is a pure
 * function of stored state for all time — truncate the table and rebuild it and
 * it reproduces itself exactly.
 *
 * That is what demotes the reconciliation sweep from correctness to latency: a
 * sweep that never runs costs staleness, never a wrong number.
 *
 * Rows hold the **facts about month M**, not a rolling average. The trailing
 * N-month mean is derived at read time (spec 0013 §4.3), which is why changing N
 * is a query change rather than a data migration.
 */
export const facilityMetricSnapshots = pgTable(
  "facility_metric_snapshots",
  {
    facilityVerticalProfileId: bigint("facility_vertical_profile_id", { mode: "number" })
      .notNull(),
    definitionId: bigint("definition_id", { mode: "number" }).notNull(),
    /** Equal to both the profile's and the definition's vertical; FKs enforce it. */
    verticalId: bigint("vertical_id", { mode: "number" }).notNull(),
    /** Ours: the 90-day window normalised to a month (§4.6). */
    oursQty: numeric("ours_qty", { precision: 14, scale: 2 }).notNull(),
    /** Theirs: the sum of the figure standing for each competitor product. */
    theirsQty: numeric("theirs_qty", { precision: 14, scale: 2 }).notNull(),
    /**
     * The rep's claim that no other brand is sold here for this metric.
     *
     * An **input**, living on a derived row — see §4.6. The recompute must
     * never write these two columns; the check below and
     * `metric-snapshot.test.ts` both exist to keep that true, because a cache
     * that quietly eats a person's assertion is the worst kind of bug.
     *
     * Who set it is deliberately not stored. It would be written on every claim
     * and read by nothing, which is how `assigned_by` ended up deleted in spec
     * 0009 R9; the column can come back the day a screen asks for it.
     */
    noOtherBrands: boolean("no_other_brands").notNull().default(false),
    /** A stale claim still counts; the date is the only signal it is old (§6). */
    noOtherBrandsSetAt: timestamp("no_other_brands_set_at"),
    /**
     * The observed market. Generated rather than written, so no writer can
     * disagree with the two columns it comes from.
     */
    totalQty: numeric("total_qty", { precision: 14, scale: 2 })
      .notNull()
      .generatedAlwaysAs(sql`ours_qty + theirs_qty`),
    /**
     * Our share of the observed market, 0–1.
     *
     * **Null, never 0, when nothing is known** (§4.3, extended by §4.6). Two
     * conditions, and the whole rule fits here because the claim lives on this
     * row: there must be a market we know about — a recorded competitor, or the
     * rep asserting there is none — and something in it to divide.
     *
     * Generated, so no writer can disagree with it. Without the
     * `no_other_brands` half, a clinic nobody had surveyed reported 100%: we
     * own everything, on no evidence.
     */
    share: numeric("share", { precision: 9, scale: 8 }).generatedAlwaysAs(
      sql`case
            when (no_other_brands or theirs_qty > 0) and ours_qty + theirs_qty > 0
            then ours_qty / (ours_qty + theirs_qty)
          end`,
    ),
    computedAt: timestamp("computed_at").notNull().defaultNow(),
  },
  (t) => [
    // The natural key *is* the identity, and it is the UPSERT conflict target.
    // No surrogate id: a snapshot is not an addressable entity the way a rep's
    // usage row is, so a sequence here would be an unused column and a second
    // way to say the same thing.
    // One row per clinic-linha per metric (§4.6). Not per month: the metric
    // says what is true now, and nothing reads it as a series.
    primaryKey({
      name: "facility_metric_snapshots_pkey",
      columns: [t.facilityVerticalProfileId, t.definitionId],
    }),
    index("facility_metric_snapshots_computed_at_idx").on(t.computedAt),
    // Same invariant as facility_product_usage: a snapshot cannot pair a profile
    // in one linha with a metric in another.
    foreignKey({
      name: "facility_metric_snapshots_profile_vertical_fk",
      columns: [t.facilityVerticalProfileId, t.verticalId],
      foreignColumns: [facilityVerticalProfiles.id, facilityVerticalProfiles.verticalId],
    }).onDelete("cascade"),
    foreignKey({
      name: "facility_metric_snapshots_definition_vertical_fk",
      columns: [t.definitionId, t.verticalId],
      foreignColumns: [productPotentialDefinitions.id, productPotentialDefinitions.verticalId],
    }).onDelete("cascade"),
    // "No other brand is sold here" and "here is a brand they sell" cannot both
    // be true. The application clears the claim when a product is added; this
    // makes the contradiction unrepresentable rather than merely unlikely.
    check(
      "facility_metric_snapshots_no_other_brands_excludes_theirs",
      sql`not ${t.noOtherBrands} or ${t.theirsQty} = 0`,
    ),
    check("facility_metric_snapshots_ours_non_negative", sql`${t.oursQty} >= 0`),
    check("facility_metric_snapshots_theirs_non_negative", sql`${t.theirsQty} >= 0`),
  ],
);

/**
 * Which of our products count toward which metric (spec 0013 §3).
 *
 * One definition per (product, vertical) — not one per product. `product_id`
 * used to be the primary key, which contradicted `product_verticals` being M2M:
 * a product sold in two linhas could carry a metric in one and, silently, none
 * in the other.
 *
 * `vertical_id` is denormalised here purely to carry that rule into the schema.
 * It is not independent data — the composite foreign key below ties it to the
 * definition's own vertical, so a link cannot claim a linha its definition does
 * not have.
 */
export const productPotentialLinks = pgTable(
  "product_potential_links",
  {
    productId: bigint("product_id", { mode: "number" })
      .notNull().references(() => products.id, { onDelete: "cascade" }),
    definitionId: bigint("definition_id", { mode: "number" }).notNull(),
    /** Always equal to the definition's vertical; the composite FK enforces it. */
    verticalId: bigint("vertical_id", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({
      name: "product_potential_links_pkey",
      columns: [t.productId, t.definitionId],
    }),
    index("product_potential_links_definition_id_idx").on(t.definitionId),
    // The rule that matters: a product resolves to at most one metric per linha,
    // so the penetration join can never double-count it.
    unique("product_potential_links_product_vertical_key").on(t.productId, t.verticalId),
    foreignKey({
      name: "product_potential_links_definition_vertical_fk",
      columns: [t.definitionId, t.verticalId],
      foreignColumns: [productPotentialDefinitions.id, productPotentialDefinitions.verticalId],
    }).onDelete("cascade"),
  ],
);

export const productPotentialDefinitionsRelations = relations(
  productPotentialDefinitions,
  ({ one, many }) => ({
    vertical: one(businessVerticals, {
      fields: [productPotentialDefinitions.verticalId],
      references: [businessVerticals.id],
    }),
    usage: many(facilityProductUsage),
    productLinks: many(productPotentialLinks),
  }),
);


export const facilityProductUsageRelations = relations(
  facilityProductUsage,
  ({ one }) => ({
    profile: one(facilityVerticalProfiles, {
      fields: [facilityProductUsage.facilityVerticalProfileId],
      references: [facilityVerticalProfiles.id],
    }),
    definition: one(productPotentialDefinitions, {
      fields: [facilityProductUsage.definitionId],
      references: [productPotentialDefinitions.id],
    }),
    product: one(products, {
      fields: [facilityProductUsage.productId],
      references: [products.id],
    }),
    updatedBy: one(users, {
      fields: [facilityProductUsage.updatedByUserId],
      references: [users.id],
    }),
  }),
);

export const productPotentialLinksRelations = relations(
  productPotentialLinks,
  ({ one }) => ({
    product: one(products, {
      fields: [productPotentialLinks.productId],
      references: [products.id],
    }),
    definition: one(productPotentialDefinitions, {
      fields: [productPotentialLinks.definitionId],
      references: [productPotentialDefinitions.id],
    }),
  }),
);
