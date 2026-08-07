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

  create(data: {
    code?: string | null;
    name: string;
    manufacturer: string;
    brand?: string | null;
    countryOfOrigin: string;
    price17: number;
    price18: number;
    price20: number;
    brasindiceUpdatedAt: string;
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
      brasindiceUpdatedAt?: string;
      isActive?: boolean;
    }
  ): Promise<CompetitorProductRecord>;
}
