export interface ProductRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  commercialCode: string | null;
  productGroup: string | null;
  productClassification: string | null;
  brand: string | null;
  unit: string | null;
  sectorIds: string[];
  pictureUrl: string | null;
  simproCode: string;
  brasindiceCode: string;
  tissCode: string;
  manufacturer: string;
  countryOfOrigin: string;
  price: number;
  price17: number;
  price18: number;
  price20: number;
  brasindiceUpdatedAt: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductRepository {
  findAll(params: {
    page: number;
    limit: number;
    sectorId?: string;
    search?: string;
    isActive?: boolean;
  }): Promise<{ products: ProductRecord[]; total: number }>;

  findById(id: string): Promise<ProductRecord | null>;

  create(data: {
    code: string;
    name: string;
    sectorIds: string[];
    pictureUrl?: string | null;
    simproCode: string;
    brasindiceCode: string;
    tissCode: string;
    manufacturer: string;
    countryOfOrigin: string;
    price: number;
    price17: number;
    price18: number;
    price20: number;
    brasindiceUpdatedAt: string;
    isActive?: boolean;
  }): Promise<ProductRecord>;

  update(
    id: string,
    data: {
      code?: string;
      name?: string;
      sectorIds?: string[];
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
