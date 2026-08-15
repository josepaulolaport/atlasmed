import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  facilities,
  registryFacilities,
  registryFacilityProfessionalOccupations,
  registryFacilityProfessionals,
  registryMunicipalities,
  registryOccupations,
  registryProfessionalCouncils,
  registryProfessionalRegistrations,
  registryProfessionals,
  registryStates,
  cnesCargaStaging,
  cnesProfessionalStaging,
  registryUnitTypes,
  registryUnitSubtypes,
  registryDeactivationReasons,
  type AnyDatabase,
} from "@atlasmed/database";
import {
  REQUIRED_COLUMNS,
  sourceFileName,
  type CnesReference,
  type CnesSourceName,
} from "../cnes-files";
import { directoryCnesSource, type CnesSource } from "../source";

/**
 * Scoped incremental load of the CNES export into `registry.*`.
 *
 * **Why incremental rather than load-and-swap.** The obvious design — build a
 * staging schema, validate, rename it over `registry` — destroys `atlasmed_id`
 * on every run. Those bridges are written by hand when a user associates a CNES
 * doctor with one of our people; they are the product, and freshly loaded rows
 * do not have them. So each table gets the strategy its content deserves:
 *
 * | Table | Strategy | Because |
 * |---|---|---|
 * | aux (councils, occupations, states, municipalities) | insert-new-only | a code missing from one month has not stopped existing |
 * | facilities | upsert | CNES attributes improve over time; the bridge must survive |
 * | professionals, registrations | insert + upsert attrs, **never delete** | absence ≠ departure, and deleting drops a hand-made bridge |
 * | facility_professionals, occupations | scoped delete + reinsert | the roster is a snapshot; stale links are worse than none |
 *
 * **Scope.** Only facilities we already operate (`public.facilities.cnes_code`
 * set, not deactivated), and only doctors — CBO `225*`. Doctors carry a usable
 * council registration ~100 % of the time; everyone else ~53 %, which is too
 * sparse to identify anyone by.
 */

export interface LoadRegistryOptions {
  db: AnyDatabase;
  reference: CnesReference;
  /** Where the CSVs come from. Defaults to `csvDir` on disk. */
  source?: CnesSource;
  /** Convenience for the smoke script and tests: extracted files in a directory. */
  csvDir?: string;
  onProgress?: (message: string, detail?: Record<string, unknown>) => void;
  /**
   * Rows between progress reports from inside the write loops. Defaults to
   * `PROGRESS_EVERY_ROWS`; tests lower it so they can assert the reports exist
   * without a fixture the size of a real competence.
   */
  progressEveryRows?: number;
  /**
   * Last gate before the roster is replaced. Throwing here aborts the run with
   * the old snapshot intact.
   *
   * The loader counts; the caller judges. Keeping the judgement out here is what
   * lets the rules change without touching the load, and lets the worker record
   * its verdict in `ingestion.cnes_runs` where the package has no business
   * writing.
   *
   * Note what the caller is asked to judge: whether *this* run read and wrote
   * coherently. Not whether it resembles last month — a clinic's roster changes
   * substantially month to month, so a rule built on that comparison refuses good
   * data.
   */
  beforePromote?: (summary: PromotionSummary) => Promise<void>;
}

/** What the run is about to write, offered for judgement before it writes it. */
export interface PromotionSummary {
  scopedFacilities: number;
  facilitiesUpserted: number;
  professionals: number;
  registrations: number;
  /** Facility↔professional rows the run is about to install. */
  vinculos: number;
  occupationLinks: number;
}

export interface LoadRegistryResult {
  scopedFacilities: number;
  facilitiesUpserted: number;
  /**
   * In scope but absent from `tbEstabelecimento` — almost always a wrong
   * `cnes_code` on our side. Such a clinic silently yields no suggestions, so the
   * count is the only signal the operator gets.
   */
  scopedFacilitiesMissingFromDump: number;
  /** Scoped, present, but carrying no CO_UNIDADE — carga cannot be joined to it. */
  scopedFacilitiesWithoutUnitCode: number;
  /** Gestor município blank or absent from the catalogue; stored as null. */
  facilitiesWithoutMunicipality: number;
  auxStates: number;
  auxMunicipalities: number;
  auxOccupations: number;
  auxUnitTypes: number;
  /** Rows written to `ingestion.carga_staging` for this competência. */
  cargaStaged: number;
  /** Rows kept in `ingestion.professional_staging` after pruning. */
  professionalsStaged: number;
  /** Distinct people the staged vínculos refer to. */
  professionalsReferenced: number;
  /** `rlEstabSubTipo` rows linked onto an establishment. */
  establishmentSubtypes: number;
  auxUnitSubtypes: number;
  auxDeactivationReasons: number;
  auxCouncils: number;
  professionalsSeen: number;
  professionalsUpserted: number;
  /** In carga but absent from `tbDadosProfissionalSus` — skipped entirely. */
  professionalsOrphaned: number;
  registrationsUpserted: number;
  /**
   * Scoped carga rows carrying no usable registration — unknown council, or blank
   * UF/number. These people are **not imported**: the registration is what makes
   * someone resolvable, so a row without one describes nobody we can act on.
   */
  cargaRowsWithoutRegistration: number;
  /** Same (council, UF, number) already held by a different professional. */
  registrationsConflicted: number;
  vinculos: number;
  occupationLinks: number;
  /** CBOs seen in carga that no aux row covers — the occupation link is dropped. */
  occupationsUnmapped: number;
  /**
   * Registry professionals newly matched to one of our persons by council
   * registration — the identity both schemas share.
   */
  professionalsBridged: number;
  /**
   * Matched, but to more than one person (or to a person another SUS id already
   * claims). Left unlinked: a wrong bridge attaches a clinic's roster to the
   * wrong doctor, which is worse than no bridge at all.
   */
  professionalsBridgeAmbiguous: number;
}

const BATCH = 1_000;

/**
 * Staging writes millions of narrow rows, where `BATCH` would mean thousands of
 * round trips. Wider batches are safe here precisely because the rows are dumb:
 * no conflict target, no foreign key, nothing to resolve per row.
 */
const STAGING_BATCH = 5_000;

/**
 * How often a write loop reports progress, in rows.
 *
 * Small enough that the gap between two reports stays far inside the activity's
 * 5-minute `heartbeatTimeout` even when Postgres is slow: at the ~1 250 rows/s
 * measured against production, 25 000 rows is about 20 seconds.
 */
const PROGRESS_EVERY_ROWS = 25_000;

