/** Minimal lookup for Fontes Pagadoras Ortopedia gate. */
export interface FacilityVerticalAccessRepository {
  findVerticalIdByCode(code: string): Promise<string | null>;

  hasActiveVerticalProfile(facilityId: string, verticalId: string): Promise<boolean>;
}
