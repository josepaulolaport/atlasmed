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
}

const BATCH = 1_000;

function chunk<T>(items: readonly T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function clean(value: string | undefined): string {
  return (value ?? "").trim();
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
function isRegistrationIdentityConflict(error: unknown): boolean {
  const e = error as { code?: unknown; constraint_name?: unknown } | null;
  return (
    e?.code === "23505" &&
    e?.constraint_name === "registry_professional_registrations_council_state_number_key"
  );
}

const KEY_SEPARATOR = " ";

/** Composite map key for one person at one establishment. */
function pairKeyOf(facilityCnesId: string, professionalCnesId: string): string {
  return `${facilityCnesId}${KEY_SEPARATOR}${professionalCnesId}`;
}

/** Composite map key for one council registration slot: council + UF. */
function registrationKeyOf(councilCnesId: string, stateCode: string): string {
  return `${councilCnesId}${KEY_SEPARATOR}${stateCode}`;
}

function splitPairKey(key: string): [string, string] {
  const at = key.indexOf(KEY_SEPARATOR);
  return [key.slice(0, at), key.slice(at + KEY_SEPARATOR.length)];
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

  // ── Step 2 — Upsert scoped facilities, and learn their CO_UNIDADE ─────────
  //
  // `tbCargaHorariaSus` joins on CO_UNIDADE, not CO_CNES, so the staff scan is
  // impossible without this mapping.
  const cnesIdByUnitCode = new Map<string, string>();
  const facilitiesFoundInDump = new Set<string>();
  const facilityBuffer: (typeof registryFacilities.$inferInsert)[] = [];

  async function flushFacilities() {
    if (facilityBuffer.length === 0) return;
    await db
      .insert(registryFacilities)
      .values(facilityBuffer)
      .onConflictDoUpdate({
        target: registryFacilities.cnesId,
        set: {
          cnesUnitCode: sql`excluded.cnes_unit_code`,
          atlasmedId: sql`excluded.atlasmed_id`,
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
          phoneNumber: sql`excluded.phone_number`,
          email: sql`excluded.email`,
          unitTypeCode: sql`excluded.unit_type_code`,
          updatedAt: sql`now()`,
        },
      });
    result.facilitiesUpserted += facilityBuffer.length;
    facilityBuffer.length = 0;
  }

  for await (const r of source.records("establishments")) {
    const cnesId = clean(r.CO_CNES);
    const atlasmedId = atlasIdByCnes.get(cnesId);
    if (atlasmedId === undefined) continue;

    facilitiesFoundInDump.add(cnesId);

    /**
     * Null rather than a código the FK would reject: `ON DELETE restrict` means
     * an unknown município aborts the whole batch, and one unmappable code is
     * not worth losing a thousand clinics over.
     */
    const gestor = clean(r.CO_MUNICIPIO_GESTOR);
    let municipalityCnesId: string | null = null;
    if (knownMunicipalities.has(gestor)) {
      municipalityCnesId = gestor;
    } else {
      result.facilitiesWithoutMunicipality += 1;
    }

    const unitCode = clean(r.CO_UNIDADE);
    if (unitCode) cnesIdByUnitCode.set(unitCode, cnesId);
    else result.scopedFacilitiesWithoutUnitCode += 1;

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
      phoneNumber: clean(r.NU_TELEFONE) || null,
      email: clean(r.NO_EMAIL) || null,
      unitTypeCode: clean(r.TP_UNIDADE) || null,
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

  // ── Step 3 — Scan scoped carga ───────────────────────────────────────────

  /** facilityCnesId → set of professional SUS ids. */
  const staffByFacility = new Map<string, Set<string>>();
  /** {@link pairKeyOf} → the CBO codes that person holds at that establishment. */
  const cbosByPair = new Map<string, Set<string>>();
  /** SUS id → {@link registrationKeyOf} → registration number. */
  const registrationsBySus = new Map<string, Map<string, string>>();
  const susIds = new Set<string>();

  for await (const r of source.records("workload")) {
    const facilityCnesId = cnesIdByUnitCode.get(clean(r.CO_UNIDADE));
    if (facilityCnesId === undefined) continue;

    const sus = clean(r.CO_PROFISSIONAL_SUS);
    if (!sus) continue;

    /**
     * The registration is the gate, not the CBO (ADR 0009 § 5).
     *
     * An earlier version kept rows whose CBO started with `225` and treated the
     * registration as optional. That inferred "is a doctor" from an occupation
     * code, when what actually makes someone resolvable against `public` is
     * holding a council registration. A row without one describes a person we
     * cannot act on, so it never enters the registry.
     */
    const council = clean(r.CO_CONSELHO_CLASSE);
    const uf = clean(r.SG_UF_CRM).toUpperCase();
    const number = clean(r.NU_REGISTRO);
    if (!knownCouncils.has(council) || uf.length !== 2 || !number) {
      result.cargaRowsWithoutRegistration += 1;
      continue;
    }

    // Captured for display; no longer decides who is imported.
    const cbo = clean(r.CO_CBO);

    susIds.add(sus);

    let staff = staffByFacility.get(facilityCnesId);
    if (!staff) {
      staff = new Set();
      staffByFacility.set(facilityCnesId, staff);
    }
    staff.add(sus);

    const pairKey = pairKeyOf(facilityCnesId, sus);
    let cbos = cbosByPair.get(pairKey);
    if (!cbos) {
      cbos = new Set();
      cbosByPair.set(pairKey, cbos);
    }
    if (cbo) cbos.add(cbo);

    let regs = registrationsBySus.get(sus);
    if (!regs) {
      regs = new Map();
      registrationsBySus.set(sus, regs);
    }
    // Dual-UF registrations are legitimate and become two rows.
    regs.set(registrationKeyOf(council, uf), number);
  }
  result.professionalsSeen = susIds.size;
  log("carga scanned", {
    professionals: susIds.size,
    facilitiesWithStaff: staffByFacility.size,
  });

  // ── Step 4 — Professionals: never deleted, attributes refreshed ───────────
  //
  // A SUS id present in carga but absent from `tbDadosProfissionalSus` is a bad
  // extract, not a person. Importing it would create a nameless professional, so
  // the whole SUS is dropped — vínculo and registrations included — and counted.
  const foundSus = new Set<string>();
  const professionalBuffer: (typeof registryProfessionals.$inferInsert)[] = [];

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
  }

  for await (const r of source.records("professionals")) {
    const sus = clean(r.CO_PROFISSIONAL_SUS);
    if (!susIds.has(sus) || foundSus.has(sus)) continue;
    foundSus.add(sus);

    professionalBuffer.push({
      cnesId: sus,
      fullName: clean(r.NO_PROFISSIONAL) || sus,
      socialName: clean(r.NO_SOCIAL) || null,
      // Masked in the public dump (`XXX.392.286.XX`); stored, never matched on.
      taxId: clean(r.CO_CPF) || null,
      healthCardNumber: clean(r.CO_CNS) || null,
    });
    if (professionalBuffer.length >= BATCH) await flushProfessionals();
  }
  await flushProfessionals();
  result.professionalsOrphaned = susIds.size - foundSus.size;
  log("professionals upserted", {
    upserted: result.professionalsUpserted,
    orphaned: result.professionalsOrphaned,
  });

  // ── Step 5 — Registrations: absolute identity, keep-first on conflict ─────

  const conflictSamples: string[] = [];
  const registrationRows: (typeof registryProfessionalRegistrations.$inferInsert)[] = [];
  for (const [sus, regs] of registrationsBySus) {
    if (!foundSus.has(sus)) continue;
    for (const [key, registrationNumber] of regs) {
      const [councilCnesId, stateCode] = splitPairKey(key);
      registrationRows.push({
        professionalCnesId: sus,
        councilCnesId,
        stateCode,
        registrationNumber,
      });
    }
  }

  for (const part of chunk(registrationRows)) {
    // Two conflict targets are in play and only one can be named per statement.
    // `(professional, council, UF)` is the row we own and want refreshed;
    // `(council, UF, number)` is the global identity guard, whose violation means
    // a *different* person already claims this CRM. Postgres would abort the
    // whole batch on the second, so it is caught per-row below rather than
    // letting one bad row discard 999 good ones.
    const before = result.registrationsUpserted;
    try {
      await db
        .insert(registryProfessionalRegistrations)
        .values(part)
        .onConflictDoUpdate({
          target: [
            registryProfessionalRegistrations.professionalCnesId,
            registryProfessionalRegistrations.councilCnesId,
            registryProfessionalRegistrations.stateCode,
          ],
          set: {
            registrationNumber: sql`excluded.registration_number`,
            updatedAt: sql`now()`,
          },
        });
      result.registrationsUpserted = before + part.length;
    } catch {
      for (const row of part) {
        try {
          await db
            .insert(registryProfessionalRegistrations)
            .values(row)
            .onConflictDoUpdate({
              target: [
                registryProfessionalRegistrations.professionalCnesId,
                registryProfessionalRegistrations.councilCnesId,
                registryProfessionalRegistrations.stateCode,
              ],
              set: {
                registrationNumber: sql`excluded.registration_number`,
                updatedAt: sql`now()`,
              },
            });
          result.registrationsUpserted += 1;
        } catch (error) {
          // Only the global identity unique may be absorbed: this CRM belongs to
          // another SUS id, so keep the first owner — reassigning would move a
          // doctor's identity onto a stranger. Anything else (a dropped
          // connection, a check violation) is a real failure and must not be
          // laundered into a conflict count that reads as a normal load.
          if (!isRegistrationIdentityConflict(error)) throw error;
          result.registrationsConflicted += 1;
          conflictSamples.push(
            `${row.councilCnesId}/${row.stateCode}/${row.registrationNumber} claimed by another SUS id (this one: ${row.professionalCnesId})`
          );
        }
      }
    }
  }
  log("registrations upserted", {
    upserted: result.registrationsUpserted,
    conflicted: result.registrationsConflicted,
    cargaRowsWithoutRegistration: result.cargaRowsWithoutRegistration,
  });
  if (conflictSamples.length > 0) {
    // A dropped registration makes its owner unjoinable to `public`; naming a few
    // is the difference between "the loader is fine" and a data problem someone
    // can go look at.
    log("registrations dropped — CRM already held by another SUS id", {
      count: conflictSamples.length,
      samples: conflictSamples.slice(0, 20),
    });
  }

  // ── Step 6 — Replace the staff snapshot, per scoped facility ──────────────
  //
  // One transaction: the roster must never be observable as half-deleted.
  //
  // The delete is scoped to **every facility we operate**, not to the ones that
  // happen to have staff in this dump. A clinic whose last registered professional
  // left reports no qualifying carga row at all, so it is absent from
  // `staffByFacility` — scoping the delete there would skip it and leave the
  // departed doctor suggested forever.
  // "Replaced wholesale per scoped facility" means the scope is `public`, which is
  // also where step 0 got it.
  const scopedCnesIds = [...atlasIdByCnes.keys()];
  const vinculoRows: (typeof registryFacilityProfessionals.$inferInsert)[] = [];
  const occupationRowsToInsert: (typeof registryFacilityProfessionalOccupations.$inferInsert)[] =
    [];

  for (const [facilityCnesId, staff] of staffByFacility) {
    for (const sus of staff) {
      if (!foundSus.has(sus)) continue;
      vinculoRows.push({ facilityCnesId, professionalCnesId: sus });
      for (const cbo of cbosByPair.get(pairKeyOf(facilityCnesId, sus)) ?? []) {
        if (!knownOccupations.has(cbo)) {
          result.occupationsUnmapped += 1;
          continue;
        }
        occupationRowsToInsert.push({
          facilityCnesId,
          professionalCnesId: sus,
          occupationCnesId: cbo,
        });
      }
    }
  }

  /**
   * The gate runs here, not after: past this point the old roster is gone.
   *
   * A thin export — a partial publication, a column that changed meaning, a
   * scope query that returned less than it should — loads without error and
   * silently empties every clinic's suggestions. Nothing about that looks like a
   * failure from the outside, which is why it has to be refused before the
   * delete rather than noticed afterwards.
   */
  if (options.beforePromote) {
    await options.beforePromote({
      scopedFacilities: result.scopedFacilities,
      facilitiesUpserted: result.facilitiesUpserted,
      professionals: result.professionalsUpserted,
      registrations: result.registrationsUpserted,
      vinculos: vinculoRows.length,
      occupationLinks: occupationRowsToInsert.length,
    });
  }

  await db.transaction(async (tx) => {
    for (const part of chunk(scopedCnesIds)) {
      // Occupations cascade from the vínculo, but deleting them explicitly keeps
      // the order independent of the FK's ON DELETE rule.
      await tx
        .delete(registryFacilityProfessionalOccupations)
        .where(inArray(registryFacilityProfessionalOccupations.facilityCnesId, part));
      await tx
        .delete(registryFacilityProfessionals)
        .where(inArray(registryFacilityProfessionals.facilityCnesId, part));
    }
    for (const part of chunk(vinculoRows)) {
      await tx.insert(registryFacilityProfessionals).values(part).onConflictDoNothing();
    }
    for (const part of chunk(occupationRowsToInsert)) {
      await tx
        .insert(registryFacilityProfessionalOccupations)
        .values(part)
        .onConflictDoNothing();
    }
  });
  result.vinculos = vinculoRows.length;
  result.occupationLinks = occupationRowsToInsert.length;
  log("staff snapshot replaced", {
    vinculos: result.vinculos,
    occupations: result.occupationLinks,
    unmappedCbos: result.occupationsUnmapped,
  });

  return result;
}