function chunk<T>(items: readonly T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

/**
 * CNES ships `TP_UNIDADE` both zero-padded and not — `"1"` on 66 rows and `"2"`
 * on 2, out of 184 359 sampled, where the catalogue says `01` and `02`. Every
 * read and write of a unit-type code goes through here, because storing both
 * forms creates two catalogue rows for one type and splits every lookup with no
 * error to notice.
 *
 * Codes that are not a bare number are returned untouched: the export contains
 * two rows where a date landed in `TP_UNIDADE` (`30-set-2025`, `12-fev-2029`),
 * and padding those would invent a code rather than fail to resolve one.
 */
function padUnitTypeCode(value: string): string {
  const code = clean(value);
  if (!/^\d{1,2}$/.test(code)) return code;
  return code.padStart(2, "0");
}

/**
 * `NU_LATITUDE` / `NU_LONGITUDE` as a number Postgres will accept, or null.
 *
 * The column is `numeric`, and CNES does not consistently ship one. Measured on
 * 202607: **992 values use a comma decimal separator** (`-13,8553786`) and a few
 * are truncated to a trailing point (`-41.`, `-22.`). Handing any of those to a
 * numeric column raises `22P02` and takes the whole 1 000-row batch with it, so
 * one malformed coordinate would cost a thousand establishments.
 *
 * Out-of-range values are dropped too. A latitude of 900 is not a bad
 * coordinate, it is not a coordinate — and this one ends up as a pin on a map
 * that decides which territory a clinic belongs to (spec 0009), so a plausible
 * wrong number is worse than a missing one the importer must supply.
 */
function parseCoordinate(value: string, limit: number): string | null {
  const raw = clean(value).replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return raw;
}

/**
 * True only for the one violation the loader is designed to absorb: two SUS ids
 * claiming the same `(council, UF, number)`.
 *
 * Matching on the constraint name as well as the SQLSTATE matters — the same
 * `23505` is raised by the `(professional, council, UF)` unique, which the upsert
 * targets and must never see, and treating that as expected would hide a broken
 * conflict target behind a plausible-looking counter.
 */
export function isRegistrationIdentityConflict(error: unknown): boolean {
  /*
   * Walk `cause`, because the driver error arrives wrapped.
   *
   * Drizzle raises `DrizzleQueryError: Failed query: insert into ...` and hangs
   * the `PostgresError` carrying `code` and `constraint_name` off its `cause`.
   * Reading those from the outer error yields `undefined`, so this returned
   * false for the one violation it exists to absorb, the insert rethrew, and
   * the load died on a duplicate CRM the loader is designed to skip —
   * `registrationsConflicted` counting zero the whole time it was happening.
   */
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 5; depth += 1) {
    const e = current as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (
      e.code === "23505" &&
      e.constraint_name === "registry_professional_registrations_council_state_number_key"
    ) {
      return true;
    }
    current = e.cause;
  }
  return false;
}

/** CNES writes booleans as `S`/`N`. */
function toBool(value: string | undefined): boolean | null {
  const v = clean(value).toUpperCase();
  if (v === "S") return true;
  if (v === "N") return false;
  return null;
}

