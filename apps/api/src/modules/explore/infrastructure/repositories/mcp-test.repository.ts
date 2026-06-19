import { prisma } from "../../../../infrastructure/database/prisma.client";
import {
  formatLicenseEntries,
  formatLicenseLabel,
  type LicenseParts,
} from "../../application/license-resolver";
import {
  resolveOccupationCodes,
  resolveOccupationName,
} from "../../application/occupation-resolver";
import type {
  FacilityDto,
  FacilityProfessionalLink,
  PaginatedResult,
  ProfessionalDto,
} from "../../application/types/explore.types";

interface ListParams {
  page: number;
  limit: number;
  search?: string;
  stateCodes?: string[];
  cities?: string[];
  facilityTypes?: string[];
}

const FACILITY_LIST_SELECT = `
  f.facility_id,
  f.cnes_code,
  f.legal_name,
  f.trade_name,
  f.street_address || COALESCE(', ' || f.street_number, '') AS full_address,
  f.neighborhood,
  f.postal_code,
  m.municipality_name,
  s.state_code,
  s.state_name,
  f.phone_number,
  f.email,
  f.website_url,
  f.latitude,
  f.longitude,
  ft.facility_type_name AS facility_type,
  f.facility_type_code,
  f.unit_type_code,
  f.unit_type_name,
  f.unit_subtype_name,
  (f.deactivation_reason_code IS NULL) AS is_active,
  (SELECT COUNT(*)::int
   FROM mcp_test.facility_professionals fp
   WHERE fp.facility_id = f.facility_id
     AND fp.termination_date IS NULL) AS professional_count
`;

const FACILITY_FROM = `
  FROM mcp_test.facilities f
  JOIN mcp_test.municipalities m ON f.municipality_id = m.municipality_id
  JOIN mcp_test.states s ON m.state_code = s.state_code
  LEFT JOIN mcp_test.facility_types ft ON f.facility_type_code = ft.facility_type_code
`;

function buildPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function mapFacilityRow(row: Record<string, unknown>): FacilityDto {
  const dto: FacilityDto = {
    facilityId: String(row.facility_id),
    cnesCode: row.cnes_code ? String(row.cnes_code) : null,
    legalName: row.legal_name ? String(row.legal_name) : null,
    tradeName: row.trade_name ? String(row.trade_name) : null,
    fullAddress: row.full_address ? String(row.full_address) : null,
    neighborhood: row.neighborhood ? String(row.neighborhood) : null,
    postalCode: row.postal_code ? String(row.postal_code) : null,
    municipalityName: row.municipality_name ? String(row.municipality_name) : null,
    stateCode: row.state_code ? String(row.state_code) : null,
    stateName: row.state_name ? String(row.state_name) : null,
    phoneNumber: row.phone_number ? String(row.phone_number) : null,
    email: row.email ? String(row.email) : null,
    websiteUrl: row.website_url ? String(row.website_url) : null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    facilityType: row.facility_type ? String(row.facility_type) : null,
    facilityTypeCode: row.facility_type_code ? String(row.facility_type_code) : null,
    unitTypeCode: row.unit_type_code ? String(row.unit_type_code) : null,
    unitTypeName: row.unit_type_name ? String(row.unit_type_name) : null,
    unitSubtypeName: row.unit_subtype_name ? String(row.unit_subtype_name) : null,
    professionalCount: Number(row.professional_count ?? 0),
    isActive: row.is_active === true || row.is_active === "t",
  };

  if (row.tax_id_cnpj) dto.taxIdCnpj = String(row.tax_id_cnpj);
  if (row.tax_id_cpf) dto.taxIdCpf = String(row.tax_id_cpf);
  if (row.is_24_7 != null) dto.is24_7 = Boolean(row.is_24_7);
  if (row.is_philanthropic != null) dto.isPhilanthropic = Boolean(row.is_philanthropic);
  if (row.has_internet != null) dto.hasInternet = Boolean(row.has_internet);
  if (row.created_at) dto.createdAt = String(row.created_at);

  return dto;
}

