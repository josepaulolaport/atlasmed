import { ForbiddenError, ValidationError } from "../../../../shared/errors";
import type {
  DrizzleCnesFacilityImportRepository,
  RegistryEstablishment,
} from "../../infrastructure/repositories/drizzle/drizzle-cnes-facility-import.repository";

/**
 * Importing a CNES establishment (spec 0015 §6).
 *
 * Two outcomes, and they are not variations of one write:
 *
 * | case | condition | what happens |
 * |---|---|---|
 * | **new to us** | registry row has no `atlasmed_id` | facility + profiles + bridge |
 * | **ours, invisible to this user** | `atlasmed_id` set | **profiles only** |
 *
 * The second is not a wizard and takes no field edits. `location`, name, CNPJ,
 * address and unit type live on the **shared** `facilities` row, so letting this
 * path write them would let one vertical overwrite another's curated record —
 * and re-placing the pin would move the clinic for every vertical, re-running
 * territory assignment on profiles that are not theirs.
 */

export type CnesImportOutcome = "CREATED" | "PROFILE_ADDED" | "ALREADY_VISIBLE";

export interface CnesImportResult {
  outcome: CnesImportOutcome;
  facilityId: number;
  cnesCode: string;
  verticalIds: number[];
}

/** What the wizard prefills. Everything here is a suggestion the user confirms. */
export interface CnesImportPreview {
  cnesCode: string;
  suggestedName: string;
  legalName: string | null;
  tradeName: string | null;
  legalDocumentType: "CNPJ" | "CPF" | null;
  /** Read-only when CNES supplies one — retyping it is how two clinics collide. */
  legalDocument: string | null;
  legalDocumentLocked: boolean;
  maintainerTaxId: string | null;
  streetAddress: string | null;
  streetNumber: string | null;
  addressComplement: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  phoneNumber: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  /** True when CNES has no point and the user must place one (§6.2). */
  requiresLocation: boolean;
  municipalityId: number | null;
  municipalityName: string | null;
  municipalityCnesId: string | null;
  stateId: number | null;
  stateAbbreviation: string | null;
  unitTypeId: number | null;
  unitTypeCode: string | null;
  unitSubtypeId: number | null;
  /** True when CNES ships a code no catalogue defines — the user picks (§4.3). */
  requiresUnitType: boolean;
  alreadyImported: boolean;
  facilityId: number | null;
  /** Verticals already covering it — the ones this import cannot add again. */
  existingVerticalIds: number[];
}

interface Dependencies {
  repository: DrizzleCnesFacilityImportRepository;
  onFacilityCreated?: (facilityId: number) => Promise<void>;
  onFacilityLocationChanged?: (facilityId: number) => Promise<void>;
  onCandidateChanged?: (cnesCode: string) => Promise<void>;
}

/**
 * The verticals this import may create profiles for.
 *
 * Normally the user's own. The exception is deliberate and narrow: **§6.0
 * restricts this surface to managers and admins, and admins hold no vertical
 * assignments** — both of ours hold zero, and `canAccessVertical` refuses an
 * empty assignment set for every role including ADMIN. Deriving the profile's
 * vertical solely from the caller's own would make the flow impossible to
 * complete for the only people allowed to run it.
 *
 * So an importer with no assignments must name the vertical explicitly, and it
 * is checked against the verticals that exist. This does **not** widen
 * `canAccessVertical`: everywhere else, an empty assignment set still means no
 * access. Only this surface, which is already role-gated, admits it.
 *
 * Defaulting to "the only vertical that exists" was considered and rejected: it
 * works while ORTOPEDIA is the only one and silently picks wrong the day a
 * second is added.
 */
