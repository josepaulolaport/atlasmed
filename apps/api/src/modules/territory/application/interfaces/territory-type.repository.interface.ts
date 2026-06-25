export interface TerritoryTypeRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  canHaveBoundary: boolean;
  assignsClinics: boolean;
  assignableToUsers: boolean;
  assignableToManagers: boolean;
  isCountryLevel: boolean;
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
  assignsClinics?: boolean;
  assignableToUsers?: boolean;
  assignableToManagers?: boolean;
  isCountryLevel?: boolean;
  blockSiblingOverlap?: boolean;
  sortOrder?: number;
}

export interface UpdateTerritoryTypeInput {
  name?: string;
  description?: string | null;
  canHaveBoundary?: boolean;
  assignsClinics?: boolean;
  assignableToUsers?: boolean;
  assignableToManagers?: boolean;
  isCountryLevel?: boolean;
  blockSiblingOverlap?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface TerritoryTypeRepository {
  findById(id: string): Promise<TerritoryTypeRecord | null>;
  findBySlug(slug: string): Promise<TerritoryTypeRecord | null>;
  findAll(activeOnly?: boolean): Promise<TerritoryTypeRecord[]>;
  create(input: CreateTerritoryTypeInput): Promise<TerritoryTypeRecord>;
  update(id: string, input: UpdateTerritoryTypeInput): Promise<TerritoryTypeRecord>;
  countTerritoriesUsingType(id: string): Promise<number>;
}