export async function loadRegistryFromCsv(
  options: LoadRegistryOptions
): Promise<LoadRegistryResult> {
  const { db, reference } = options;
  const log = options.onProgress ?? (() => {});

  /**
   * Progress from inside a write loop, so Temporal can tell work from a corpse.
   *
   * `onProgress` is what the activity turns into a heartbeat, and it was only
   * ever called *between* steps. The establishment upsert writes 631 973 rows
   * and the workload staging millions more, both without reading another byte
   * of the archive — so the run went silent for minutes while working hardest,
   * and the 5-minute `heartbeatTimeout` killed it as a dead worker. The retry
   * restarts the load from the top and reaches the same silence, which is how
   * one slow write loop consumed both attempts on 2026-08-14.
   *
   * Throttled by rows rather than called per batch: a heartbeat every 1 000-row
   * flush is thousands of needless RPCs, and the point is only to prove the
   * activity is alive well inside the window.
   */
  const progressEveryRows = options.progressEveryRows ?? PROGRESS_EVERY_ROWS;
  function rowProgress(step: string) {
    let reported = 0;
    return (rows: number) => {
      if (rows - reported < progressEveryRows) return;
      reported = rows;
      log(step, { rows });
    };
  }
  const source =
    options.source ??
    (options.csvDir
      ? directoryCnesSource({ csvDir: options.csvDir, reference })
      : (() => {
          throw new Error("loadRegistryFromCsv needs either `source` or `csvDir`");
        })());

  const result: LoadRegistryResult = {
    scopedFacilities: 0,
    facilitiesUpserted: 0,
    scopedFacilitiesMissingFromDump: 0,
    scopedFacilitiesWithoutUnitCode: 0,
    facilitiesWithoutMunicipality: 0,
    auxStates: 0,
    auxMunicipalities: 0,
    auxOccupations: 0,
    auxUnitTypes: 0,
    cargaStaged: 0,
    professionalsStaged: 0,
    professionalsReferenced: 0,
    establishmentSubtypes: 0,
    auxUnitSubtypes: 0,
    auxDeactivationReasons: 0,
    auxCouncils: 0,
    professionalsSeen: 0,
    professionalsUpserted: 0,
    professionalsOrphaned: 0,
    registrationsUpserted: 0,
    cargaRowsWithoutRegistration: 0,
    registrationsConflicted: 0,
    vinculos: 0,
    occupationLinks: 0,
    occupationsUnmapped: 0,
    professionalsBridged: 0,
    professionalsBridgeAmbiguous: 0,
  };

  // ── Step 0 — Resolve scope ────────────────────────────────────────────────
  //
  // Scope comes from `public`, not from `registry`: on a first run `registry` is
  // empty, so deriving it from `registry.facilities.atlasmed_id` would scope the
  // import to nothing and report success.
  const scopeRows = await db
    .select({ id: facilities.id, cnesCode: facilities.cnesCode })
    .from(facilities)
    .where(and(isNotNull(facilities.cnesCode), isNull(facilities.deactivatedAt)));

  const atlasIdByCnes = new Map<string, number>();
  for (const row of scopeRows) {
    const code = clean(row.cnesCode ?? undefined);
    if (code) atlasIdByCnes.set(code, row.id);
  }
  result.scopedFacilities = atlasIdByCnes.size;
  log("scope resolved", { facilities: result.scopedFacilities });

  if (atlasIdByCnes.size === 0) {
    // Not an error — a fresh environment legitimately has no CNES-coded clinics.
    // Returning here keeps the run honest instead of reporting empty successes
    // for six more steps.
    log("no facilities carry a cnes_code; nothing to import");
    return result;
  }

  // ── Step 0b — Preflight the headers ──────────────────────────────────────
  //
  // Every column is read by name off a `Record<string, string>` that returns `""`
  // for anything absent, so a renamed CNES column does not fail — it loads a table
  // of empty strings and reports success. `NO_PROFISSIONAL` disappearing would
  // name every doctor after their SUS id; `CO_CONSELHO_CLASSE` disappearing would
  // silently drop every registration, i.e. the join key. Fail before writing.
  const missingColumns: string[] = [];
  for (const [name, required] of Object.entries(REQUIRED_COLUMNS) as [
    CnesSourceName,
    readonly string[],
  ][]) {
    const header = new Set(await source.header(name));
    for (const column of required) {
      if (!header.has(column)) {
        missingColumns.push(`${sourceFileName(name, reference)}:${column}`);
      }
    }
  }
  if (missingColumns.length > 0) {
    throw new Error(
      `CNES export is missing expected columns — refusing to load a partial registry: ${missingColumns.join(", ")}`
    );
  }
  log("preflight passed", { files: Object.keys(REQUIRED_COLUMNS).length });

  // ── Step 1 — Aux dimensions, insert-new-only ─────────────────────────────

  const stateRows: { cnesId: string; name: string }[] = [];
  for await (const r of source.records("states")) {
    const cnesId = clean(r.CO_SIGLA);
    if (cnesId.length !== 2) continue;
    stateRows.push({ cnesId, name: clean(r.NO_DESCRICAO) || cnesId });
  }
  for (const part of chunk(stateRows)) {
    await db.insert(registryStates).values(part).onConflictDoNothing();
  }
  result.auxStates = stateRows.length;

  const knownStates = new Set(stateRows.map((s) => s.cnesId));
  const municipalityRows: { cnesId: string; name: string; stateCnesId: string }[] = [];
  for await (const r of source.records("municipalities")) {
    const cnesId = clean(r.CO_MUNICIPIO);
    const stateCnesId = clean(r.CO_SIGLA_ESTADO);
    // A municipality whose UF is absent would violate the FK and abort the batch.
    if (!cnesId || !knownStates.has(stateCnesId)) continue;
    municipalityRows.push({ cnesId, name: clean(r.NO_MUNICIPIO) || cnesId, stateCnesId });
  }
  for (const part of chunk(municipalityRows)) {
    await db.insert(registryMunicipalities).values(part).onConflictDoNothing();
  }
  result.auxMunicipalities = municipalityRows.length;
  const knownMunicipalities = new Set(municipalityRows.map((m) => m.cnesId));

  await bridgeGeography(db, log);

  const occupationRows: {
    cnesId: string;
    name: string;
    isHealthOccupation: boolean | null;
    isRegulated: boolean | null;
  }[] = [];
  for await (const r of source.records("occupations")) {
    const cnesId = clean(r.CO_CBO);
    if (!cnesId) continue;
    occupationRows.push({
      cnesId,
      name: clean(r.DS_ATIVIDADE_PROFISSIONAL) || cnesId,
      isHealthOccupation: toBool(r.TP_CBO_SAUDE),
      isRegulated: toBool(r.ST_CBO_REGULAMENTADO),
    });
  }
  for (const part of chunk(occupationRows)) {
    await db.insert(registryOccupations).values(part).onConflictDoNothing();
  }
  result.auxOccupations = occupationRows.length;
  const knownOccupations = new Set(occupationRows.map((o) => o.cnesId));

  /*
   * Establishment catalogues (spec 0015 §3.2). Insert-new-only like the rest:
   * `atlasmed_id` on `registry.unit_types` is the import allowlist, and an
   * upsert that rewrote it would undo an operator's decision on every run.
   *
   * `CO_TIPO_UNIDADE` is padded on the way in. CNES ships the code both ways —
   * 68 rows of 184 359 carry `"1"` where the catalogue says `01` — and storing
   * both forms would create two catalogue rows for one type and split every
   * lookup silently.
   */
  const unitTypeRows: { cnesId: string; name: string }[] = [];
  for await (const r of source.records("unitTypes")) {
    const cnesId = padUnitTypeCode(clean(r.CO_TIPO_UNIDADE));
    if (!cnesId) continue;
    unitTypeRows.push({ cnesId, name: clean(r.DS_TIPO_UNIDADE) || cnesId });
  }
  for (const part of chunk(unitTypeRows)) {
    await db.insert(registryUnitTypes).values(part).onConflictDoNothing();
  }
  result.auxUnitTypes = unitTypeRows.length;
  const knownUnitTypes = new Set(unitTypeRows.map((u) => u.cnesId));

  const unitSubtypeRows: { unitTypeCnesId: string; cnesId: string; name: string }[] = [];
  for await (const r of source.records("unitSubtypes")) {
    const unitTypeCnesId = padUnitTypeCode(clean(r.CO_TIPO_UNIDADE));
    const cnesId = clean(r.CO_SUB_TIPO);
    // A subtype whose parent type is absent would violate the FK and abort the batch.
    if (!cnesId || !knownUnitTypes.has(unitTypeCnesId)) continue;
    unitSubtypeRows.push({
      unitTypeCnesId,
      cnesId,
      name: clean(r.DS_SUB_TIPO) || cnesId,
    });
  }
  for (const part of chunk(unitSubtypeRows)) {
    await db.insert(registryUnitSubtypes).values(part).onConflictDoNothing();
  }
  result.auxUnitSubtypes = unitSubtypeRows.length;

  const deactivationReasonRows: { cnesId: string; name: string }[] = [];
  for await (const r of source.records("deactivationReasons")) {
    const cnesId = clean(r.CD_MOTIVO_DESAB);
    if (!cnesId) continue;
    deactivationReasonRows.push({ cnesId, name: clean(r.DS_MOTIVO_DESAB) || cnesId });
  }
  for (const part of chunk(deactivationReasonRows)) {
    await db.insert(registryDeactivationReasons).values(part).onConflictDoNothing();
  }
  result.auxDeactivationReasons = deactivationReasonRows.length;

  log("establishment catalogues loaded", {
    unitTypes: result.auxUnitTypes,
    unitSubtypes: result.auxUnitSubtypes,
    deactivationReasons: result.auxDeactivationReasons,
  });

  /**
   * Councils are **read**, never written (ADR 0009 § 6).
   *
   * The export ships two disagreeing council code systems — CRM is `10` in
   * `tbConselhoClasse` and `71` in the órgão-emissor codes `tbCargaHorariaSus`
   * actually uses — so seeding from it mislabels every doctor's council. The
   * table is curated by hand; this reads the whitelist back out.
   *
   * An empty table is fatal rather than silent: every registration would be
   * skipped, no professional would be importable, and the run would report a
   * clean success over an empty registry.
   */
  const councilRows = await db
    .select({ cnesId: registryProfessionalCouncils.cnesId })
    .from(registryProfessionalCouncils)
    .where(eq(registryProfessionalCouncils.isActive, true));
  const knownCouncils = new Set(councilRows.map((c) => c.cnesId));
  if (knownCouncils.size === 0) {
    throw new Error(
      "registry.professional_councils is empty — seed it by hand before loading " +
        "(ADR 0009 §6). Without a council whitelist every registration is skipped " +
        "and the run would import nobody while reporting success."
    );
  }
  result.auxCouncils = knownCouncils.size;

  log("aux loaded", {
    states: result.auxStates,
    municipalities: result.auxMunicipalities,
    occupations: result.auxOccupations,
    councils: result.auxCouncils,
  });

  // ── Step 2 — Upsert every establishment, and learn their CO_UNIDADE ───────
  //
  // Spec 0015: **no `atlasmed_id` gate**. The registry mirrors all 631 973
  // establishments so the import surface can answer "does this clinic exist at
  // all", which the scoped mirror never could. The establishment file was
  // already read in full every run, so this changes what is written, not what is
  // read.
  //
  // `cnesIdByUnitCode` stays scoped to facilities we operate: it exists to join
  // `tbCargaHorariaSus`, and steps 3-6 remain gated on `atlasmed_id IS NOT NULL`
  // (invariant 5). Mapping all 631 973 would hold a map we never look most of up.
  const cnesIdByUnitCode = new Map<string, string>();
  const facilitiesFoundInDump = new Set<string>();
  const facilityBuffer: (typeof registryFacilities.$inferInsert)[] = [];
  const beatFacilities = rowProgress("facilities upserting");

  async function flushFacilities() {
    if (facilityBuffer.length === 0) return;
    await db
      .insert(registryFacilities)
      .values(facilityBuffer)
      .onConflictDoUpdate({
        target: registryFacilities.cnesId,
        set: {
          cnesUnitCode: sql`excluded.cnes_unit_code`,
          /*
           * Coalesce, never overwrite (invariant 4). Now that every establishment
           * is mirrored, the incoming `atlasmed_id` is null for all but the ~1 400
           * we operate — and a plain `excluded.atlasmed_id` would wipe the bridge
           * off every facility on the first unscoped run, including the ones a
           * user established by hand.
           */
          atlasmedId: sql`coalesce(excluded.atlasmed_id, ${registryFacilities.atlasmedId})`,
          legalName: sql`excluded.legal_name`,
          tradeName: sql`excluded.trade_name`,
          taxIdCnpj: sql`excluded.tax_id_cnpj`,
          taxIdCpf: sql`excluded.tax_id_cpf`,
          streetAddress: sql`excluded.street_address`,
          streetNumber: sql`excluded.street_number`,
          addressComplement: sql`excluded.address_complement`,
          neighborhood: sql`excluded.neighborhood`,
          postalCode: sql`excluded.postal_code`,
          municipalityCnesId: sql`excluded.municipality_cnes_id`,
          managingMunicipalityCnesId: sql`excluded.managing_municipality_cnes_id`,
          phoneNumber: sql`excluded.phone_number`,
          email: sql`excluded.email`,
          unitTypeCode: sql`excluded.unit_type_code`,
          latitude: sql`excluded.latitude`,
          longitude: sql`excluded.longitude`,
          legalPersonType: sql`excluded.legal_person_type`,
          maintainerTaxId: sql`excluded.maintainer_tax_id`,
          deactivationReasonCode: sql`excluded.deactivation_reason_code`,
          updatedAt: sql`now()`,
        },
      });
    result.facilitiesUpserted += facilityBuffer.length;
    facilityBuffer.length = 0;
    beatFacilities(result.facilitiesUpserted);
  }

  for await (const r of source.records("establishments")) {
    const cnesId = clean(r.CO_CNES);
    if (!cnesId) continue;

    const atlasmedId = atlasIdByCnes.get(cnesId) ?? null;
    const isOurs = atlasmedId !== null;
    if (isOurs) facilitiesFoundInDump.add(cnesId);

    const unitCode = clean(r.CO_UNIDADE);
    /*
     * Only ours goes in the map: it feeds the carga join, which stays scoped.
     */
    if (unitCode && isOurs) cnesIdByUnitCode.set(unitCode, cnesId);
    else if (!unitCode && isOurs) result.scopedFacilitiesWithoutUnitCode += 1;

    /**
     * The establishment's own município, then the gestor, then nothing (§4.4).
     *
     * `CO_UNIDADE` is município(6) + `CO_CNES`(7) on 184 301 of 184 351 rows, and
     * where its prefix disagrees with `CO_MUNICIPIO_GESTOR` — 218 rows, 0.12 % —
     * it is usually the gestor that is malformed, carrying a two-digit state code
     * where a six-digit município belongs. The old scope hid this: across the
     * 1 423 clinics we operate the two never differed, which was a property of
     * the scope rather than of the data.
     *
     * Null rather than a código the FK would reject: `ON DELETE restrict` means
     * an unknown município aborts the whole batch, and one unmappable code is
     * not worth losing a thousand clinics over.
     */
    const gestor = clean(r.CO_MUNICIPIO_GESTOR);
    const ownPrefix = unitCode.length === 13 ? unitCode.slice(0, 6) : "";
    let municipalityCnesId: string | null = null;
    if (knownMunicipalities.has(ownPrefix)) {
      municipalityCnesId = ownPrefix;
    } else if (knownMunicipalities.has(gestor)) {
      municipalityCnesId = gestor;
    } else {
      result.facilitiesWithoutMunicipality += 1;
    }

    facilityBuffer.push({
      cnesId,
      cnesUnitCode: unitCode || null,
      atlasmedId,
      legalName: clean(r.NO_RAZAO_SOCIAL) || null,
      tradeName: clean(r.NO_FANTASIA) || null,
      taxIdCnpj: clean(r.NU_CNPJ) || null,
      taxIdCpf: clean(r.NU_CPF) || null,
      streetAddress: clean(r.NO_LOGRADOURO) || null,
      streetNumber: clean(r.NU_ENDERECO) || null,
      addressComplement: clean(r.NO_COMPLEMENTO) || null,
      neighborhood: clean(r.NO_BAIRRO) || null,
      postalCode: clean(r.CO_CEP) || null,
      municipalityCnesId,
      managingMunicipalityCnesId: knownMunicipalities.has(gestor) ? gestor : null,
      phoneNumber: clean(r.NU_TELEFONE) || null,
      email: clean(r.NO_EMAIL) || null,
      unitTypeCode: padUnitTypeCode(clean(r.TP_UNIDADE)) || null,
      latitude: parseCoordinate(r.NU_LATITUDE ?? "", 90),
      longitude: parseCoordinate(r.NU_LONGITUDE ?? "", 180),
      legalPersonType: clean(r.TP_PFPJ) || null,
      maintainerTaxId: clean(r.NU_CNPJ_MANTENEDORA) || null,
      deactivationReasonCode: clean(r.CO_MOTIVO_DESAB) || null,
    });
    if (facilityBuffer.length >= BATCH) await flushFacilities();
  }
  await flushFacilities();
  result.scopedFacilitiesMissingFromDump = atlasIdByCnes.size - facilitiesFoundInDump.size;
  log("facilities upserted", {
    upserted: result.facilitiesUpserted,
    unitCodes: cnesIdByUnitCode.size,
    missingFromDump: result.scopedFacilitiesMissingFromDump,
    withoutUnitCode: result.scopedFacilitiesWithoutUnitCode,
    withoutMunicipality: result.facilitiesWithoutMunicipality,
  });
  if (result.scopedFacilitiesMissingFromDump > 0) {
    // Not fatal — but a clinic CNES has never heard of yields an empty suggestion
    // list that is indistinguishable from "no colleagues found".
    log("scoped facilities absent from the dump — check their cnes_code", {
      count: result.scopedFacilitiesMissingFromDump,
      cnesCodes: [...atlasIdByCnes.keys()]
        .filter((code) => !facilitiesFoundInDump.has(code))
        .slice(0, 20),
    });
  }

  // ── Step 2b — Subtypes, and the import allowlist on a fresh database ──────

  /*
   * `rlEstabSubTipo` carries exactly one row per establishment (134 640 of
   * 134 640 in 202607), which is why `unit_subtype_code` is a single column
   * rather than a collection.
   *
   * Note the column name: this file says `CO_SUB_TIPO_UNIDADE` where
   * `tbSubTipo` says `CO_SUB_TIPO`. Joining on the wrong one finds nothing and
   * reports success.
   */
  const subtypeByUnitCode = new Map<string, string>();
  for await (const r of source.records("establishmentSubtypes")) {
    const unitCode = clean(r.CO_UNIDADE);
    const subtype = clean(r.CO_SUB_TIPO_UNIDADE);
    if (!unitCode || !subtype) continue;
    subtypeByUnitCode.set(unitCode, subtype);
  }
  if (subtypeByUnitCode.size > 0) {
    const pairs = [...subtypeByUnitCode.entries()];
    for (const part of chunk(pairs)) {
      const values = sql.join(
        part.map(([unitCode, subtype]) => sql`(${unitCode}, ${subtype})`),
        sql`, `
      );
      await db.execute(sql`
        update registry.facilities f
           set unit_subtype_code = v.subtype, updated_at = now()
          from (values ${values}) as v(unit_code, subtype)
         where f.cnes_unit_code = v.unit_code
           and f.unit_subtype_code is distinct from v.subtype
      `);
    }
  }
  result.establishmentSubtypes = subtypeByUnitCode.size;
  log("establishment subtypes linked", { rows: result.establishmentSubtypes });

  /*
   * Bootstrap the import allowlist, once, and only on a database where nobody
   * has set one.
   *
   * Migration 0108 seeds it from `public.unit_types`, but a fresh environment
   * has no catalogues at that point — they arrive here, with the first load — so
   * without this the allowlist would stay empty and the import surface would
   * offer nothing while looking perfectly healthy.
   *
   * The guard is "no unit type is bridged **at all**", not "this type is
   * unbridged". Re-applying the list per type would silently undo an operator
   * who removed one, and §3.2 promises that widening or narrowing the set is one
   * UPDATE with no deploy. Bootstrap once; never argue with a human afterwards.
   */
  const [allowlisted] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(registryUnitTypes)
    .where(isNotNull(registryUnitTypes.atlasmedId));
  if ((allowlisted?.n ?? 0) === 0) {
    const seeded = await db.execute(sql`
      update registry.unit_types r
         set atlasmed_id = t.id, updated_at = now()
        from public.unit_types t
       where lpad(btrim(t.cnes_id), 2, '0') = r.cnes_id
         and r.cnes_id in ('22','36','39','04','05','73','62','07','15','20','21')
         and r.atlasmed_id is null
    `);
    log("import allowlist bootstrapped", {
      types: (seeded as unknown as { count?: number }).count ?? null,
    });
  }

  // ── Step 2c — Stage the national workload rows ────────────────────────────
  //
  // Spec 0015 §6.7. `tbCargaHorariaSus` and `tbDadosProfissionalSus` are staged
  // for **every** establishment, so importing a clinic can derive its roster
  // with a query in the same transaction that creates it. Without this, a clinic
  // imported the day after an ingestion has no doctors until the next monthly
  // run — up to a month of an empty feature on exactly the clinics somebody just
  // went to the trouble of adding.
  //
  // These are staging tables and the distinction is what makes them affordable:
  // no foreign keys, no `atlasmed_id`, no roster semantics, no bridge to
  // `public.people`. Derived and never authoritative (invariant 9) — they can be
  // dropped and rebuilt from the archive without losing a fact.
  //
  // Rows carry their competência and are never updated in place. This writes the
  // new one alongside whatever is already there; readers take the competência
  // the run ledger marks COMPLETED, so an import landing mid-reload cannot read
  // a half-loaded table and derive a partial roster. Superseded competências are
  // dropped after promotion, by the caller, not here.
  const { year: referenceYear, month: referenceMonth } = reference;

  /*
   * A re-run of the same competência starts clean. Without this a retry after a
   * partial write doubles every roster, and the duplicates look exactly like a
   * doctor holding two posts at one clinic.
   */
  await db
    .delete(cnesCargaStaging)
    .where(
      and(
        eq(cnesCargaStaging.referenceYear, referenceYear),
        eq(cnesCargaStaging.referenceMonth, referenceMonth)
      )
    );
  await db
    .delete(cnesProfessionalStaging)
    .where(
      and(
        eq(cnesProfessionalStaging.referenceYear, referenceYear),
        eq(cnesProfessionalStaging.referenceMonth, referenceMonth)
      )
    );

  /*
   * The SUS ids some staged vínculo refers to, collected while carga streams.
   *
   * An earlier version staged every professional nationally and deleted the
   * unreferenced ones in SQL, to keep the loader's memory flat. Measured, that
   * traded ~35 MB of Set for 7 274 165 inserts that were immediately deleted —
   * about fifteen of the run's twenty minutes, and 1.4 GB of dead tuples that
   * made the staging tables look 5× their real size until a VACUUM FULL.
   *
   * The set is bounded by what carga references (575 573 on 202607), not by the
   * 7.8 M rows the professional file carries, so it does not grow with the file.
   */
  const stagedSusIds = new Set<string>();
  const cargaBuffer: (typeof cnesCargaStaging.$inferInsert)[] = [];
  const beatCarga = rowProgress("workload staging");
  async function flushCarga() {
    if (cargaBuffer.length === 0) return;
    await db.insert(cnesCargaStaging).values(cargaBuffer);
    result.cargaStaged += cargaBuffer.length;
    cargaBuffer.length = 0;
    beatCarga(result.cargaStaged);
  }

  for await (const r of source.records("workload")) {
    const unitCode = clean(r.CO_UNIDADE);
    const sus = clean(r.CO_PROFISSIONAL_SUS);
    if (!unitCode || !sus) continue;

    /*
     * The registration is the gate, not the CBO (ADR 0009 §5), and it is applied
     * here rather than at read. A row without one describes a person we could
     * never act on, and dropping them now removes 2 500 334 of 6 734 280 rows —
     * 37 % — that nothing would ever have selected.
     */
    const council = clean(r.CO_CONSELHO_CLASSE);
    const uf = clean(r.SG_UF_CRM).toUpperCase();
    const number = clean(r.NU_REGISTRO);
    if (!knownCouncils.has(council) || uf.length !== 2 || !number) {
      /*
       * Counted here, where the row is still visible. Step 3 reads staging, and
       * staging has already dropped these — so counting there would report zero
       * for ever and quietly retire a signal the operator relies on.
       */
      if (cnesIdByUnitCode.has(unitCode)) result.cargaRowsWithoutRegistration += 1;
      continue;
    }

    stagedSusIds.add(sus);
    cargaBuffer.push({
      referenceYear,
      referenceMonth,
      unitCode,
      professionalSusId: sus,
      councilCode: council,
      registrationUf: uf,
      registrationNumber: number,
      occupationCode: clean(r.CO_CBO) || null,
    });
    if (cargaBuffer.length >= STAGING_BATCH) await flushCarga();
  }
  await flushCarga();

  const stagedProfessionalBuffer: (typeof cnesProfessionalStaging.$inferInsert)[] = [];
  const beatStagedProfessionals = rowProgress("professionals staging");
  async function flushStagedProfessionals() {
    if (stagedProfessionalBuffer.length === 0) return;
    await db
      .insert(cnesProfessionalStaging)
      .values(stagedProfessionalBuffer)
      .onConflictDoNothing();
    result.professionalsStaged += stagedProfessionalBuffer.length;
    stagedProfessionalBuffer.length = 0;
    beatStagedProfessionals(result.professionalsStaged);
  }

  for await (const r of source.records("professionals")) {
    const sus = clean(r.CO_PROFISSIONAL_SUS);
    const name = clean(r.NO_PROFISSIONAL);
    if (!sus || !name) continue;
    // Only people a staged vínculo refers to. Staging the rest and deleting
    // them again is the same result for five times the work.
    if (!stagedSusIds.has(sus)) continue;
    stagedProfessionalBuffer.push({
      referenceYear,
      referenceMonth,
      professionalSusId: sus,
      name,
      socialName: clean(r.NO_SOCIAL) || null,
      // Masked in the public dump; carried so the derived table keeps its column.
      taxId: clean(r.CO_CPF) || null,
      cns: clean(r.CO_CNS) || null,
    });
    if (stagedProfessionalBuffer.length >= STAGING_BATCH) await flushStagedProfessionals();
  }
  await flushStagedProfessionals();

  log("workload staged", {
    competence: `${referenceYear}-${String(referenceMonth).padStart(2, "0")}`,
    carga: result.cargaStaged,
    professionals: result.professionalsStaged,
    referencedSusIds: stagedSusIds.size,
  });
  result.professionalsReferenced = stagedSusIds.size;

  // ── Step 3 — Build the scoped roster from staging ─────────────────────────
  //
  // Reads `ingestion.carga_staging`, not the archive. The rows are already there
  // from step 2c, and streaming 875 MB a second time to select the ~25 000 that
  // concern us would double the heaviest I/O in the pipeline to no purpose.
  //
  // Still scoped to establishments we operate (invariant 5), and the maps below
  // are still built in memory — see spec 0015 §6.7 on why that ceiling matters
  // as the base grows, and why moving this accumulation into SQL is the next
  // step rather than this one.

  const susIds = new Set<string>();
  /** Only for the scan log; the roster itself is derived in SQL below. */
  const facilitiesWithStaff = new Set<string>();

  const scopedUnitCodes = [...cnesIdByUnitCode.keys()];
  /*
   * One text parameter split server-side, not a JS array.
   *
   * Drizzle's `sql` template flattens an array into one placeholder per element,
   * so `any(${codes})` binds a single scalar and Postgres rejects it. Splitting
   * a delimited string keeps this to one parameter however large the scope
   * grows — an `in (...)` list would be one placeholder per clinic, and this is
   * the query whose scope this spec is designed to let grow. The delimiter is
   * `chr(1)`, which no CNES identifier can contain.
   */
  const scopedUnitCodeList = scopedUnitCodes.join("\u0001");
  const stagedCarga = scopedUnitCodes.length === 0
    ? []
    : ((await db.execute(sql`
        select unit_code, professional_sus_id, council_code,
               registration_uf, registration_number, occupation_code
          from ingestion.carga_staging
         where reference_year = ${referenceYear}
           and reference_month = ${referenceMonth}
           and unit_code = any(string_to_array(${scopedUnitCodeList}, chr(1)))
      `)) as unknown as {
        unit_code: string;
        professional_sus_id: string;
        council_code: string;
        registration_uf: string;
        registration_number: string;
        occupation_code: string | null;
      }[]);

  for (const r of stagedCarga) {
    const facilityCnesId = cnesIdByUnitCode.get(r.unit_code);
    if (facilityCnesId === undefined) continue;

    susIds.add(r.professional_sus_id);
    facilitiesWithStaff.add(facilityCnesId);
  }
  result.professionalsSeen = susIds.size;
  log("carga scanned", {
    professionals: susIds.size,
    facilitiesWithStaff: facilitiesWithStaff.size,
  });

  // ── Step 4 — Professionals: never deleted, attributes refreshed ───────────
  //
  // A SUS id present in carga but absent from `tbDadosProfissionalSus` is a bad
  // extract, not a person. Importing it would create a nameless professional, so
  // the whole SUS is dropped — vínculo and registrations included — and counted.
  const foundSus = new Set<string>();
  const professionalBuffer: (typeof registryProfessionals.$inferInsert)[] = [];
  const beatProfessionals = rowProgress("professionals upserting");

  async function flushProfessionals() {
    if (professionalBuffer.length === 0) return;
    await db
      .insert(registryProfessionals)
      .values(professionalBuffer)
      .onConflictDoUpdate({
        target: registryProfessionals.cnesId,
        set: {
          fullName: sql`excluded.full_name`,
          socialName: sql`excluded.social_name`,
          taxId: sql`excluded.tax_id`,
          healthCardNumber: sql`excluded.health_card_number`,
          sourceLastSeenAt: sql`now()`,
          updatedAt: sql`now()`,
          // `atlasmed_id` is deliberately absent: the bridge is user-authored and
          // a monthly refresh must never clear it.
        },
      });
    result.professionalsUpserted += professionalBuffer.length;
    professionalBuffer.length = 0;
    beatProfessionals(result.professionalsUpserted);
  }

  /*
   * From staging, not the archive — the same reason as step 3. Selecting the
   * ~19 000 people at our clinics out of a second 962 MB pass is work the
   * staging tables exist to make unnecessary.
   */
  /*
   * Scoped by joining staging to staging rather than by passing ~19 000 SUS ids
   * back down: the set is already expressed by the unit codes.
   */
  const stagedProfessionals = susIds.size === 0
    ? []
    : ((await db.execute(sql`
        select p.professional_sus_id, p.name, p.social_name, p.tax_id, p.cns
          from ingestion.professional_staging p
         where p.reference_year = ${referenceYear}
           and p.reference_month = ${referenceMonth}
           and exists (
             select 1 from ingestion.carga_staging c
              where c.reference_year = p.reference_year
                and c.reference_month = p.reference_month
                and c.professional_sus_id = p.professional_sus_id
                and c.unit_code = any(string_to_array(${scopedUnitCodeList}, chr(1)))
           )
      `)) as unknown as {
        professional_sus_id: string;
        name: string;
        social_name: string | null;
        tax_id: string | null;
        cns: string | null;
      }[]);

  for (const r of stagedProfessionals) {
    const sus = r.professional_sus_id;
    if (!susIds.has(sus) || foundSus.has(sus)) continue;
    foundSus.add(sus);

    professionalBuffer.push({
      cnesId: sus,
      fullName: r.name || sus,
      socialName: r.social_name,
      // Masked in the public dump (`XXX.392.286.XX`); stored, never matched on.
      taxId: r.tax_id,
      healthCardNumber: r.cns,
    });
    if (professionalBuffer.length >= BATCH) await flushProfessionals();
  }
  await flushProfessionals();
  result.professionalsOrphaned = susIds.size - foundSus.size;
  log("professionals upserted", {
    upserted: result.professionalsUpserted,
    orphaned: result.professionalsOrphaned,
  });

  // ── Steps 5-7 — Derive the roster, in one transaction ─────────────────────
  //
  // Registrations, the staff snapshot and the person bridge are all derivable
  // from `ingestion.carga_staging` joined to what steps 2-4 already wrote, so
  // they are computed by the database rather than round-tripped through here.
  //
  // **This is the difference between minutes and hours.** The row-at-a-time
  // path measured 8 registrations/s against 125 724 rows in production — over
  // four hours, inside a two-hour activity timeout — because every row was a
  // network round trip. The same work as set-based SQL took 21 seconds.
  //
  // One transaction, because a reader must never see registrations without the
  // roster they describe, nor a roster half-replaced. The promotion gate runs
  // inside it and before the deletes, so a refused export rolls back rather
  // than leaving the registry partly rewritten.
  //
  // Every filter the in-memory version applied is preserved as a join:
  //   - `registry.professionals` — a SUS id absent from `tbDadosProfissionalSus`
  //     is a bad extract, and the whole person is dropped, vínculo included;
  //   - `registry.occupations` — an unmapped CBO is counted, not stored;
  //   - staging itself already excludes rows with an unknown council, a UF that
  //     is not two characters, or no registration number.
  const scopedCnesIds = [...atlasIdByCnes.keys()];

  /** The scoped, staged carga rows every step below derives from. */
  const stagedScope = sql`
    from ingestion.carga_staging c
    join registry.facilities f
      on f.cnes_unit_code = c.unit_code
     and f.atlasmed_id is not null
    join registry.professionals p
      on p.cnes_id = c.professional_sus_id
   where c.reference_year = ${referenceYear}
     and c.reference_month = ${referenceMonth}
     and c.unit_code = any(string_to_array(${scopedUnitCodeList}, chr(1)))
  `;

  const [planned] = (await db.execute(sql`
    select
      (select count(*) from (
         select distinct f.cnes_id, c.professional_sus_id ${stagedScope}
       ) v)::int as vinculos,
      (select count(*) from (
         select distinct f.cnes_id, c.professional_sus_id, c.occupation_code
           ${stagedScope}
            and c.occupation_code is not null
            and exists (select 1 from registry.occupations o
                         where o.cnes_id = c.occupation_code)
       ) o)::int as occupation_links,
      (select count(*) from (
         select distinct c.professional_sus_id, c.occupation_code
           ${stagedScope}
            and c.occupation_code is not null
            and not exists (select 1 from registry.occupations o
                             where o.cnes_id = c.occupation_code)
       ) u)::int as unmapped_cbos
  `)) as unknown as { vinculos: number; occupation_links: number; unmapped_cbos: number }[];

  result.occupationsUnmapped = Number(planned?.unmapped_cbos ?? 0);

  await db.transaction(async (tx) => {
    /*
     * Two dedups, and both are load-bearing.
     *
     * `distinct on (professional, council, UF)` satisfies the conflict target —
     * Postgres refuses to update the same row twice in one command, and one
     * person can appear on many carga rows. `distinct on (council, UF, number)`
     * then satisfies the global identity unique, which cannot be named as a
     * second target. Ordering makes both choices deterministic rather than
     * whatever the scan happened to yield.
     *
     * `not exists` drops identities another SUS id already holds: keep the
     * first owner, because reassigning would move a doctor's identity onto a
     * stranger.
     */
    const written = await tx.execute(sql`
      insert into registry.professional_registrations
        (professional_cnes_id, council_cnes_id, state_code, registration_number)
      select v.professional_sus_id, v.council_code, v.registration_uf,
             v.registration_number
        from (
          select distinct on (o.council_code, o.registration_uf, o.registration_number)
                 o.professional_sus_id, o.council_code, o.registration_uf,
                 o.registration_number
            from (
              select distinct on (c.professional_sus_id, c.council_code, c.registration_uf)
                     c.professional_sus_id, c.council_code, c.registration_uf,
                     c.registration_number
                ${stagedScope}
               order by c.professional_sus_id, c.council_code, c.registration_uf,
                        c.registration_number
            ) o
           order by o.council_code, o.registration_uf, o.registration_number,
                    o.professional_sus_id
        ) v
       where not exists (
         select 1 from registry.professional_registrations held
          where held.council_cnes_id = v.council_code
            and held.state_code = v.registration_uf
            and held.registration_number = v.registration_number
            and held.professional_cnes_id <> v.professional_sus_id
       )
      on conflict (professional_cnes_id, council_cnes_id, state_code)
      do update set registration_number = excluded.registration_number,
                    updated_at = now()
      returning 1
    `);
    result.registrationsUpserted = Array.isArray(written)
      ? written.length
      : ((written as unknown as { count?: number }).count ?? 0);

    /*
     * Counted after the conflict-target dedup and before the identity dedup.
     *
     * The first collapses one person's repeated carga rows, which is not a
     * conflict and must not be reported as one. The second drops a claim on a
     * CRM another SUS id owns, which is exactly what the counter is for — so
     * the difference between this and what was written is the number of
     * registrations the identity guard refused.
     */
    const [claimable] = (await tx.execute(sql`
      select count(*)::int as n from (
        select distinct on (c.professional_sus_id, c.council_code, c.registration_uf)
               c.professional_sus_id
          ${stagedScope}
         order by c.professional_sus_id, c.council_code, c.registration_uf,
                  c.registration_number
      ) x
    `)) as unknown as { n: number }[];
    result.registrationsConflicted =
      Number(claimable?.n ?? 0) - result.registrationsUpserted;

    /**
     * The gate runs here, not after: past this point the old roster is gone.
     *
     * A thin export — a partial publication, a column that changed meaning, a
     * scope query that returned less than it should — loads without error and
     * silently empties every clinic's suggestions. Nothing about that looks
     * like a failure from the outside, which is why it has to be refused before
     * the delete rather than noticed afterwards. Inside the transaction, so a
     * refusal takes the registrations with it.
     */
    if (options.beforePromote) {
      await options.beforePromote({
        scopedFacilities: result.scopedFacilities,
        facilitiesUpserted: result.facilitiesUpserted,
        professionals: result.professionalsUpserted,
        registrations: result.registrationsUpserted,
        vinculos: Number(planned?.vinculos ?? 0),
        occupationLinks: Number(planned?.occupation_links ?? 0),
      });
    }

    /*
     * The delete is scoped to **every facility we operate**, not to the ones
     * that happen to have staff in this dump. A clinic whose last registered
     * professional left reports no qualifying carga row at all, so scoping the
     * delete to the dump would skip it and leave the departed doctor suggested
     * forever.
     */
    for (const part of chunk(scopedCnesIds)) {
      // Occupations cascade from the vínculo, but deleting them explicitly
      // keeps the order independent of the FK's ON DELETE rule.
      await tx
        .delete(registryFacilityProfessionalOccupations)
        .where(inArray(registryFacilityProfessionalOccupations.facilityCnesId, part));
      await tx
        .delete(registryFacilityProfessionals)
        .where(inArray(registryFacilityProfessionals.facilityCnesId, part));
    }

    const vinculos = await tx.execute(sql`
      insert into registry.facility_professionals (facility_cnes_id, professional_cnes_id)
      select distinct f.cnes_id, c.professional_sus_id ${stagedScope}
      on conflict do nothing
      returning 1
    `);
    result.vinculos = Array.isArray(vinculos)
      ? vinculos.length
      : ((vinculos as unknown as { count?: number }).count ?? 0);

    const occupations = await tx.execute(sql`
      insert into registry.facility_professional_occupations
        (facility_cnes_id, professional_cnes_id, occupation_cnes_id)
      select distinct f.cnes_id, c.professional_sus_id, c.occupation_code
        ${stagedScope}
         and c.occupation_code is not null
         and exists (select 1 from registry.occupations o
                      where o.cnes_id = c.occupation_code)
      on conflict do nothing
      returning 1
    `);
    result.occupationLinks = Array.isArray(occupations)
      ? occupations.length
      : ((occupations as unknown as { count?: number }).count ?? 0);

    // Bridging reads the registrations written above, so it belongs to the same
    // transaction: a reader must never see one without the other.
    const bridged = await bridgeByRegistration(tx);
    result.professionalsBridged = bridged.linked;
    result.professionalsBridgeAmbiguous = bridged.ambiguous;
  });

  log("registrations upserted", {
    upserted: result.registrationsUpserted,
    conflicted: result.registrationsConflicted,
    cargaRowsWithoutRegistration: result.cargaRowsWithoutRegistration,
  });
  log("staff snapshot replaced", {
    vinculos: result.vinculos,
    occupations: result.occupationLinks,
    unmappedCbos: result.occupationsUnmapped,
  });
  log("registry professionals bridged to persons", {
    linked: result.professionalsBridged,
    ambiguous: result.professionalsBridgeAmbiguous,
  });

  return result;
}