const LICENSE_ENTRIES_SUBQUERY = `
  (SELECT COALESCE(
     json_agg(DISTINCT jsonb_build_object(
       'councilCode', pw.professional_council_code,
       'councilName', d.valor,
       'licenseState', pw.license_state,
       'licenseNumber', pw.license_number
     )) FILTER (WHERE pw.license_number IS NOT NULL),
     '[]'::json
   )
   FROM mcp_test.professional_workload pw
   LEFT JOIN br_ms_cnes.dicionario d
     ON d.id_tabela = 'profissional'
    AND d.nome_coluna = 'tipo_conselho'
    AND d.chave = pw.professional_council_code
   WHERE pw.professional_id = p.professional_id) AS license_entries
`;

function parseLicenseEntries(raw: unknown): LicenseParts[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry): LicenseParts | null => {
      if (!entry || typeof entry !== "object") return null;

      const record = entry as Record<string, unknown>;
      const licenseNumber = record.licenseNumber ?? record.license_number;
      if (licenseNumber == null || String(licenseNumber).trim() === "") {
        return null;
      }

      return {
        councilCode:
          record.councilCode != null
            ? String(record.councilCode)
            : record.council_code != null
              ? String(record.council_code)
              : null,
        councilName:
          record.councilName != null
            ? String(record.councilName)
            : record.council_name != null
              ? String(record.council_name)
              : null,
        licenseState:
          record.licenseState != null
            ? String(record.licenseState)
            : record.license_state != null
              ? String(record.license_state)
              : null,
        licenseNumber: String(licenseNumber),
      };
    })
    .filter((entry): entry is LicenseParts => entry != null);
}

function mapProfessionalRow(row: Record<string, unknown>): ProfessionalDto {
  const licenseEntries = parseLicenseEntries(row.license_entries);

  return {
    professionalId: String(row.professional_id),
    fullName: String(row.full_name),
    socialName: row.social_name ? String(row.social_name) : null,
    taxId: row.tax_id ? String(row.tax_id) : null,
    healthCardNumber: row.health_card_number ? String(row.health_card_number) : null,
    activeFacilitiesCount: Number(row.active_facilities_count ?? 0),
    currentFacilities: row.current_facilities ? String(row.current_facilities) : null,
    currentLocations: row.current_locations ? String(row.current_locations) : null,
    licenses:
      formatLicenseEntries(licenseEntries) ??
      (row.licenses ? String(row.licenses) : null),
    councils: row.councils ? String(row.councils) : null,
    occupationCodes: row.occupation_codes ? String(row.occupation_codes) : null,
    occupationLabels: resolveOccupationCodes(
      row.occupation_codes ? String(row.occupation_codes) : null,
    ),
    activePositions: Number(row.active_positions ?? 0),
    totalWeeklyHours:
      row.total_weekly_hours != null ? Number(row.total_weekly_hours) : null,
    isPreceptor: Number(row.is_preceptor ?? 0) > 0,
    isResident: Number(row.is_resident ?? 0) > 0,
    lastEmploymentUpdate: row.last_employment_update
      ? String(row.last_employment_update)
      : null,
    lastWorkloadUpdate: row.last_workload_update
      ? String(row.last_workload_update)
      : null,
  };
}

export class McpTestRepository {
  private resolveSearchPattern(search?: string): string | null {
    const value = search?.trim();
    if (!value || value.length < 2) return null;
    return `%${value}%`;
  }

