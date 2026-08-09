/** Minimal lookup for Fontes Pagadoras Ortopedia gate. */
export interface FacilityVerticalAccessRepository {
  findVerticalIdByCode(code: string): Promise<number | null>;

  hasActiveVerticalProfile(facilityId: number, verticalId: number): Promise<boolean>;
}
