export interface BusinessVerticalRecord {
  id: number;
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

  findById(id: number): Promise<BusinessVerticalRecord | null>;

  create(data: { code: string; name: string; isActive?: boolean }): Promise<BusinessVerticalRecord>;

  update(
    id: number,
    data: { code?: string; name?: string; isActive?: boolean }
  ): Promise<BusinessVerticalRecord>;
}