  async listFacilities(params: ListParams): Promise<PaginatedResult<FacilityDto>> {
    const { page, limit } = params;
    const offset = (page - 1) * limit;
    const pattern = this.resolveSearchPattern(params.search);
    const stateCodes = params.stateCodes ?? [];
    const cities = params.cities ?? [];
    const facilityTypes = params.facilityTypes ?? [];

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      SELECT ${FACILITY_LIST_SELECT}
      ${FACILITY_FROM}
      WHERE ($1::text IS NULL OR (
           f.trade_name ILIKE $1
        OR f.legal_name ILIKE $1
        OR f.neighborhood ILIKE $1
        OR m.municipality_name ILIKE $1))
        AND (cardinality($4::text[]) = 0 OR s.state_code = ANY($4))
        AND (cardinality($6::text[]) = 0 OR m.municipality_name = ANY($6))
        AND (
          cardinality($5::text[]) = 0
          OR ft.facility_type_name = ANY($5)
          OR f.unit_type_name = ANY($5)
        )
        AND (
          $1::text IS NOT NULL
          OR f.facility_id IN (
            SELECT DISTINCT fp.facility_id
            FROM mcp_test.facility_professionals fp
            WHERE fp.termination_date IS NULL
          )
        )
      ORDER BY professional_count DESC, f.trade_name NULLS LAST
      LIMIT $2 OFFSET $3
      `,
      pattern,
      limit,
      offset,
      stateCodes,
      facilityTypes,
      cities,
    );

    return {
      data: rows.map(mapFacilityRow),
      pagination: buildPagination(
        page,
        limit,
        rows.length < limit ? offset + rows.length : offset + limit + 1,
      ),
    };
  }

  async listFacilityFilterOptions() {
    const [states, facilityTypes] = await Promise.all([
      prisma.$queryRaw<Array<{ state_code: string; state_name: string }>>`
        SELECT DISTINCT s.state_code, s.state_name
        FROM mcp_test.states s
        ORDER BY s.state_name
      `,
      prisma.$queryRaw<Array<{ facility_type: string }>>`
        SELECT DISTINCT ft.facility_type_name AS facility_type
        FROM mcp_test.facility_types ft
        WHERE ft.facility_type_name IS NOT NULL
        ORDER BY ft.facility_type_name
        LIMIT 40
      `,
    ]);

    return {
      states: states.map((row) => ({
        code: row.state_code,
        name: row.state_name,
      })),
      facilityTypes: facilityTypes
        .map((row) => row.facility_type)
        .filter((value): value is string => Boolean(value)),
    };
  }

  async listFacilityCities(params: {
    search?: string;
    stateCodes?: string[];
    limit?: number;
  }) {
    const search = params.search?.trim();
    const pattern = search && search.length >= 1 ? `%${search}%` : null;
    const stateCodes = params.stateCodes ?? [];
    const limit = Math.min(Math.max(params.limit ?? 40, 1), 50);

    const rows = await prisma.$queryRawUnsafe<
      Array<{ municipality_name: string; state_code: string }>
    >(
      `
      SELECT DISTINCT m.municipality_name, s.state_code
      FROM mcp_test.municipalities m
      JOIN mcp_test.states s ON s.state_code = m.state_code
      JOIN mcp_test.facilities f ON f.municipality_id = m.municipality_id
      WHERE EXISTS (
        SELECT 1
        FROM mcp_test.facility_professionals fp
        WHERE fp.facility_id = f.facility_id
          AND fp.termination_date IS NULL
      )
      AND ($1::text IS NULL OR m.municipality_name ILIKE $1)
      AND (cardinality($2::text[]) = 0 OR s.state_code = ANY($2))
      ORDER BY m.municipality_name
      LIMIT $3
      `,
      pattern,
      stateCodes,
      limit,
    );

    return {
      cities: rows.map((row) => ({
        name: row.municipality_name,
        stateCode: row.state_code,
      })),
    };
  }

  async getFacility(facilityId: string): Promise<FacilityDto | null> {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      SELECT ${FACILITY_LIST_SELECT},
             f.tax_id_cnpj,
             f.tax_id_cpf,
             f.is_24_7,
             f.is_philanthropic,
             f.has_internet,
             f.created_at
      ${FACILITY_FROM}
      WHERE f.facility_id = $1
      LIMIT 1
      `,
      facilityId,
    );

