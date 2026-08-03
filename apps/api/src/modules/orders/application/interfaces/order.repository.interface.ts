export type OrderStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "INVOICED"
  | "REJECTED"
  | "NO_BILLING";

export interface OrderScopeFilter {
  isGlobal: boolean;
  facilityIds?: string[];
}

export interface OrderIdentity {
  id: string;
  name: string;
}

export interface OrderListItemPreview {
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderListRecord {
  id: string;
  legacyId: number | null;
  interactionId: string | null;
  verticalId: string;
  facility: OrderIdentity;
  professional: OrderIdentity | null;
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
  id: string;
  legacyId: number | null;
  interactionId: string | null;
  verticalId: string;
  facility: OrderIdentity;
  professional: OrderIdentity | null;
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
  finalizedById: string | null;
  finalizedAt: Date | null;
  rejectedById: string | null;
  rejectionReason: string | null;
  noBillingById: string | null;
  noBillingAt: Date | null;
  noBillingNotes: string | null;
  expenseAuthorizedById: string | null;
  expenseAuthorizedAt: Date | null;
  items: Array<{
    id: string;
    legacyId: number | null;
    lineNumber: number | null;
    product: { id: string; name: string; code: string } | null;
    legacyProductId: number | null;
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
  productId: string;
  quantity: number;
  unitPrice?: number;
}

export interface CreateOrderInput {
  facilityId: string;
  interactionId?: string | null;
  verticalId: string;
  sellerId: string | null;
  professionalId?: string | null;
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
    facilityId?: string;
    interactionId?: string;
    /** Restrict to orders in these verticals (empty ⇒ no rows). */
    verticalIds: string[];
    /** When set (REP), only orders sold by this user. */
    sellerId?: string;
    /** Include up to 2 line-item previews per order. */
    includeItemPreviews?: boolean;
    scope: OrderScopeFilter;
  }): Promise<{ orders: OrderListRecord[]; total: number }>;
  findById(id: string): Promise<OrderDetailRecord | null>;
  create(input: CreateOrderInput): Promise<OrderDetailRecord>;
  hasActiveFacilityVerticalProfile(
    facilityId: string,
    verticalId: string
  ): Promise<boolean>;
  /** Product ids among `productIds` that belong to the vertical. */
  findProductIdsInVertical(
    productIds: string[],
    verticalId: string
  ): Promise<string[]>;
  findProductUnitPrices(
    productIds: string[]
  ): Promise<Map<string, number>>;
}
