export interface TerritoryTypeRecord {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  canHaveBoundary: boolean;
  blockSiblingOverlap: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTerritoryTypeInput {
  slug: string;
  name: string;
  description?: string | null;
  canHaveBoundary?: boolean;
  blockSiblingOverlap?: boolean;
  sortOrder?: number;
}

export interface UpdateTerritoryTypeInput {
  name?: string;
  description?: string | null;
  canHaveBoundary?: boolean;
  blockSiblingOverlap?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface TerritoryTypeRepository {
  findById(id: number): Promise<TerritoryTypeRecord | null>;
  findBySlug(slug: string): Promise<TerritoryTypeRecord | null>;
  findAll(activeOnly?: boolean): Promise<TerritoryTypeRecord[]>;
  create(input: CreateTerritoryTypeInput): Promise<TerritoryTypeRecord>;
  update(id: number, input: UpdateTerritoryTypeInput): Promise<TerritoryTypeRecord>;
  countTerritoriesUsingType(id: number): Promise<number>;
}
