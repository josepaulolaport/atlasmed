export type PersonFacilityRoleCatalogEntry = {
  id: number;
  name: string;
  isActive: boolean;
};

export interface PersonFacilityRoleCatalogRepository {
  /** Active catalog rows, stable order by name. */
  listActive(): Promise<PersonFacilityRoleCatalogEntry[]>;
}
