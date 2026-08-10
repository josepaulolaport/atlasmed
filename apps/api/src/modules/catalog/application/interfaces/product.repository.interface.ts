export interface ProductRecord {
  id: number;
  code: string;
  name: string;
  description: string | null;
  commercialCode: string | null;
  productGroup: string | null;
  productClassification: string | null;
  brand: string | null;
  unit: string | null;
  verticalIds: number[];
  pictureUrl: string | null;
  /** Null when the product has no pricing-table code — see spec 0013 §2. */
  simproCode: string | null;
  brasindiceCode: string | null;
  tissCode: string | null;
  manufacturer: string;
  countryOfOrigin: string;
  price: number;
  price17: number;
  price18: number;
  price20: number;
  brasindiceUpdatedAt: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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

  create(data: {
    code: string;
    name: string;
    verticalIds: number[];
    pictureUrl?: string | null;
    simproCode?: string | null;
    brasindiceCode?: string | null;
    tissCode?: string | null;
    manufacturer: string;
    countryOfOrigin: string;
    price: number;
    price17: number;
    price18: number;
    price20: number;
    brasindiceUpdatedAt: string | null;
    isActive?: boolean;
  }): Promise<ProductRecord>;

  update(
    id: number,
    data: {
      code?: string;
      name?: string;
      verticalIds?: number[];
      pictureUrl?: string | null;
      simproCode?: string;
      brasindiceCode?: string;
      tissCode?: string;
      manufacturer?: string;
      countryOfOrigin?: string;
      price?: number;
      price17?: number;
      price18?: number;
      price20?: number;
      brasindiceUpdatedAt?: string;
      isActive?: boolean;
    }
  ): Promise<ProductRecord>;
}
