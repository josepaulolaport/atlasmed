import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { orderStatusEnum, orderTypeEnum } from "./enums";
import { facilities, professionals } from "./facilities";
import { users } from "./users";
import { products } from "./catalog";

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),

    // Traceability back to legacy MySQL ERP (avulsa.id)
    legacyId: integer("legacy_id").unique(),

    // Relationships
    facilityId: text("facility_id").notNull().references(() => facilities.id),
    sellerId: text("seller_id").references(() => users.id),
    professionalId: text("professional_id").references(() => professionals.id),

    // Order identity
    status: orderStatusEnum("status").notNull().default("DRAFT"),
    type: orderTypeEnum("type").notNull().default("SALE"),
    surgeryType: text("surgery_type"),
    surgerySubtype: text("surgery_subtype"),
    orderedAt: timestamp("ordered_at").notNull(),
    notes: text("notes"),

    // Freight
    freight: numeric("freight", { precision: 10, scale: 2 }).notNull().default("0"),
    grossWeight: numeric("gross_weight", { precision: 10, scale: 3 }).notNull().default("0"),
    netWeight: numeric("net_weight", { precision: 10, scale: 3 }).notNull().default("0"),

    // Currency
    currency: text("currency").notNull().default("BRL"),
    usdExchangeRate: numeric("usd_exchange_rate", { precision: 10, scale: 4 }),

    // Lifecycle: finalized
    finalizedById: text("finalized_by_id").references(() => users.id),
    finalizedAt: timestamp("finalized_at"),

    // Lifecycle: rejected
    rejectedById: text("rejected_by_id").references(() => users.id),
    rejectionReason: text("rejection_reason"),

    // Lifecycle: no billing
    noBillingById: text("no_billing_by_id").references(() => users.id),
    noBillingAt: timestamp("no_billing_at"),
    noBillingNotes: text("no_billing_notes"),

    // Lifecycle: expense authorization
    expenseAuthorizedById: text("expense_authorized_by_id").references(() => users.id),
    expenseAuthorizedAt: timestamp("expense_authorized_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("orders_facility_id_idx").on(t.facilityId),
    index("orders_seller_id_idx").on(t.sellerId),
    index("orders_professional_id_idx").on(t.professionalId),
    index("orders_status_idx").on(t.status),
    index("orders_ordered_at_idx").on(t.orderedAt),
    index("orders_legacy_id_idx").on(t.legacyId),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),

    // Traceability back to legacy MySQL ERP (avulsa_envio_padrao.id)
    legacyId: integer("legacy_id").unique(),

    // Relationships
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id),
    legacyProductId: integer("legacy_product_id"),

    // Line item
    lineNumber: integer("line_number"),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("0"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    usdPrice: numeric("usd_price", { precision: 12, scale: 4 }).notNull().default("0"),

    // Medical traceability
    batchNumber: text("batch_number"),

    // Status
    writtenOff: boolean("written_off").notNull().default(false),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("order_items_order_id_idx").on(t.orderId),
    index("order_items_product_id_idx").on(t.productId),
    index("order_items_batch_number_idx").on(t.batchNumber),
  ]
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  facility: one(facilities, { fields: [orders.facilityId], references: [facilities.id] }),
  seller: one(users, { fields: [orders.sellerId], references: [users.id], relationName: "OrderSeller" }),
  professional: one(professionals, { fields: [orders.professionalId], references: [professionals.id] }),
  finalizedBy: one(users, { fields: [orders.finalizedById], references: [users.id], relationName: "OrderFinalizedBy" }),
  rejectedBy: one(users, { fields: [orders.rejectedById], references: [users.id], relationName: "OrderRejectedBy" }),
  noBillingBy: one(users, { fields: [orders.noBillingById], references: [users.id], relationName: "OrderNoBillingBy" }),
  expenseAuthorizedBy: one(users, { fields: [orders.expenseAuthorizedById], references: [users.id], relationName: "OrderExpenseAuthorizedBy" }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
