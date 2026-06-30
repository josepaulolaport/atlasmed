export interface SectorRecord {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SectorRepository {
  findAll(params: {
    page: number;
    limit: number;
    isActive?: boolean;
  }): Promise<{ sectors: SectorRecord[]; total: number }>;

  findById(id: string): Promise<SectorRecord | null>;

  create(data: { slug: string; name: string; isActive?: boolean }): Promise<SectorRecord>;

  update(
    id: string,
    data: { slug?: string; name?: string; isActive?: boolean }
  ): Promise<SectorRecord>;
}
