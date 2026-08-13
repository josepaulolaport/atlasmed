import { assertResourceInScope, type ScopeContext } from "@atlasmed/access";
import { AppError } from "../../../../shared/errors/base-error";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import {
  DrizzleCnesImportRepository,
  type RegistryProfessional,
} from "../../infrastructure/repositories/drizzle/drizzle-cnes-import.repository";

/**
 * Creating one of our people from someone CNES places at a clinic (spec 0012 §6).
 *
 * CNES reports roughly 19 000 professionals across our clinics and we hold about
 * 1 000 of them. The rest can only reach our database through this path, which
 * is why it exists — and why the one thing it must never do is create a second
 * record for somebody we already have.
 *
 * That is guaranteed structurally rather than by care:
 * `person_professional_registrations` is unique on `(council_id, state_code,
 * registration_number)`, so two people cannot hold one CRM. This use case's job
 * is to turn that constraint from an error into an answer — it checks first, and
 * when the registration is already held it reports **who holds it** rather than
 * attempting an insert that Postgres would refuse.
 */

/**
 * The registration this import would write already belongs to somebody.
 *
 * Not an error the client should render as a failure: it is the answer to
 * "does this person already exist", and it carries the identity so the caller
 * can associate them instead. Whether to do that silently or ask the rep is the
 * client's decision — the server's job is to never create the duplicate.
 */
export class CnesRegistrationAlreadyHeldError extends AppError {
  constructor(context: {
    personId: number;
    personName: string | null;
    registrationLabel: string;
  }) {
    super(
      "CNES_REGISTRATION_ALREADY_HELD",
      409,
      `${context.registrationLabel} already belongs to an existing professional`,
      context
    );
  }
}

export interface ImportCnesProfessionalResult {
  personId: number;
  /** False when the person already existed and was resolved rather than created. */
  created: boolean;
  /** What CNES records them doing at this clinic — for the rep, not for identity. */
  occupations: string[];
}

/** Fields the rep may supply. Identity is not among them. */
export interface ImportCnesProfessionalInput {
  facilityId: number;
  professionalCnesId: string;
  scope: ScopeContext;
  firstName?: string;
  lastName?: string;
  socialName?: string | null;
  cpf?: string | null;
  email?: string | null;
  mobilePhone?: string | null;
  /**
   * What the rep confirmed this person does here. Omitted means "what CNES
   * says"; an empty array means they cleared it, which is a different answer
   * and is honoured.
   */
  occupationIds?: number[];
  birthDate?: string | null;
  landlinePhone?: string | null;
  /**
   * Required. 1 205 of the 1 206 doctors we hold carry a specialty, so it is
   * mandatory in practice already — the wizard makes that explicit rather than
   * producing the one record that has none.
   */
  specialtyId?: number;
  /**
   * What they are to this clinic. Optional: most affiliations carry a role, but
   * not every person at a clinic has one, and refusing the import over it would
   * block a real doctor on a field nobody can always answer.
   */
  roleIds?: number[];
  /**
   * Registrations typed by the rep, added to what the registry supplied.
   *
   * The CRM CNES gave is not editable — it is the identity the whole feature
   * rests on. A doctor legitimately holding a second council or state is a
   * different claim, and it is additive.
   */
  extraRegistrations?: Array<{
    councilId: number;
    stateCode: string;
    registrationNumber: string;
  }>;
  hobbies?: string | null;
  favoriteTeam?: string | null;
  favoriteSport?: string | null;
  languages?: string | null;
}

/**
 * Splits CNES's single `full_name` into the two columns we store.
 *
 * Everything before the last space is the given name. Portuguese surnames are
 * routinely compound (`DE SOUZA`, `DOS SANTOS`), so this is a default a rep can
 * correct, not a rule — which is why both fields are editable on the way in.
 */
export function splitRegistryName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: parts[0]! };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1]!,
  };
}

/**
 * What the import will write as this person's occupations here.
 *
 * Defaults to CNES's claim, and narrows a supplied list to it. A rep may drop
 * occupations CNES records or reorder them, but may not invent one: the CBO is
 * a fact about this clinic taken from the export, and letting the client post
 * an arbitrary occupation id would turn a sourced claim into free text that
 * still looks sourced. Deliberate occupations are a separate action on the
 * roster, not a side effect of importing.
 *
 * `undefined` means "unspecified" and takes the CNES default; `[]` means the
 * rep cleared them, which is an answer and is kept.
 */
