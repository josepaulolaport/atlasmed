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

function registrationLabel(professional: RegistryProfessional): string {
  const first = professional.registrations[0];
  if (!first) return "Esta inscrição";
  return `${first.councilAbbreviation} ${first.registrationNumber}/${first.stateCode}`;
}

export class ImportCnesProfessionalUseCase {
  constructor(
    private readonly repository = new DrizzleCnesImportRepository()
  ) {}

  async execute(
    input: ImportCnesProfessionalInput
  ): Promise<ImportCnesProfessionalResult> {
    assertResourceInScope(input.scope, "facility", input.facilityId);

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
      cpf: input.cpf ?? null,
      email: input.email ?? null,
      mobilePhone: input.mobilePhone ?? null,
      occupationIds: resolveOccupations(input.occupationIds, professional),
    });

    return { personId, created: true, occupations: professional.occupations };
  }
}