interface BridgeResult {
  linked: number;
  /** Matched, but not to exactly one person — left unlinked on purpose. */
  ambiguous: number;
}

/**
 * Links `registry.professionals` to `public.persons` on council registration.
 *
 * A council registration is the one identifier both sides genuinely share: CNES
 * publishes it, our reps type it, and `(council, UF, number)` is unique in both
 * schemas. Names are not identity — five of our confirmed-same-person pairs
 * already disagree on spelling — and the SUS id only matches people some earlier
 * backfill happened to stamp, which no doctor added by hand since will carry.
 *
 * Without this, a doctor a rep entered last week reappears next month as somebody
 * CNES knows and we do not. The sheet offers to import them, and the import is
 * refused by the `(council, UF, number)` unique — a duplicate prevented by error
 * message rather than by recognising the person. This is the step that recognises
 * them.
 *
 * Runs after everything else: the registrations it matches on are written by
 * step 5, and a bridge is worth nothing if the load it describes was refused.
 */
/**
 * Point the registry's geography at ours.
 *
 * **This has to live in the loader, not only in a migration.** Migration 0110
 * carries the same backfill, and on this lane it worked — because the registry
 * was already loaded when the migration ran. That ordering is an accident. On a
 * fresh environment the migration runs first, finds `registry.states` and
 * `registry.municipalities` empty, bridges nothing, and the load then inserts
 * every row with a null `atlasmed_id` that nothing ever fills. Measured on a
 * clean clone: `Geography bridge: 0 state(s), 0 município(s)`.
 *
 * The consequence is not subtle. Every establishment then resolves with no
 * município and no state, so every import falls through to the "CNES knows a
 * município we don't" path — which is meant for a handful of rows and would run
 * for all 631 973.
 *
 * So: idempotent, every run, guarded on `atlasmed_id is null` so a bridge a
 * human set by hand is never overwritten (invariant 4).
 *
 * **The two levels join on different keys.** Municípios match on `cnes_code`,
 * which is the IBGE code without its check digit and is populated on all 5 571.
 * States do not: `registry.states.cnes_id` holds the sigla from
 * `tbEstado.CO_SIGLA` (`AC`, `SP`) while `public.states.cnes_code` holds the
 * numeric code (`12`, `35`). Joining states on `cnes_code` matches zero rows —
 * measured, after migration 0110 first did exactly that.
 */