export function resolveOccupations(
  requested: number[] | undefined,
  professional: RegistryProfessional
): number[] {
  if (requested === undefined) return professional.occupationIds;
  const offered = new Set(professional.occupationIds);
  const seen = new Set<number>();
  return requested.filter(
    (id) => offered.has(id) && !seen.has(id) && (seen.add(id), true)
  );
}

/**
 * True for a string Postgres will accept into a `date` column.
 *
 * Shape alone is not enough — `2026-02-30` is eleven plausible characters and
 * not a day — so the parsed value is compared back to what was typed. Without
 * this the driver raises 22007 from inside the insert, which reaches the rep as
 * "falha ao importar" for what is a typo in a field they can see.
 */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

function registrationLabel(professional: RegistryProfessional): string {
  const first = professional.registrations[0];
  if (!first) return "Esta inscrição";
  return `${first.councilAbbreviation} ${first.registrationNumber}/${first.stateCode}`;
}

/**
 * The roles to write, checked against the catalogue first.
 *
 * `person_facility_role_assignments` has a foreign key, so an id nobody
 * recognises would surface as a constraint violation from inside the
 * transaction — a 500 for what is a client sending a stale catalogue. Checking
 * here turns it into an answer that names the field.
 */
export async function resolveRoleIdsAgainst(
  requested: number[] | undefined,
  activeRoleIds: () => Promise<number[]>
): Promise<number[]> {
  const unique = [...new Set(requested ?? [])];
  if (unique.length === 0) return [];

  const allowed = new Set(await activeRoleIds());
  const unknown = unique.filter((id) => !allowed.has(id));
  if (unknown.length > 0) {
    throw new ValidationError(
      unknown.map((id) => ({
        field: "roleIds",
        message: `Unknown or inactive role id "${id}"`,
      }))
    );
  }
  return unique;
}

export class ImportCnesProfessionalUseCase {
  constructor(
    private readonly repository = new DrizzleCnesImportRepository()
  ) {}

  private resolveRoleIds(requested: number[] | undefined): Promise<number[]> {
    return resolveRoleIdsAgainst(requested, () =>
      this.repository.listActiveRoleIds()
    );
  }