    if (!rows[0]) return null;

    const professionals = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT *
      FROM (
        SELECT DISTINCT ON (p.professional_id)
               p.professional_id,
               p.full_name,
               fp.occupation_code,
               fp.employment_type_code,
               pw.professional_council_code AS council_code,
               d.valor AS council_name,
               pw.license_number,
               COALESCE(
                 pw.license_state,
                 (SELECT pw2.license_state
                  FROM mcp_test.professional_workload pw2
                  WHERE pw2.professional_id = p.professional_id
                    AND pw2.professional_council_code = pw.professional_council_code
                    AND pw2.license_number = pw.license_number
                    AND pw2.license_state IS NOT NULL
                  LIMIT 1)
               ) AS license_state,
               pw.weekly_hours_ambulatory
        FROM mcp_test.facility_professionals fp
        JOIN mcp_test.professionals p ON p.professional_id = fp.professional_id
        LEFT JOIN mcp_test.professional_workload pw
          ON pw.facility_id = fp.facility_id
         AND pw.professional_id = fp.professional_id
        LEFT JOIN br_ms_cnes.dicionario d
          ON d.id_tabela = 'profissional'
         AND d.nome_coluna = 'tipo_conselho'
         AND d.chave = pw.professional_council_code
        WHERE fp.facility_id = ${facilityId}
          AND fp.termination_date IS NULL
        ORDER BY p.professional_id, pw.license_state NULLS LAST, p.full_name
      ) linked_professionals
      ORDER BY full_name
      LIMIT 50
    `;

    const facility = mapFacilityRow(rows[0]);
    facility.professionals = professionals.map(
      (row): FacilityProfessionalLink => ({
        professionalId: String(row.professional_id),
        fullName: String(row.full_name),
        occupationCode: String(row.occupation_code),
        occupationName: resolveOccupationName(String(row.occupation_code)),
        employmentTypeCode: row.employment_type_code
          ? String(row.employment_type_code)
          : null,
        councilCode: row.council_code ? String(row.council_code) : null,
        councilName: row.council_name ? String(row.council_name) : null,
        licenseNumber: row.license_number ? String(row.license_number) : null,
        licenseState: row.license_state ? String(row.license_state) : null,
        licenseLabel: formatLicenseLabel({
          councilCode: row.council_code ? String(row.council_code) : null,
          councilName: row.council_name ? String(row.council_name) : null,
          licenseState: row.license_state ? String(row.license_state) : null,
          licenseNumber: row.license_number ? String(row.license_number) : null,
        }),
        weeklyHoursAmbulatory:
          row.weekly_hours_ambulatory != null
            ? Number(row.weekly_hours_ambulatory)
            : null,
      }),
    );

    return facility;
  }

  async listProfessionals(params: ListParams): Promise<PaginatedResult<ProfessionalDto>> {
    const pattern = this.resolveSearchPattern(params.search);
    if (!pattern) {
      return this.listLinkedProfessionals(params);
    }
    return this.searchProfessionals(params, pattern);
  }

  private async listLinkedProfessionals(
    params: ListParams,
  ): Promise<PaginatedResult<ProfessionalDto>> {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      SELECT p.professional_id,
             p.full_name,
             p.social_name,
             p.tax_id,
             p.health_card_number,
             COUNT(DISTINCT fp.facility_id)::int AS active_facilities_count,
             string_agg(
               DISTINCT COALESCE(f.trade_name, f.legal_name),
               ', ' ORDER BY COALESCE(f.trade_name, f.legal_name)
             ) AS current_facilities,
             string_agg(
               DISTINCT m.municipality_name || ' - ' || s.state_code,
               ', '
             ) AS current_locations,
             ${LICENSE_ENTRIES_SUBQUERY},
             string_agg(DISTINCT fp.occupation_code, ', ') AS occupation_codes,
             COUNT(DISTINCT fp.facility_id)::int AS active_positions,
             (SELECT SUM(pw.weekly_hours_ambulatory)
              FROM mcp_test.professional_workload pw
              WHERE pw.professional_id = p.professional_id) AS total_weekly_hours,
             0 AS is_preceptor,
             0 AS is_resident,
             NULL::text AS last_employment_update,
             NULL::text AS last_workload_update
      FROM mcp_test.professionals p
      JOIN mcp_test.facility_professionals fp
        ON fp.professional_id = p.professional_id
       AND fp.termination_date IS NULL
      JOIN mcp_test.facilities f ON f.facility_id = fp.facility_id
      JOIN mcp_test.municipalities m ON m.municipality_id = f.municipality_id
      JOIN mcp_test.states s ON s.state_code = m.state_code
      GROUP BY p.professional_id, p.full_name, p.social_name, p.tax_id, p.health_card_number
      ORDER BY active_facilities_count DESC, p.full_name
      LIMIT $1 OFFSET $2
      `,
      limit,
      offset,
    );

    return {
      data: rows.map(mapProfessionalRow),
      pagination: buildPagination(
        page,
        limit,
        rows.length < limit ? offset + rows.length : offset + limit + 1,
      ),
    };
  }

  private async searchProfessionals(
    params: ListParams,
    pattern: string,
  ): Promise<PaginatedResult<ProfessionalDto>> {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      SELECT p.professional_id,
             p.full_name,
             p.social_name,
             p.tax_id,
             p.health_card_number,
             (SELECT COUNT(*)::int
              FROM mcp_test.facility_professionals fp
              WHERE fp.professional_id = p.professional_id
                AND fp.termination_date IS NULL) AS active_facilities_count,
             (SELECT string_agg(DISTINCT COALESCE(f.trade_name, f.legal_name), ', ' ORDER BY COALESCE(f.trade_name, f.legal_name))
              FROM mcp_test.facility_professionals fp
              JOIN mcp_test.facilities f ON f.facility_id = fp.facility_id
              WHERE fp.professional_id = p.professional_id
                AND fp.termination_date IS NULL) AS current_facilities,
             (SELECT string_agg(DISTINCT m.municipality_name || ' - ' || s.state_code, ', ')
              FROM mcp_test.facility_professionals fp
              JOIN mcp_test.facilities f ON f.facility_id = fp.facility_id
              JOIN mcp_test.municipalities m ON m.municipality_id = f.municipality_id
              JOIN mcp_test.states s ON s.state_code = m.state_code
              WHERE fp.professional_id = p.professional_id
                AND fp.termination_date IS NULL) AS current_locations,
             ${LICENSE_ENTRIES_SUBQUERY},
             (SELECT string_agg(DISTINCT fp.occupation_code, ', ')
              FROM mcp_test.facility_professionals fp
              WHERE fp.professional_id = p.professional_id
                AND fp.termination_date IS NULL) AS occupation_codes,
             (SELECT COUNT(*)::int
              FROM mcp_test.facility_professionals fp
              WHERE fp.professional_id = p.professional_id
                AND fp.termination_date IS NULL) AS active_positions,
             (SELECT SUM(pw.weekly_hours_ambulatory)
              FROM mcp_test.professional_workload pw
              WHERE pw.professional_id = p.professional_id) AS total_weekly_hours,
             0 AS is_preceptor,
             0 AS is_resident,
             NULL::text AS last_employment_update,
             NULL::text AS last_workload_update
      FROM mcp_test.professionals p
      WHERE p.full_name ILIKE $1
      ORDER BY active_facilities_count DESC, p.full_name
      LIMIT $2 OFFSET $3
      `,
      pattern,
      limit,
      offset,
    );

    return {
      data: rows.map(mapProfessionalRow),
      pagination: buildPagination(
        page,
        limit,
        rows.length < limit ? offset + rows.length : offset + limit + 1,
      ),
    };
  }

  async getProfessional(professionalId: string): Promise<ProfessionalDto | null> {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      SELECT p.professional_id,
             p.full_name,
             p.social_name,
             p.tax_id,
             p.health_card_number,
             (SELECT COUNT(*)::int
              FROM mcp_test.facility_professionals fp
              WHERE fp.professional_id = p.professional_id
                AND fp.termination_date IS NULL) AS active_facilities_count,
             (SELECT string_agg(DISTINCT COALESCE(f.trade_name, f.legal_name), ', ' ORDER BY COALESCE(f.trade_name, f.legal_name))
              FROM mcp_test.facility_professionals fp
              JOIN mcp_test.facilities f ON f.facility_id = fp.facility_id
              WHERE fp.professional_id = p.professional_id
                AND fp.termination_date IS NULL) AS current_facilities,
             (SELECT string_agg(DISTINCT m.municipality_name || ' - ' || s.state_code, ', ')
              FROM mcp_test.facility_professionals fp
              JOIN mcp_test.facilities f ON f.facility_id = fp.facility_id
              JOIN mcp_test.municipalities m ON m.municipality_id = f.municipality_id
              JOIN mcp_test.states s ON s.state_code = m.state_code
              WHERE fp.professional_id = p.professional_id
                AND fp.termination_date IS NULL) AS current_locations,
             ${LICENSE_ENTRIES_SUBQUERY},
             (SELECT string_agg(DISTINCT fp.occupation_code, ', ')
              FROM mcp_test.facility_professionals fp
              WHERE fp.professional_id = p.professional_id
                AND fp.termination_date IS NULL) AS occupation_codes,
             (SELECT COUNT(*)::int
              FROM mcp_test.facility_professionals fp
              WHERE fp.professional_id = p.professional_id
                AND fp.termination_date IS NULL) AS active_positions,
             (SELECT SUM(pw.weekly_hours_ambulatory)
              FROM mcp_test.professional_workload pw
              WHERE pw.professional_id = p.professional_id) AS total_weekly_hours,
             0 AS is_preceptor,
             0 AS is_resident,
             NULL::text AS last_employment_update,
             NULL::text AS last_workload_update
      FROM mcp_test.professionals p
      WHERE p.professional_id = $1
      LIMIT 1
      `,
      professionalId,
    );

    if (!rows[0]) return null;

    const links = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
      SELECT DISTINCT ON (fp.facility_id)
             fp.facility_id,
             f.trade_name,
             m.municipality_name,
             fp.occupation_code,
             fp.employment_type_code,
             pw.weekly_hours_ambulatory
      FROM mcp_test.facility_professionals fp
      JOIN mcp_test.facilities f ON f.facility_id = fp.facility_id
      JOIN mcp_test.municipalities m ON m.municipality_id = f.municipality_id
      LEFT JOIN mcp_test.professional_workload pw
        ON pw.facility_id = fp.facility_id
       AND pw.professional_id = fp.professional_id
      WHERE fp.professional_id = $1
        AND fp.termination_date IS NULL
      ORDER BY fp.facility_id, f.trade_name NULLS LAST
      LIMIT 50
      `,
      professionalId,
    );

    const professional = mapProfessionalRow(rows[0]);
    professional.facilityLinks = links.map((row) => ({
      facilityId: String(row.facility_id),
      tradeName: row.trade_name ? String(row.trade_name) : null,
      municipalityName: row.municipality_name ? String(row.municipality_name) : null,
      occupationCode: String(row.occupation_code),
      occupationName: resolveOccupationName(String(row.occupation_code)),
      employmentTypeCode: row.employment_type_code
        ? String(row.employment_type_code)
        : null,
      weeklyHoursAmbulatory:
        row.weekly_hours_ambulatory != null
          ? Number(row.weekly_hours_ambulatory)
          : null,
    }));

    return professional;
  }
}