async function bridgeGeography(
  db: AnyDatabase,
  log: (message: string, detail?: Record<string, unknown>) => void
): Promise<void> {
  const states = await db.execute(sql`
    update registry.states r
       set atlasmed_id = s.id, updated_at = now()
      from public.states s
     where s.abbreviation = r.cnes_id
       and r.atlasmed_id is null
  `);

  const municipalities = await db.execute(sql`
    update registry.municipalities r
       set atlasmed_id = m.id, updated_at = now()
      from public.municipalities m
     where m.cnes_code is not null
       and m.cnes_code = r.cnes_id
       and r.atlasmed_id is null
  `);

  /*
   * The Distrito Federal, which the join above cannot reach.
   *
   * CNES subdivides the DF into 31 regiões administrativas — Taguatinga,
   * Ceilândia, Gama, Asa Sul — and gives each its own `CO_MUNICIPIO`. IBGE does
   * not: the DF is one município, Brasília (IBGE 5300108 / CNES 530010). So
   * those 31 codes match no `public.municipalities.cnes_code` and would stay
   * unbridged, leaving every Brasília establishment unplaceable.
   *
   * This mirrors migration 0112 for the same reason the block above mirrors
   * 0110's backfill: a migration runs once, against whatever the registry held
   * at that moment, and on a fresh environment that is nothing.
   *
   * **By code, never by name.** Taguatinga, Planaltina, Sobradinho, Cruzeiro and
   * Guará all name real municípios in other states; matching on name would file
   * Brasília clinics ~700 km away, in the wrong UF and the wrong territory. The
   * `53` prefix also excludes the two Ministry codes (`999999`, `222222`), which
   * carry no establishment and should stay unbridged so naming one fails loudly.
   */
  const districtFederal = await db.execute(sql`
    update registry.municipalities r
       set atlasmed_id = b.id, updated_at = now()
      from public.municipalities b
     where b.cnes_code = '530010'
       and r.state_cnes_id = 'DF'
       and r.cnes_id like '53%'
       and r.atlasmed_id is null
  `);

  log("geography bridged", {
    states: (states as unknown as { count?: number }).count ?? null,
    municipalities: (municipalities as unknown as { count?: number }).count ?? null,
    districtFederalLocalities:
      (districtFederal as unknown as { count?: number }).count ?? null,
  });
}

