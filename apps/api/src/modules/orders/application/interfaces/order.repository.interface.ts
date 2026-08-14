export type OrderStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "INVOICED"
  | "REJECTED"
  | "NO_BILLING";

export interface OrderScopeFilter {
  isGlobal: boolean;
  facilityIds?: number[];
}

/**
 * How many orders sit in each status across the whole scoped set.
 *
 * Deliberately NOT narrowed by the caller's status filter. The Pedidos summary
 * strip is what reads this, and it counted the loaded page before — so it read
 * "2 pendentes" on a data set holding 1131 orders, and the number moved as the
 * rep scrolled. A count that changes when you scroll is worse than no count.
 *
 * Every status is present with an explicit zero rather than omitted, so a
 * client can render the full set without deciding what a missing key means.
 */
export type OrderStatusCounts = Record<OrderStatus, number>;

export interface OrderIdentity {
  id: number;
  name: string;
}

export interface OrderListItemPreview {
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderListRecord {
  id: number;
  idAvulsaEmultec: number | null;
  verticalId: number;
  facility: OrderIdentity;
  person: OrderIdentity | null;
  seller: OrderIdentity | null;
  status: OrderStatus;
  type: string;
  orderedAt: Date | null;
  createdAt: Date;
  freight: number;
  itemCount: number;
  itemsTotal: number;
  /** Up to 2 line items for card previews (optional). */
  itemPreviews?: OrderListItemPreview[];
}

export interface OrderDetailRecord {
  id: number;
  idAvulsaEmultec: number | null;
  verticalId: number;
  /**
   * The profile the order belongs to (spec 0010 §4). Not serialized to clients —
   * it is what the metric snapshot recompute is keyed on (spec 0013 §4.4).
   */
  facilityVerticalProfileId: number;
  facility: OrderIdentity;
  person: OrderIdentity | null;
  seller: OrderIdentity | null;
  status: OrderStatus;
  type: string;
  orderedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** The visit this order was booked against, when it came from one. */
  interactionId: number | null;
  surgeryType: string | null;
  surgerySubtype: string | null;
  notes: string | null;
  freight: number;
  grossWeight: number;
  netWeight: number;
  currency: string;
  usdExchangeRate: number | null;
  /**
   * Who acted, not just when.
   *
   * The four `*ById` columns were already serialized as bare user ids, which a
   * client can do nothing with — "Rejeitado por 7" names nobody. The resolved
   * identity sits alongside so the detail screen can show the person, and stays
   * null when the id is null or the user row is gone.
   */
  finalizedBy: OrderIdentity | null;
  finalizedById: number | null;
  finalizedAt: Date | null;
  rejectedBy: OrderIdentity | null;
  rejectedById: number | null;
  rejectionReason: string | null;
  noBillingBy: OrderIdentity | null;
  noBillingById: number | null;
  noBillingAt: Date | null;
  noBillingNotes: string | null;
  expenseAuthorizedBy: OrderIdentity | null;
  expenseAuthorizedById: number | null;
  expenseAuthorizedAt: Date | null;
  items: Array<{
    id: number;
    idAvulsaItemEmultec: number | null;
    product: { id: number; name: string; code: string } | null;
    idProdutoEmultec: number | null;
    quantity: number;
    unitPrice: number;
    usdPrice: number | null;
    batchNumber: string | null;
    writtenOff: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

export interface CreateOrderItemInput {
  productId: number;
  quantity: number;
  unitPrice?: number;
}

export interface CreateOrderInput {
  facilityId: number;
  verticalId: number;
  sellerId: number | null;
  personId?: number | null;
  status?: OrderStatus;
  type?: string;
  notes?: string | null;
  freight?: number;
  orderedAt?: Date;
  items: CreateOrderItemInput[];
}

export interface OrderRepository {
  findAll(input: {
    page: number;
    limit: number;
    statuses?: OrderStatus[];
    facilityId?: number;
    /** Restrict to orders in these verticals (empty ⇒ no rows). */
    verticalIds: number[];
    /** When set (REP), only orders sold by this user. */
    sellerId?: number;
    /** Include up to 2 line-item previews per order. */
    includeItemPreviews?: boolean;
    scope: OrderScopeFilter;
  }): Promise<{
    orders: OrderListRecord[];
    total: number;
    statusCounts: OrderStatusCounts;
  }>;
  findById(id: number): Promise<OrderDetailRecord | null>;
  create(input: CreateOrderInput): Promise<OrderDetailRecord>;
  hasActiveFacilityVerticalProfile(
    facilityId: number,
    verticalId: number
  ): Promise<boolean>;
  /** Product ids among `productIds` that belong to the vertical. */
  findProductIdsInVertical(
    productIds: number[],
    verticalId: number
  ): Promise<number[]>;
  findProductUnitPrices(
    productIds: number[]
  ): Promise<Map<number, number>>;
}