  async execute(
    input: ImportCnesProfessionalInput
  ): Promise<ImportCnesProfessionalResult> {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    /*
     * Request shape first, before any lookup.
     *
     * These are facts about the request, not about the professional, so they
     * need no database round trip — and checking them later meant a malformed
     * body reported whatever the lookup happened to find instead of the field
     * that was actually wrong.
     *
     * Specialty is required because the data says it already is: 1 205 of the
     * 1 206 doctors we hold carry one, and a doctor without it is unfindable by
     * the search reps actually use.
     *
     * Role is not. It describes what someone is *to this clinic* rather than
     * who they are, and not every person at a clinic has one — so it is offered
     * and never demanded.
     */
    const problems: Array<{ field: string; message: string }> = [];
    if (!input.specialtyId) {
      problems.push({ field: "specialtyId", message: "specialtyId is required" });
    }
    /*
     * Values the columns themselves refuse, checked before the insert rather
     * than after. `persons.birth_date` is a date and `persons.cpf` is char(11):
     * either one reaches the driver as a query failure, and a query failure
     * names no field.
     */
    const birthDate = input.birthDate?.trim();
    if (birthDate && !isCalendarDate(birthDate)) {
      problems.push({
        field: "birthDate",
        message: `"${input.birthDate}" is not a date (expected AAAA-MM-DD)`,
      });
    }
    const cpf = input.cpf?.trim();
    if (cpf && !/^\d{11}$/.test(cpf)) {
      problems.push({
        field: "cpf",
        message: "cpf must be 11 digits",
      });
    }
    for (const registration of input.extraRegistrations ?? []) {
      const number = registration.registrationNumber?.trim();
      if (!number || !/^\d+$/.test(number)) {
        problems.push({
          field: "extraRegistrations",
          message: `"${registration.registrationNumber}" is not a registration number`,
        });
      }
      if (!/^[A-Za-z]{2}$/.test(registration.stateCode ?? "")) {
        problems.push({
          field: "extraRegistrations",
          message: `"${registration.stateCode}" is not a UF`,
        });
      }
    }
    if (problems.length > 0) throw new ValidationError(problems);

    /*
     * Also before the lookup, though this one needs the catalogue.
     *
     * A role id the client sent is a fact about the request, so which
     * professional they picked must not change the answer — checking it later
     * meant a stale catalogue was reported as whatever the lookup happened to
     * refuse first.
     */
    const roleIds = await this.resolveRoleIds(input.roleIds);

    const professional = await this.repository.findProfessional({
      professionalCnesId: input.professionalCnesId,
      facilityId: input.facilityId,
    });
    if (!professional) {
      throw new ResourceNotFoundError(
        "registry_professional",
        input.professionalCnesId
      );
    }

    /*
     * Only people CNES actually places here. Without this the endpoint is a
     * general "create a person from the registry" tool reachable by anyone with
     * access to any clinic, and the facility scope check above would be
     * guarding a door with no wall beside it.
     */
    if (!professional.atThisFacility) {
      throw new ValidationError([
        {
          field: "professionalCnesId",
          message: "CNES does not place this professional at this facility",
        },
      ]);
    }

    /*
     * Already ours. Idempotent rather than an error: two reps importing the same
     * doctor, or one double-tapping, is ordinary, and the second attempt should
     * land on the same person the first created.
     */
    if (professional.atlasmedId != null) {
      return {
        personId: professional.atlasmedId,
        created: false,
        occupations: professional.occupations,
      };
    }

    /*
     * A registration is what makes someone resolvable. Importing a person
     * without one produces a record no future load can recognise — next month
     * offers to create them again — so refuse rather than write a person who
     * cannot be matched.
     */
    if (professional.registrations.length === 0) {
      throw new ValidationError([
        {
          field: "professionalCnesId",
          message:
            "this professional carries no council registration we can resolve",
        },
      ]);
    }

    // Checked before writing anything: the unique would refuse the insert, and
    // an error tells the rep nothing about who the person already is.
    const held = professional.registrations.find(
      (registration) => registration.heldByPersonId != null
    );
    if (held) {
      throw new CnesRegistrationAlreadyHeldError({
        personId: held.heldByPersonId!,
        personName: held.heldByName,
        registrationLabel: `${held.councilAbbreviation} ${held.registrationNumber}/${held.stateCode}`,
      });
    }

    const fallback = splitRegistryName(professional.fullName);
    const firstName = input.firstName?.trim() || fallback.firstName;
    const lastName = input.lastName?.trim() || fallback.lastName;
    if (!firstName || !lastName) {
      throw new ValidationError([
        {
          field: "firstName",
          message: `${registrationLabel(professional)} has no usable name; firstName and lastName are required`,
        },
      ]);
    }

    const personId = await this.repository.createFromRegistry({
      professional,
      facilityId: input.facilityId,
      firstName,
      lastName,
      socialName: input.socialName ?? professional.socialName,
      // Blank is not a value: an empty string would reach `date` and `char(11)`
      // as surely as a bad one, and it is what a cleared field sends.
      cpf: cpf || null,
      birthDate: birthDate || null,
      email: input.email ?? null,
      mobilePhone: input.mobilePhone ?? null,
      landlinePhone: input.landlinePhone ?? null,
      occupationIds: resolveOccupations(input.occupationIds, professional),
      specialtyId: input.specialtyId!,
      roleIds,
      extraRegistrations: (input.extraRegistrations ?? []).map((r) => ({
        councilId: r.councilId,
        stateCode: r.stateCode.toUpperCase(),
        registrationNumber: r.registrationNumber.trim(),
      })),
      personal: {
        hobbies: input.hobbies ?? null,
        favoriteTeam: input.favoriteTeam ?? null,
        favoriteSport: input.favoriteSport ?? null,
        languages: input.languages ?? null,
      },
    });

    return { personId, created: true, occupations: professional.occupations };
  }
}
