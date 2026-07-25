export interface BusinessVerticalRecord {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessVerticalRepository {
  findAll(params: {
    page: number;
    limit: number;
    isActive?: boolean;
  }): Promise<{ verticals: BusinessVerticalRecord[]; total: number }>;

  findById(id: string): Promise<BusinessVerticalRecord | null>;

  create(data: { code: string; name: string; isActive?: boolean }): Promise<BusinessVerticalRecord>;

  update(
    id: string,
    data: { code?: string; name?: string; isActive?: boolean }
  ): Promise<BusinessVerticalRecord>;
}
