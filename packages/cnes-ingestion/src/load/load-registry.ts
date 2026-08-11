import { join } from "node:path";
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
import { readCsvRecords } from "../parse/csv-stream";
import {
  CURATED_COUNCILS,
  sourceFileName,
  type CnesReference,
} from "../cnes-files";

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
  /** Directory holding the extracted `tb*.csv` / `rl*.csv` files. */
  csvDir: string;
  reference: CnesReference;
  /**
   * CBO prefixes to import. v1 is `["225"]` (médicos); widening this pulls in
   * cohorts whose registrations are about half-populated.
   */
  occupationPrefixes?: readonly string[];
  onProgress?: (message: string, detail?: Record<string, unknown>) => void;
}

export interface LoadRegistryResult {
  scopedFacilities: number;
  facilitiesUpserted: number;
  auxStates: number;
  auxMunicipalities: number;
  auxOccupations: number;
  auxCouncils: number;
  professionalsSeen: number;
  professionalsUpserted: number;
  /** In carga but absent from `tbDadosProfissionalSus` — skipped entirely. */
  professionalsOrphaned: number;
  registrationsUpserted: number;
  /** Council code absent from the curated map, or blank UF/number. */
  registrationsSkipped: number;
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
  const { db, csvDir, reference } = options;
  const prefixes = options.occupationPrefixes ?? ["225"];
  const log = options.onProgress ?? (() => {});
  const file = (name: Parameters<typeof sourceFileName>[0]) =>
    join(csvDir, sourceFileName(name, reference));

  const result: LoadRegistryResult = {
    scopedFacilities: 0,
    facilitiesUpserted: 0,
    auxStates: 0,
    auxMunicipalities: 0,
    auxOccupations: 0,
    auxCouncils: 0,
    professionalsSeen: 0,
    professionalsUpserted: 0,
    professionalsOrphaned: 0,
    registrationsUpserted: 0,
    registrationsSkipped: 0,
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

  // ── Step 1 — Aux dimensions, insert-new-only ─────────────────────────────

  const stateRows: { cnesId: string; name: string }[] = [];
  for await (const r of readCsvRecords(file("states"))) {
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
  for await (const r of readCsvRecords(file("municipalities"))) {
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

  const occupationRows: {
    cnesId: string;
    name: string;
    isHealthOccupation: boolean | null;
    isRegulated: boolean | null;
  }[] = [];
  for await (const r of readCsvRecords(file("occupations"))) {
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

  await db
    .insert(registryProfessionalCouncils)
    .values(CURATED_COUNCILS.map((c) => ({ ...c })))
    .onConflictDoNothing();
  result.auxCouncils = CURATED_COUNCILS.length;
  const knownCouncils = new Set(CURATED_COUNCILS.map((c) => c.cnesId));

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
          phoneNumber: sql`excluded.phone_number`,
          email: sql`excluded.email`,
          unitTypeCode: sql`excluded.unit_type_code`,
          updatedAt: sql`now()`,
        },
      });
    result.facilitiesUpserted += facilityBuffer.length;
    facilityBuffer.length = 0;
  }

  for await (const r of readCsvRecords(file("establishments"))) {
    const cnesId = clean(r.CO_CNES);
    const atlasmedId = atlasIdByCnes.get(cnesId);
    if (atlasmedId === undefined) continue;

    const unitCode = clean(r.CO_UNIDADE);
    if (unitCode) cnesIdByUnitCode.set(unitCode, cnesId);

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
      phoneNumber: clean(r.NU_TELEFONE) || null,
      email: clean(r.NO_EMAIL) || null,
      unitTypeCode: clean(r.TP_UNIDADE) || null,
    });
    if (facilityBuffer.length >= BATCH) await flushFacilities();
  }
  await flushFacilities();
  log("facilities upserted", {
    upserted: result.facilitiesUpserted,
    unitCodes: cnesIdByUnitCode.size,
  });

  // ── Step 3 — Scan scoped carga ───────────────────────────────────────────

  /** facilityCnesId → set of professional SUS ids. */
  const staffByFacility = new Map<string, Set<string>>();
  /** `${facility} ${sus}` → set of CBO codes. */
  const cbosByPair = new Map<string, Set<string>>();
  /** sus → `${council} ${uf}` → number. */
  const registrationsBySus = new Map<string, Map<string, string>>();
  const susIds = new Set<string>();

  for await (const r of readCsvRecords(file("workload"))) {
    const cbo = clean(r.CO_CBO);
    if (!prefixes.some((p) => cbo.startsWith(p))) continue;

    const facilityCnesId = cnesIdByUnitCode.get(clean(r.CO_UNIDADE));
    if (facilityCnesId === undefined) continue;

    const sus = clean(r.CO_PROFISSIONAL_SUS);
    if (!sus) continue;

    susIds.add(sus);

    let staff = staffByFacility.get(facilityCnesId);
    if (!staff) {
      staff = new Set();
      staffByFacility.set(facilityCnesId, staff);
    }
    staff.add(sus);

    const pairKey = `${facilityCnesId} ${sus}`;
    let cbos = cbosByPair.get(pairKey);
    if (!cbos) {
      cbos = new Set();
      cbosByPair.set(pairKey, cbos);
    }
    cbos.add(cbo);

    const council = clean(r.CO_CONSELHO_CLASSE);
    const uf = clean(r.SG_UF_CRM).toUpperCase();
    const number = clean(r.NU_REGISTRO);
    if (knownCouncils.has(council) && uf.length === 2 && number) {
      let regs = registrationsBySus.get(sus);
      if (!regs) {
        regs = new Map();
        registrationsBySus.set(sus, regs);
      }
      // Dual-UF registrations are legitimate and become two rows.
      regs.set(`${council} ${uf}`, number);
    }
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

  for await (const r of readCsvRecords(file("professionals"))) {
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

  const registrationRows: (typeof registryProfessionalRegistrations.$inferInsert)[] = [];
  for (const [sus, regs] of registrationsBySus) {
    if (!foundSus.has(sus)) continue;
    for (const [key, registrationNumber] of regs) {
      const [councilCnesId, stateCode] = key.split(" ") as [string, string];
      registrationRows.push({
        professionalCnesId: sus,
        councilCnesId,
        stateCode,
        registrationNumber,
      });
    }
  }
  result.registrationsSkipped =
    [...susIds].filter((s) => foundSus.has(s) && !registrationsBySus.has(s)).length;

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
        } catch {
          // The global unique fired: this CRM belongs to another SUS id. Keep the
          // first owner. Reassigning would move a doctor's identity onto a
          // stranger, which is worse than one missing registration.
          result.registrationsConflicted += 1;
        }
      }
    }
  }
  log("registrations upserted", {
    upserted: result.registrationsUpserted,
    conflicted: result.registrationsConflicted,
    skipped: result.registrationsSkipped,
  });

  // ── Step 6 — Replace the staff snapshot, per scoped facility ──────────────
  //
  // One transaction: the roster must never be observable as half-deleted.
  const scopedCnesIds = [...staffByFacility.keys()];
  const vinculoRows: (typeof registryFacilityProfessionals.$inferInsert)[] = [];
  const occupationRowsToInsert: (typeof registryFacilityProfessionalOccupations.$inferInsert)[] =
    [];

  for (const [facilityCnesId, staff] of staffByFacility) {
    for (const sus of staff) {
      if (!foundSus.has(sus)) continue;
      vinculoRows.push({ facilityCnesId, professionalCnesId: sus });
      for (const cbo of cbosByPair.get(`${facilityCnesId} ${sus}`) ?? []) {
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