async function bridgeByRegistration(db: AnyDatabase): Promise<BridgeResult> {
  /**
   * Three conditions, each guarding a different way this could attach a clinic's
   * roster to the wrong human:
   *
   *  - `atlasmed_id is null` — the column is user-authorable. A human who
   *    corrected a link outranks anything derived here, and a monthly job that
   *    silently reverts their correction is worse than one that never ran.
   *  - one person per SUS id, and one SUS id per person. Anything else is a
   *    guess, and `registry_professionals_atlasmed_id_uidx` would abort the whole
   *    statement on the second claim to one person anyway.
   *  - only active registrations, and no soft-deleted person. A registration
   *    someone deactivated is one they disowned; identity should not rest on it.
   */
  const [row] = (await db.execute(sql`
    with candidate as (
      select rr.professional_cnes_id as sus, ppr.person_id
        from registry.professional_registrations rr
        join registry.professional_councils rc
          on rc.cnes_id = rr.council_cnes_id
        join person_professional_registration_councils c
          on c.abbreviation = rc.abbreviation
        join person_professional_registrations ppr
          on ppr.council_id = c.id
         and ppr.state_code = rr.state_code
         and ppr.registration_number = rr.registration_number
         and ppr.is_active
        join persons p
          on p.id = ppr.person_id
         and p.deleted_at is null
        -- Not already reachable from a *different* registry professional by SUS
        -- id. Bridging them anyway would put one human in the suggestion list
        -- twice, once by each route, and neither copy would be wrong.
        left join person_healthcare_profiles hp
          on hp.person_id = ppr.person_id
        join registry.professionals rp
          on rp.cnes_id = rr.professional_cnes_id
         and rp.atlasmed_id is null
       where hp.cnes_professional_id is null
          or hp.cnes_professional_id = rr.professional_cnes_id
       group by rr.professional_cnes_id, ppr.person_id
    ),
    one_person_per_sus as (
      select sus, min(person_id) as person_id
        from candidate
       group by sus
      having count(*) = 1
    ),
    -- Two SUS ids matching one person means the registry holds that doctor twice,
    -- or one of the registrations is wrong. Either way it is not ours to resolve.
    one_sus_per_person as (
      select person_id
        from one_person_per_sus
       group by person_id
      having count(*) = 1
    ),
    eligible as (
      select s.sus, s.person_id
        from one_person_per_sus s
        join one_sus_per_person u on u.person_id = s.person_id
       where not exists (
         select 1 from registry.professionals taken
          where taken.atlasmed_id = s.person_id
       )
    ),
    linked as (
      update registry.professionals rp
         set atlasmed_id = e.person_id, updated_at = now()
        from eligible e
       where rp.cnes_id = e.sus
      returning 1
    )
    select
      (select count(*) from linked)                                   as linked,
      (select count(*) from candidate) - (select count(*) from eligible) as ambiguous
  `)) as unknown as { linked: number | string; ambiguous: number | string }[];

  return {
    // `count(*)` comes back as bigint, which the driver renders as a string.
    linked: Number(row?.linked ?? 0),
    ambiguous: Number(row?.ambiguous ?? 0),
  };
}
