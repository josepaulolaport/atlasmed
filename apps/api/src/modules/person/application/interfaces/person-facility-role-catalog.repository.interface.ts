export type PersonFacilityRoleCatalogEntry = {
  code: string;
  name: string;
};

export interface PersonFacilityRoleCatalogRepository {
  /** Active catalog rows, stable order by code. */
  listActive(): Promise<PersonFacilityRoleCatalogEntry[]>;
}