export async function resolveImportVerticalIds(input: {
  role: string;
  assignedVerticalIds: number[];
  requestedVerticalIds: number[];
  listActiveVerticalIds: () => Promise<number[]>;
}): Promise<number[]> {
  const requested = [...new Set(input.requestedVerticalIds)].filter((id) => id > 0);

  if (input.assignedVerticalIds.length > 0) {
    if (requested.length === 0) {
      if (input.assignedVerticalIds.length === 1) return [input.assignedVerticalIds[0]!];
      throw new ValidationError([
        {
          field: "verticalIds",
          message: "verticalIds is required when you hold more than one vertical",
        },
      ]);
    }
    const outside = requested.filter((id) => !input.assignedVerticalIds.includes(id));
    if (outside.length > 0) throw new ForbiddenError();
    return requested;
  }

  if (input.role !== "ADMIN") {
    throw new ValidationError([
      {
        field: "verticalIds",
        message: "You have no vertical to import a clinic into",
      },
    ]);
  }

  if (requested.length === 0) {
    throw new ValidationError([
      {
        field: "verticalIds",
        message: "verticalIds is required: you hold no vertical of your own",
      },
    ]);
  }

  const active = await input.listActiveVerticalIds();
  const unknown = requested.filter((id) => !active.includes(id));
  if (unknown.length > 0) {
    throw new ValidationError([
      { field: "verticalIds", message: `Unknown vertical: ${unknown.join(", ")}` },
    ]);
  }
  return requested;
}

function assertOfferable(establishment: RegistryEstablishment): void {
  /*
   * Already ours is always offerable — the user may still need a profile on it,
   * and that is true even for a type we would never import fresh (our nine
   * cooperativas). The allowlist decides what may be *created*, not what may be
   * made visible.
   */
  if (establishment.atlasmedId !== null) return;

  if (establishment.deactivationReasonCode !== null) {
    throw new ValidationError([
      {
        field: "cnesCode",
        message: "CNES lists this establishment as deactivated",
      },
    ]);
  }
  if (!establishment.unitTypeImportable) {
    throw new ValidationError([
      {
        field: "cnesCode",
        message: "This kind of establishment is not one we import",
      },
    ]);
  }
}

export class PreviewCnesFacilityImportUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { cnesCode: string }): Promise<CnesImportPreview> {
    const cnesCode = input.cnesCode.trim();
    const establishment = await this.deps.repository.findEstablishment(cnesCode);
    if (!establishment) {
      throw new ValidationError([
        { field: "cnesCode", message: `CNES ${cnesCode} is not in the registry` },
      ]);
    }
    assertOfferable(establishment);

    /*
     * `TP_PFPJ` decides the type, never a guess about which document column
     * happened to be filled. A pessoa jurídica with no CNPJ is not a gap: 119 415
     * establishments are public units operating under a prefeitura's, and asking
     * for one invites the user to invent it.
     */
    const isPessoaFisica = establishment.legalPersonType === "1";
    const legalDocumentType = isPessoaFisica
      ? ("CPF" as const)
      : establishment.legalPersonType === "3"
        ? ("CNPJ" as const)
        : null;
    const legalDocument = isPessoaFisica
      ? establishment.taxIdCpf
      : establishment.taxIdCnpj;

    return {
      cnesCode: establishment.cnesCode,
      suggestedName:
        establishment.tradeName ?? establishment.legalName ?? establishment.cnesCode,
      legalName: establishment.legalName,
      tradeName: establishment.tradeName,
      legalDocumentType,
      legalDocument,
      legalDocumentLocked: legalDocument !== null,
      maintainerTaxId: establishment.maintainerTaxId,
      streetAddress: establishment.streetAddress,
      streetNumber: establishment.streetNumber,
      addressComplement: establishment.addressComplement,
      neighborhood: establishment.neighborhood,
      postalCode: establishment.postalCode,
      phoneNumber: establishment.phoneNumber,
      email: establishment.email,
      latitude: establishment.latitude,
      longitude: establishment.longitude,
      requiresLocation:
        establishment.latitude === null || establishment.longitude === null,
      municipalityId: establishment.municipalityId,
      municipalityName: establishment.municipalityName,
      municipalityCnesId: establishment.municipalityCnesId,
      stateId: establishment.stateId,
      stateAbbreviation: establishment.stateAbbreviation,
      unitTypeId: establishment.unitTypeId,
      unitTypeCode: establishment.unitTypeCode,
      unitSubtypeId: establishment.unitSubtypeId,
      requiresUnitType: establishment.unitTypeId === null,
      alreadyImported: establishment.atlasmedId !== null,
      facilityId: establishment.atlasmedId,
      existingVerticalIds: establishment.verticalIds,
    };
  }
}

