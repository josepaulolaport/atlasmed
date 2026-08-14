/**
 * Shared shape for the CNES import list (spec 0015 §6.1.1).
 *
 * Pure, like every other module in this package: the mapping and the SQL
 * fragments live here so the worker's full rebuild and the API's single-document
 * upsert cannot drift apart, and each supplies its own database handle. A field
 * added to the document and to the index settings while only one writer
 * populates it fails in the worst direction available — the attribute is
 * filterable, every document has it empty, and matching clinics silently vanish
 * from the list instead of erroring.
 */

/**
 * The CNES import list (spec 0015 §6.1.1).
 *
 * A separate index over `registry.facilities`, not the `facilities` index and
 * not SQL. Explorar's clinic list is a rep's *working set* of ~1 442 rows;
 * folding ~373 000 national candidates into it would destroy the primary use to
 * serve an occasional one. So the candidates live behind their own surface, with
 * their own index.
 *
 * **One index covers both halves of the list.** Since migration 0106 every
 * facility carries a NOT NULL `cnes_code`, and this spec mirrors every
 * establishment, so `registry.facilities` is a superset of `public.facilities`.
 * Denormalising the linked facility's `verticalIds` onto the registry document
 * turns the whole list into a single filter, with no union and no merged
 * pagination:
 *
 * ```
 * imported = false            → never imported by anybody
 * OR verticalIds NOT IN [...] → ours, but invisible to this user's verticals
 * ```
 */
export interface FacilityCandidateDocument extends Record<string, unknown> {
  /** `CO_CNES`. The natural key, unique across all 631 973 establishments. */
  id: string;
  cnesCode: string;
  name: string;
  legalName: string | null;
  tradeName: string | null;
  legalDocument: string | null;
  legalDocumentType: "CNPJ" | "CPF" | null;
  maintainerTaxId: string | null;
  municipality: string | null;
  municipalityId: number | null;
  municipalityCnesId: string | null;
  state: string | null;
  stateId: number | null;
  neighborhood: string | null;
  streetAddress: string | null;
  streetNumber: string | null;
  postalCode: string | null;
  unitTypeCode: string | null;
  unitTypeId: number | null;
  unitTypeName: string | null;
  unitSubtypeCode: string | null;
  /**
   * Whether we already hold this establishment. Kept as a boolean rather than
   * relying on `atlasmedId NOT EXISTS`, because a filter that depends on a field
   * being absent breaks the moment somebody writes a null into it.
   */
  imported: boolean;
  atlasmedId: number | null;
  /** Verticals whose profile already covers the linked facility. Empty when new. */
  verticalIds: number[];
  _geo?: { lat: number; lng: number };
}

export const FACILITY_CANDIDATE_SETTINGS = {
  searchableAttributes: [
    "name",
    "tradeName",
    "legalName",
    "cnesCode",
    "legalDocument",
    "municipality",
    "neighborhood",
    "streetAddress",
  ],
  filterableAttributes: [
    "cnesCode",
    "imported",
    "verticalIds",
    "unitTypeId",
    "unitTypeCode",
    "legalDocumentType",
    "municipalityId",
    "municipalityCnesId",
    "stateId",
    "state",
    "_geo",
  ],
  /**
   * Relevance first, distance as the tiebreak. A rep standing outside a clinic
   * knows its name; sorting by distance first would bury an exact name match
   * under whatever happens to be nearby.
   */
  sortableAttributes: ["_geo", "name", "id"],
  rankingRules: ["sort", "words", "typo", "proximity", "attribute", "exactness"],
};

export interface CandidateRow {
  cnes_id: string;
  atlasmed_id: number | null;
  legal_name: string | null;
  trade_name: string | null;
  tax_id_cnpj: string | null;
  tax_id_cpf: string | null;
  legal_person_type: string | null;
  maintainer_tax_id: string | null;
  street_address: string | null;
  street_number: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  latitude: string | null;
  longitude: string | null;
  unit_type_code: string | null;
  unit_subtype_code: string | null;
  unit_type_atlasmed_id: number | null;
  unit_type_name: string | null;
  municipality_name: string | null;
  municipality_atlasmed_id: number | null;
  municipality_cnes_id: string | null;
  state_abbrev: string | null;
  state_atlasmed_id: number | null;
  vertical_ids: number[] | null;
}

/**
 * `TP_PFPJ` decides the document type, never a guess about which of the two
 * columns happened to be filled (spec 0015 §4.6). `1` = pessoa física.
 */
