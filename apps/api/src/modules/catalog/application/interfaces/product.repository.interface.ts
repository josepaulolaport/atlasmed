export interface ProductRecord {
  id: number;
  code: string | null;
  name: string;
  description: string | null;
  commercialCode: string | null;
  productGroup: string | null;
  productClassification: string | null;
  internalClassification: string | null;
  brand: string | null;
  unit: string | null;
  barcode: string | null;
  ncm: string | null;
  anvisaRegistration: string | null;
  requiresSterilization: boolean;
  /**
   * The Emultec product id. Admin-writable since spec 0016 §5.1: it is how the
   * order importer matches a line to a product, so registering the product a
   * dead-lettered order referenced (spec 0013 §5) means setting this.
   */
  idProdutoEmultec: number | null;
  verticalIds: number[];
  pictureUrl: string | null;
  pictureBlurhash: string | null;
  /** Null when the product has no pricing-table code — see spec 0013 §2. */
  simproCode: string | null;
  brasindiceCode: string | null;
  tissCode: string | null;
  manufacturer: string;
  countryOfOrigin: string;
  price: number | null;
  price17: number;
  price18: number;
  price20: number;
  brasindiceUpdatedAt: string | null;
  /**
   * How many metric units one product unit represents.
   *
   * **Read-only, everywhere.** Spec 0013 §4.6 demoted it to an information
   * field — the metric calculation uses raw quantities — and spec 0016 §7.1
   * keeps it that way rather than reinstating a multiplication that
   * `sumOurs` and `sumOursByProduct` currently disagree about. There is
   * deliberately no writer: not on create, not on update, not in any route.
   */
  metricUnits: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The columns an admin may set. Shared by create and update so the two cannot
 * drift — update makes every one of them optional, create pins what it requires.
 *
 * `metricUnits` and `ownership` are absent by decision, not omission: the first
 * per spec 0016 §7.1, the second per §6.1 — ownership is chosen by the endpoint
 * (`/products` is OWN, `/competitor-products` is COMPETITOR), never by a field,
 * because composite foreign keys pin `order_items` and `facility_product_usage`
 * to one side of it.
 */
export interface ProductWritableFields {
  code: string | null;
  name: string;
  description: string | null;
  commercialCode: string | null;
  productGroup: string | null;
  productClassification: string | null;
  internalClassification: string | null;
  brand: string | null;
  unit: string | null;
  barcode: string | null;
  ncm: string | null;
  anvisaRegistration: string | null;
  requiresSterilization: boolean;
  idProdutoEmultec: number | null;
  simproCode: string | null;
  brasindiceCode: string | null;
  tissCode: string | null;
  manufacturer: string;
  countryOfOrigin: string;
  price: number | null;
  price17: number;
  price18: number;
  price20: number;
  brasindiceUpdatedAt: string | null;
  isActive: boolean;
}

export type CreateProductInput = Partial<ProductWritableFields> &
  Pick<ProductWritableFields, "name" | "manufacturer" | "countryOfOrigin"> & {
    /**
     * At least one Linha, and the only chance to choose: spec 0016 §6.7 makes
     * a product's Linhas immutable after creation, so `update` does not take
     * them.
     */
    verticalIds: number[];
  };

export type UpdateProductInput = Partial<ProductWritableFields>;

/**
 * What still points at a product, by relation. Zero-valued keys are omitted, so
 * an empty object means "nothing — safe to delete".
 *
 * Counted rather than merely detected: the refusal has to name what blocks it
 * ("3 pedidos e 1 equivalência"), because the admin's next move differs — an
 * order is history and means deactivate, a stray equivalence is something they
 * can remove and retry.
 */
export type ProductReferences = {
  orderItems?: number;
  facilityProductUsage?: number;
  productEquivalences?: number;
  productPotentialLinks?: number;
};

/**
 * Three outcomes, not two: "no such product" and "found but blocked" become
 * different HTTP answers (404 vs 409), and collapsing them into a boolean is
 * how a delete that silently did nothing reads as success.
 */
export type ProductDeletionOutcome =
  | { found: false }
  | { found: true; deleted: true }
  | { found: true; deleted: false; references: ProductReferences };

export interface ProductRepository {
  findAll(params: {
    page: number;
    limit: number;
    /** Restrict to products linked to any of these verticals (empty ⇒ no rows). */
    verticalIds: number[];
    search?: string;
    isActive?: boolean;
  }): Promise<{ products: ProductRecord[]; total: number }>;

  findById(id: number): Promise<ProductRecord | null>;

  /** All active products in the given verticals, unpaginated — backs the price index. */
  findAllActive(params: { verticalIds: number[] }): Promise<ProductRecord[]>;

  create(data: CreateProductInput): Promise<ProductRecord>;

  update(id: number, data: UpdateProductInput): Promise<ProductRecord>;

  /**
   * Sets or clears the picture, as a pair.
   *
   * Separate from [update] because `pictureUrl` is deliberately **not** an
   * admin-writable field: it names an object this API stores, so a free-text
   * body field would let a product point anywhere, and the blurhash beside it
   * is derived from the bytes rather than typed. Both are set here or by
   * nothing.
   */
  updatePicture(
    id: number,
    picture: { pictureUrl: string | null; pictureBlurhash: string | null }
  ): Promise<void>;

  /** What still points at this product. Empty ⇒ it can be deleted. */
  findReferences(id: number): Promise<ProductReferences>;

  /**
   * Deletes the product, but only while nothing references it (spec 0016 §6.2).
   *
   * Returns the blocking references instead of deleting when there are any. The
   * check and the delete must be one transaction that has already locked the
   * product row — otherwise an order landing between them is deleted with it by
   * a cascade nobody chose.
   */
  deleteIfUnreferenced(id: number): Promise<ProductDeletionOutcome>;
}
