export interface ProductRecord {
  id: string;
  code: string;
  name: string;
  sectorId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductRepository {
  findAll(params: {
    page: number;
    limit: number;
    sectorId?: string;
    isActive?: boolean;
  }): Promise<{ products: ProductRecord[]; total: number }>;

  findById(id: string): Promise<ProductRecord | null>;

  create(data: {
    code: string;
    name: string;
    sectorId: string;
    isActive?: boolean;
  }): Promise<ProductRecord>;

  update(
    id: string,
    data: { code?: string; name?: string; sectorId?: string; isActive?: boolean }
  ): Promise<ProductRecord>;
}