export class ImportCnesFacilityUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    cnesCode: string;
    name?: string;
    legalDocument?: string | null;
    streetAddress?: string | null;
    streetNumber?: string | null;
    addressComplement?: string | null;
    neighborhood?: string | null;
    postalCode?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
    municipalityId?: number | null;
    lat?: number | null;
    lng?: number | null;
    unitTypeId?: number | null;
    unitSubtypeId?: number | null;
    verticalIds?: number[];
    role: string;
    assignedVerticalIds: number[];
  }): Promise<CnesImportResult> {
    const cnesCode = input.cnesCode.trim();
    const establishment = await this.deps.repository.findEstablishment(cnesCode);
    if (!establishment) {
      throw new ValidationError([
        { field: "cnesCode", message: `CNES ${cnesCode} is not in the registry` },
      ]);
    }
    assertOfferable(establishment);

    const verticalIds = await resolveImportVerticalIds({
      role: input.role,
      assignedVerticalIds: input.assignedVerticalIds,
      requestedVerticalIds: input.verticalIds ?? [],
      listActiveVerticalIds: () => this.deps.repository.listActiveVerticalIds(),
    });

    // ── Case 2: ours already, invisible to this user ────────────────────────
    if (establishment.atlasmedId !== null) {
      const facilityId = establishment.atlasmedId;
      const missing = verticalIds.filter(
        (id) => !establishment.verticalIds.includes(id)
      );
      if (missing.length === 0) {
        return {
          outcome: "ALREADY_VISIBLE",
          facilityId,
          cnesCode,
          verticalIds: establishment.verticalIds,
        };
      }

      const { added } = await this.deps.repository.addVerticalProfiles({
        facilityId,
        verticalIds: missing,
      });
      await this.deps.onFacilityCreated?.(facilityId);
      await this.deps.onCandidateChanged?.(cnesCode);
      return { outcome: "PROFILE_ADDED", facilityId, cnesCode, verticalIds: added };
    }

    // ── Case 1: new to us ───────────────────────────────────────────────────
    const name = (input.name ?? establishment.tradeName ?? establishment.legalName ?? "").trim();
    if (!name) {
      throw new ValidationError([{ field: "name", message: "name is required" }]);
    }

    /*
     * Spec 0009 R5: the point is required, and it decides which manager zone the
     * clinic falls in. CNES has none for 272 of 494 273 active establishments, so
     * this is a rare screen — but it is the difference between a clinic we can
     * add and one we cannot, so the rule is "the point must exist", not "CNES
     * must have supplied it".
     */
    const lat = input.lat ?? establishment.latitude;
    const lng = input.lng ?? establishment.longitude;
    if (lat == null || lng == null) {
      throw new ValidationError([
        { field: "lat", message: "Place the clinic on the map before importing" },
      ]);
    }

    const geography = await this.resolveGeography(establishment, input.municipalityId ?? null);

    /*
     * A subtype belongs to exactly one type, and `facilities` carries the two as
     * independent foreign keys — so nothing in the database refuses a mismatched
     * pair. Migration 0109 exists to repair exactly that, and an unchecked import
     * would recreate it one clinic at a time.
     */
    const unitTypeId = input.unitTypeId ?? establishment.unitTypeId;
    const unitSubtypeId = input.unitSubtypeId ?? establishment.unitSubtypeId;
    const unitType = await this.deps.repository.checkUnitType({ unitTypeId, unitSubtypeId });
    if (!unitType.typeExists) {
      throw new ValidationError([
        { field: "unitTypeId", message: `Unknown unit type: ${unitTypeId}` },
      ]);
    }
    if (!unitType.subtypeBelongs) {
      throw new ValidationError([
        {
          field: "unitSubtypeId",
          message: "That subtype belongs to a different kind of establishment",
        },
      ]);
    }

    /*
     * A CNPJ we already hold under a different CNES code is two establishments
     * claiming one legal entity. Report the facility that holds it rather than
     * failing on a constraint the user cannot read.
     */
    const legalDocument =
      establishment.legalPersonType === "1"
        ? (input.legalDocument ?? establishment.taxIdCpf)
        : establishment.taxIdCnpj;
    const legalDocumentType =
      establishment.legalPersonType === "1" ? ("CPF" as const) : ("CNPJ" as const);

    if (legalDocumentType === "CNPJ" && legalDocument) {
      const holder = await this.deps.repository.findActiveFacilityByCnpj(legalDocument);
      if (holder) {
        throw new ValidationError([
          {
            field: "legalDocument",
            message:
              `CNPJ ${legalDocument} already belongs to "${holder.name}" ` +
              `(CNES ${holder.cnesCode}). Two establishments cannot share one legal entity.`,
          },
        ]);
      }
    }

    const { facilityId, raced } = await this.deps.repository.createFromRegistry({
      cnesCode,
      name,
      // The registry's own, never a copy of `name` — see `createFromRegistry`.
      legalName: establishment.legalName,
      tradeName: establishment.tradeName,
      legalDocumentType,
      legalDocument: legalDocument ?? null,
      streetAddress: input.streetAddress ?? establishment.streetAddress,
      streetNumber: input.streetNumber ?? establishment.streetNumber,
      addressComplement: input.addressComplement ?? establishment.addressComplement,
      neighborhood: input.neighborhood ?? establishment.neighborhood,
      postalCode: input.postalCode ?? establishment.postalCode,
      phoneNumber: input.phoneNumber ?? establishment.phoneNumber,
      email: input.email ?? establishment.email,
      stateId: geography.stateId,
      municipalityId: geography.municipalityId,
      lat,
      lng,
      unitTypeId,
      unitSubtypeId,
      verticalIds,
    });

    /*
     * Somebody imported this establishment while we were deciding. The facility
     * exists and is not ours to have created, so the honest answer is the one
     * case 2 gives: make it visible to this user's verticals and say so. Writing
     * the fields we prepared would overwrite the winner's record.
     */
    if (raced) {
      const { added } = await this.deps.repository.addVerticalProfiles({
        facilityId,
        verticalIds,
      });
      await this.deps.onFacilityCreated?.(facilityId);
      await this.deps.onCandidateChanged?.(cnesCode);
      return {
        outcome: added.length > 0 ? "PROFILE_ADDED" : "ALREADY_VISIBLE",
        facilityId,
        cnesCode,
        verticalIds: added,
      };
    }

    // Ownership is geometric (spec 0009): the pin decides the manager zone.
    await this.deps.onFacilityLocationChanged?.(facilityId);
    await this.deps.onFacilityCreated?.(facilityId);
    /*
     * The candidate must leave the list *now*. If it does not, the user imports
     * a clinic, still sees it as importable, taps again, and hits a bare unique
     * violation on `cnes_code` with nothing to explain it.
     */
    await this.deps.onCandidateChanged?.(cnesCode);

    return { outcome: "CREATED", facilityId, cnesCode, verticalIds };
  }

  /**
   * Where the clinic is, creating the município when only CNES knows it.
   *
   * The user's choice wins when they made one. Otherwise the registry's, and if
   * `public` does not hold that município it is created from the registry rather
   * than refusing the import (§4.5) — 33 of the registry's 5 604 are in exactly
   * that state.
   */
  private async resolveGeography(
    establishment: RegistryEstablishment,
    chosenMunicipalityId: number | null
  ): Promise<{ municipalityId: number; stateId: number }> {
    /*
     * The chosen município brings its **own** state. Taking the state from the
     * registry instead would let a user pick a município in another UF and leave
     * the facility's `state_id` contradicting its `municipality_id` — and an id
     * that does not exist at all would surface as a raw foreign-key error rather
     * than something the user can act on.
     */
    if (chosenMunicipalityId !== null) {
      const chosen = await this.deps.repository.findMunicipality(chosenMunicipalityId);
      if (!chosen) {
        throw new ValidationError([
          { field: "municipalityId", message: `Município ${chosenMunicipalityId} does not exist` },
        ]);
      }
      return chosen;
    }

    if (establishment.municipalityId !== null && establishment.stateId !== null) {
      return {
        municipalityId: establishment.municipalityId,
        stateId: establishment.stateId,
      };
    }

    /*
     * Nothing is created here any more, and that is the correction.
     *
     * This used to mint a município from the registry whenever `public` did not
     * hold one, on the belief that CNES knew 33 municípios we did not. It does
     * not. All 33 were Brasília's regiões administrativas (31) plus two Ministry
     * internal codes — the DF is a single município in IBGE. Migration 0112
     * bridges the localities to Brasília, so a real establishment now resolves
     * here, and creating anything would have meant inventing an `ibge_id` from a
     * check digit that is not derivable.
     *
     * What is left is genuinely unplaceable: `999999 SAS`, `222222 DRAC/CGSOS`,
     * neither carrying an establishment. Failing is right.
     */
    throw new ValidationError([
      {
        field: "municipalityId",
        message: "Choose the município: CNES does not place this establishment",
      },
    ]);
  }
}
