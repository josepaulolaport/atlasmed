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
  surgeryType: string | null;
  surgerySubtype: string | null;
  notes: string | null;
  freight: number;
  grossWeight: number;
  netWeight: number;
  currency: string;
  usdExchangeRate: number | null;
  finalizedById: number | null;
  finalizedAt: Date | null;
  rejectedById: number | null;
  rejectionReason: string | null;
  noBillingById: number | null;
  noBillingAt: Date | null;
  noBillingNotes: string | null;
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
  }): Promise<{ orders: OrderListRecord[]; total: number }>;
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
