import type {
  ProductDeletionOutcome,
  ProductReferences,
} from "./product.repository.interface";

export interface CompetitorProductRecord {
  id: number;
  code: string | null;
  name: string;
  manufacturer: string | null;
  brand: string | null;
  countryOfOrigin: string | null;
  price17: number | null;
  price18: number | null;
  price20: number | null;
  brasindiceUpdatedAt: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  /**
   * How many of our products this brand is equivalent to (spec 0016 §5.3).
   *
   * On the list read only, so the admin can see at a glance which brands are
   * mapped and which are not — a brand at zero is one a rep cannot record
   * quantities for (spec 0013 §7), and finding those by opening each row in turn
   * is not a workflow. Undefined on reads that do not compute it, rather than 0,
   * so "not asked" and "none" stay distinguishable.
   */
  equivalenceCount?: number;
}

export interface CompetitorProductRepository {
  findAll(params: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
  }): Promise<{ competitorProducts: CompetitorProductRecord[]; total: number }>;

  findById(id: number): Promise<CompetitorProductRecord | null>;

  /** All active competitor products, unpaginated — backs the price index. */
  findAllActive(): Promise<CompetitorProductRecord[]>;

  /**
   * `brasindiceUpdatedAt` is nullable here, and that is a fix rather than a
   * relaxation: it was required, and nothing in the app could supply it — the
   * competitor form has no date field — so `POST /competitor-products` answered
   * 422 for every brand an admin tried to register. The column is meaningless
   * without a `brasindice_code` anyway (spec 0013 §2), and no competitor row in
   * production has one.
   */
  create(data: {
    code?: string | null;
    name: string;
    manufacturer: string;
    brand?: string | null;
    countryOfOrigin: string;
    price17: number;
    price18: number;
    price20: number;
    brasindiceUpdatedAt?: string | null;
    isActive?: boolean;
  }): Promise<CompetitorProductRecord>;

  update(
    id: number,
    data: {
      code?: string | null;
      name?: string;
      manufacturer?: string;
      brand?: string | null;
      countryOfOrigin?: string;
      price17?: number;
      price18?: number;
      price20?: number;
      brasindiceUpdatedAt?: string | null;
      isActive?: boolean;
    }
  ): Promise<CompetitorProductRecord>;

  /** What still points at this brand. Empty ⇒ it can be deleted. */
  findReferences(id: number): Promise<ProductReferences>;

  /**
   * Same conditional delete as our own products (spec 0016 §6.2), by symmetry:
   * a brand registered by mistake can go, a brand a rep has recorded quantities
   * against cannot — `facility_product_usage` is `ON DELETE RESTRICT` and those
   * numbers are field-collected data, which a catalogue edit never invalidates
   * (spec 0013 §4.1).
   */
  deleteIfUnreferenced(id: number): Promise<ProductDeletionOutcome>;
}