function legalDocumentOf(row: CandidateRow): {
  legalDocument: string | null;
  legalDocumentType: "CNPJ" | "CPF" | null;
} {
  if (row.legal_person_type === "1") {
    return { legalDocument: row.tax_id_cpf, legalDocumentType: "CPF" };
  }
  if (row.legal_person_type === "3") {
    /*
     * A pessoa jurídica with no CNPJ is not a missing value: 119 415
     * establishments — almost all public units under a prefeitura — have none of
     * their own, and only the mantenedora's. Null here is the accurate record.
     */
    return { legalDocument: row.tax_id_cnpj, legalDocumentType: "CNPJ" };
  }
  return { legalDocument: row.tax_id_cnpj ?? row.tax_id_cpf, legalDocumentType: null };
}

export function buildFacilityCandidateDocument(
  row: CandidateRow
): FacilityCandidateDocument {
  const { legalDocument, legalDocumentType } = legalDocumentOf(row);
  const lat = row.latitude === null ? null : Number(row.latitude);
  const lng = row.longitude === null ? null : Number(row.longitude);

  return {
    id: row.cnes_id,
    cnesCode: row.cnes_id,
    // The trade name is what anybody would search for; the razão social is the
    // one on the paperwork. Falling back the other way makes a clinic
    // unfindable under the name on its door.
    name: row.trade_name ?? row.legal_name ?? row.cnes_id,
    legalName: row.legal_name,
    tradeName: row.trade_name,
    legalDocument,
    legalDocumentType,
    maintainerTaxId: row.maintainer_tax_id,
    municipality: row.municipality_name,
    municipalityId: row.municipality_atlasmed_id,
    municipalityCnesId: row.municipality_cnes_id,
    state: row.state_abbrev,
    stateId: row.state_atlasmed_id,
    neighborhood: row.neighborhood,
    streetAddress: row.street_address,
    streetNumber: row.street_number,
    postalCode: row.postal_code,
    unitTypeCode: row.unit_type_code,
    unitTypeId: row.unit_type_atlasmed_id,
    unitTypeName: row.unit_type_name,
    unitSubtypeCode: row.unit_subtype_code,
    imported: row.atlasmed_id !== null,
    atlasmedId: row.atlasmed_id,
    verticalIds: row.vertical_ids ?? [],
    ...(lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)
      ? { _geo: { lat, lng } }
      : {}),
  };
}

/**
 * Which establishments get a document.
 *
 * `(allowlisted type AND active) OR already ours`. The second clause is
 * load-bearing and reads like a redundant OR: without it the nine type-60
 * facilities we hold would have no document, and a user who legitimately needs a
 * profile on one would have no way to reach it — type 60 is not importable, so
 * the first clause can never cover them.
 */
export const FACILITY_CANDIDATE_MEMBERSHIP = `(
  (rut.atlasmed_id is not null and rf.deactivation_reason_code is null)
  or rf.atlasmed_id is not null
)`;

export const FACILITY_CANDIDATE_COLUMNS = `
  rf.cnes_id, rf.atlasmed_id, rf.legal_name, rf.trade_name,
  rf.tax_id_cnpj, rf.tax_id_cpf, rf.legal_person_type, rf.maintainer_tax_id,
  rf.street_address, rf.street_number, rf.neighborhood, rf.postal_code,
  rf.latitude::text as latitude, rf.longitude::text as longitude,
  rf.unit_type_code, rf.unit_subtype_code,
  rut.atlasmed_id as unit_type_atlasmed_id, rut.name as unit_type_name,
  rm.name as municipality_name, rm.atlasmed_id as municipality_atlasmed_id,
  rf.municipality_cnes_id,
  rs.cnes_id as state_abbrev, rs.atlasmed_id as state_atlasmed_id,
  (
    select coalesce(array_agg(p.vertical_id order by p.vertical_id), '{}')
      from facility_vertical_profiles p
     where p.facility_id = rf.atlasmed_id and p.is_active
  ) as vertical_ids
`;

export const FACILITY_CANDIDATE_JOINS = `
  from registry.facilities rf
  left join registry.unit_types rut on rut.cnes_id = rf.unit_type_code
  left join registry.municipalities rm on rm.cnes_id = rf.municipality_cnes_id
  left join registry.states rs on rs.cnes_id = rm.state_cnes_id
`;
