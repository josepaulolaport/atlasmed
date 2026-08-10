import {
  pgTable,
  text,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
  bigint,
  char,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { orderStatusEnum, orderTypeEnum } from "./enums";
import { businessVerticals } from "./business-verticals";
import { facilities, facilityVerticalProfiles } from "./facilities";
import { persons } from "./persons";
import { products } from "./catalog";
import { interactions } from "./calendar";
import { users } from "./users";

export const orders = pgTable(
  "orders",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    /** Emultec avulsa (order header) id. */
    idAvulsaEmultec: bigint("id_avulsa_emultec", { mode: "number" }),
    /**
     * The commercial unit this order belongs to (spec 0010 §4). Read this, not
     * the pair below.
     *
     * Keying here rather than on (facility, vertical) is what makes an order
     * without a profile impossible — the database enforces what the Emultec
     * importer used to be able to skip. It also fixes the penetration numerator,
     * which filtered facility only and silently ignored the vertical.
     */
    facilityVerticalProfileId: bigint("facility_vertical_profile_id", { mode: "number" })
      .notNull()
      .references(() => facilityVerticalProfiles.id, { onDelete: "restrict" }),
    /**
     * @deprecated Superseded by `facilityVerticalProfileId`. Dropped in migration
     * 0079 — writes must keep populating it until then (both are NOT NULL), reads
     * must not use it.
     */
    facilityId: bigint("facility_id", { mode: "number" }).notNull().references(() => facilities.id),
    /**
     * @deprecated Superseded by `facilityVerticalProfileId`; derivable from it.
     * Dropped in migration 0079 — same rule as `facilityId`.
     */
    verticalId: bigint("vertical_id", { mode: "number" })
      .notNull().references(() => businessVerticals.id, { onDelete: "restrict" }),
    sellerId: bigint("seller_id", { mode: "number" }).references(() => users.id),
    personId: bigint("person_id", { mode: "number" }).references(() => persons.id),
    interactionId: bigint("interaction_id", { mode: "number" }).references(() => interactions.id, {
      onDelete: "restrict",
    }),
    status: orderStatusEnum("status").notNull().default("DRAFT"),
    type: orderTypeEnum("type").notNull().default("SALE"),
    orderedAt: timestamp("ordered_at").notNull(),
    notes: text("notes"),
    freight: numeric("freight", { precision: 10, scale: 2 }).notNull().default("0"),
    grossWeight: numeric("gross_weight", { precision: 10, scale: 3 }).notNull().default("0"),
    netWeight: numeric("net_weight", { precision: 10, scale: 3 }).notNull().default("0"),
    currency: char("currency", { length: 3 }).notNull().default("BRL"),
    finalizedById: bigint("finalized_by_id", { mode: "number" }).references(() => users.id),
    finalizedAt: timestamp("finalized_at"),
    rejectedById: bigint("rejected_by_id", { mode: "number" }).references(() => users.id),
    rejectionReason: text("rejection_reason"),
    noBillingById: bigint("no_billing_by_id", { mode: "number" }).references(() => users.id),
    noBillingAt: timestamp("no_billing_at"),
    noBillingNotes: text("no_billing_notes"),
    expenseAuthorizedById: bigint("expense_authorized_by_id", { mode: "number" }).references(() => users.id),
    expenseAuthorizedAt: timestamp("expense_authorized_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("orders_facility_id_idx").on(t.facilityId),
    index("orders_vertical_id_idx").on(t.verticalId),
    index("orders_status_idx").on(t.status),
    index("orders_ordered_at_idx").on(t.orderedAt),
    index("orders_person_id_idx").on(t.personId),
    index("orders_interaction_id_idx").on(t.interactionId),
    index("orders_seller_id_idx").on(t.sellerId),
    index("orders_valid_purchase_facility_ordered_at_idx")
      .on(t.facilityId, t.orderedAt.desc())
      .where(sql`${t.status} in ('APPROVED', 'INVOICED') and ${t.type} in ('SALE', 'CONSIGNMENT')`),
    index("orders_valid_purchase_facility_vertical_ordered_at_idx")
      .on(t.facilityId, t.verticalId, t.orderedAt.desc())
      .where(sql`${t.status} in ('APPROVED', 'INVOICED') and ${t.type} in ('SALE', 'CONSIGNMENT')`),
    index("orders_updated_at_facility_id_idx").on(t.updatedAt, t.facilityId),
    index("orders_facility_vertical_profile_id_idx").on(t.facilityVerticalProfileId),
    /**
     * The funnel's index. `loadPurchaseDates` filters exactly this predicate; if it
     * stops matching, the funnel degrades to a sequential scan over every order and
     * nothing fails loudly. Replaces the (facility, vertical) form in 0079.
     */
    index("orders_valid_purchase_profile_ordered_at_idx")
      .on(t.facilityVerticalProfileId, t.orderedAt.desc())
      .where(sql`${t.status} in ('APPROVED', 'INVOICED') and ${t.type} in ('SALE', 'CONSIGNMENT')`),
    /** Backs incremental search reindexing: orders touched since T, by profile. */
    index("orders_updated_at_profile_id_idx").on(t.updatedAt, t.facilityVerticalProfileId),
    unique("orders_id_avulsa_emultec_key").on(t.idAvulsaEmultec),
  ]
);

export const orderCommandReceipts = pgTable(
  "order_command_receipts",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    actorUserId: bigint("actor_user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    commandKey: text("command_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    orderId: bigint("order_id", { mode: "number" })
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    result: jsonb("result").$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("order_command_receipts_actor_user_id_command_key_key").on(
      t.actorUserId,
      t.commandKey,
    ),
    index("order_command_receipts_order_id_idx").on(t.orderId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    /** Emultec avulsa item (line) id. */
    idAvulsaItemEmultec: bigint("id_avulsa_item_emultec", { mode: "number" }),
    orderId: bigint("order_id", { mode: "number" }).notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: bigint("product_id", { mode: "number" }).references(() => products.id),
    /** Denormalized Emultec product id on the line (may differ from products.id_produto_emultec historically). */
    idProdutoEmultec: bigint("id_produto_emultec", { mode: "number" }),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("0"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    usdPrice: numeric("usd_price", { precision: 12, scale: 4 }).notNull().default("0"),
    batchNumber: text("batch_number"),
    writtenOff: boolean("written_off").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("order_items_batch_number_idx").on(t.batchNumber),
    index("order_items_order_id_idx").on(t.orderId),
    index("order_items_product_id_idx").on(t.productId),
    unique("order_items_id_avulsa_item_emultec_key").on(t.idAvulsaItemEmultec),
  ]
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  verticalProfile: one(facilityVerticalProfiles, {
    fields: [orders.facilityVerticalProfileId],
    references: [facilityVerticalProfiles.id],
  }),
  /** @deprecated Reach the facility through `verticalProfile`. Dropped in 0079. */
  facility: one(facilities, { fields: [orders.facilityId], references: [facilities.id] }),
  interaction: one(interactions, {
    fields: [orders.interactionId],
    references: [interactions.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
