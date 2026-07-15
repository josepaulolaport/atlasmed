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

export interface OrderListRecord {
  id: string;
  legacyId: number | null;
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
}

export interface OrderDetailRecord {
  id: string;
  legacyId: number | null;
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

export interface OrderRepository {
  findAll(input: {
    page: number;
    limit: number;
    statuses?: OrderStatus[];
    scope: OrderScopeFilter;
  }): Promise<{ orders: OrderListRecord[]; total: number }>;
  findById(id: string): Promise<OrderDetailRecord | null>;
}
