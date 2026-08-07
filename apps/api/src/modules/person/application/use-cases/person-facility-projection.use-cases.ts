import { assertResourceInScope, type ScopeContext } from "@atlasmed/access";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type {
  ClassificationCode,
  PersonFacilityProjectionRecord,
  PersonFacilityProjectionRepository,
} from "../interfaces/person-facility-projection.repository.interface";
import { CLASSIFICATION } from "../interfaces/person-facility-projection.repository.interface";

export { CLASSIFICATION };
export type { ClassificationCode };

type Dependencies = {
  repository: PersonFacilityProjectionRepository;
};

export type PersonFacilityProjectionDto = {
  personFacilityId: number;
  personId: number;
  facilityId: number;
  firstName: string;
  lastName: string;
  socialName: string | null;
  cpf: string | null;
  email: string | null;
  mobilePhone: string | null;
  landlinePhone: string | null;
  roleTitle: string | null;
  notes: string | null;
  hasHealthcareProfile: boolean;
  classificationCodes: string[];
};

function toDto(row: PersonFacilityProjectionRecord): PersonFacilityProjectionDto {
  return {
    personFacilityId: row.personFacilityId,
    personId: row.personId,
    facilityId: row.facilityId,
    firstName: row.firstName,
    lastName: row.lastName,
    socialName: row.socialName,
    cpf: row.cpf,
    email: row.email,
    mobilePhone: row.mobilePhone,
    landlinePhone: row.landlinePhone,
    roleTitle: row.roleTitle,
    notes: row.notes,
    hasHealthcareProfile: row.hasHealthcareProfile,
    classificationCodes: row.classificationCodes,
  };
}

function assertFacilityScoped(scope: ScopeContext, facilityId: number) {
  assertResourceInScope(scope, "facility", facilityId);
}

export class ListPersonFacilityProjectionsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: number;
    classificationCode: ClassificationCode;
    scope: ScopeContext;
  }): Promise<{ data: PersonFacilityProjectionDto[] }> {
    assertFacilityScoped(input.scope, input.facilityId);
    const rows = await this.deps.repository.listActiveByFacilityAndClassification({
      facilityId: input.facilityId,
      classificationCode: input.classificationCode,
    });
    return { data: rows.map(toDto) };
  }
}

export class GetPersonFacilityProjectionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: number;
    personFacilityId: number;
    classificationCode: ClassificationCode;
    scope: ScopeContext;
  }): Promise<PersonFacilityProjectionDto> {
    assertFacilityScoped(input.scope, input.facilityId);

    const row = await this.deps.repository.findActiveById(input.personFacilityId);
    if (!row || row.endedAt) {
      throw new ResourceNotFoundError("person_facility", String(input.personFacilityId));
    }
    if (row.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("person_facility", String(input.personFacilityId));
    }
    if (!row.classificationCodes.includes(input.classificationCode)) {
      throw new ResourceNotFoundError("person_facility", String(input.personFacilityId));
    }
    return toDto(row);
  }
}

export type UpsertPersonFacilityProjectionInput = {
  facilityId: number;
  classificationCode: ClassificationCode;
  scope: ScopeContext;
  personId?: number;
  firstName?: string;
  lastName?: string;
  socialName?: string | null;
  cpf?: string | null;
  email?: string | null;
  mobilePhone?: string | null;
  landlinePhone?: string | null;
  roleTitle?: string | null;
  notes?: string | null;
};

export class UpsertPersonFacilityProjectionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: UpsertPersonFacilityProjectionInput): Promise<PersonFacilityProjectionDto> {
    assertFacilityScoped(input.scope, input.facilityId);

    let personId = input.personId;
    if (personId != null) {
      const existing = await this.deps.repository.findPersonById(personId);
      if (!existing || existing.deletedAt) {
        throw new ResourceNotFoundError("person", String(personId));
      }
    } else {
      if (!input.firstName?.trim() || !input.lastName?.trim()) {
        throw new ValidationError([
          {
            field: "firstName",
            message: "firstName and lastName are required when personId is omitted",
          },
        ]);
      }
      const created = await this.deps.repository.createPerson({
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        socialName: input.socialName,
        cpf: input.cpf,
        email: input.email,
        mobilePhone: input.mobilePhone,
        landlinePhone: input.landlinePhone,
      });
      personId = created.id;
    }

    if (input.classificationCode === CLASSIFICATION.HEALTHCARE_PROFESSIONAL) {
      await this.deps.repository.ensureHealthcareProfile(personId);
    }

    const active = await this.deps.repository.findActiveAffiliation({
      facilityId: input.facilityId,
      personId,
    });

    let personFacilityId: number;
    if (active) {
      personFacilityId = active.id;
      if (input.roleTitle !== undefined || input.notes !== undefined) {
        await this.deps.repository.updateAffiliation(personFacilityId, {
          roleTitle: input.roleTitle,
          notes: input.notes,
        });
      }
    } else {
      const created = await this.deps.repository.createAffiliation({
        personId,
        facilityId: input.facilityId,
        roleTitle: input.roleTitle,
        notes: input.notes,
      });
      personFacilityId = created.id;
    }

    await this.deps.repository.addClassification({
      personFacilityId,
      classificationCode: input.classificationCode,
    });

    const row = await this.deps.repository.findActiveById(personFacilityId);
    if (!row) {
      throw new ResourceNotFoundError("person_facility", String(personFacilityId));
    }
    return toDto(row);
  }
}

export type PatchPersonFacilityProjectionInput = {
  facilityId: number;
  personFacilityId: number;
  classificationCode: ClassificationCode;
  scope: ScopeContext;
  firstName?: string;
  lastName?: string;
  socialName?: string | null;
  cpf?: string | null;
  email?: string | null;
  mobilePhone?: string | null;
  landlinePhone?: string | null;
  roleTitle?: string | null;
  notes?: string | null;
};

export class PatchPersonFacilityProjectionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: PatchPersonFacilityProjectionInput): Promise<PersonFacilityProjectionDto> {
    assertFacilityScoped(input.scope, input.facilityId);

    const row = await this.deps.repository.findActiveById(input.personFacilityId);
    if (!row || row.endedAt) {
      throw new ResourceNotFoundError("person_facility", String(input.personFacilityId));
    }
    // URL facilityId must own this affiliation (Claude STRONGLY RECOMMENDED).
    if (row.facilityId !== input.facilityId) {
      throw new ResourceNotFoundError("person_facility", String(input.personFacilityId));
    }
    if (!row.classificationCodes.includes(input.classificationCode)) {
      throw new ResourceNotFoundError("person_facility", String(input.personFacilityId));
    }

    await this.deps.repository.updatePerson(row.personId, {
      firstName: input.firstName,
      lastName: input.lastName,
      socialName: input.socialName,
      cpf: input.cpf,
      email: input.email,
      mobilePhone: input.mobilePhone,
      landlinePhone: input.landlinePhone,
    });
    await this.deps.repository.updateAffiliation(row.personFacilityId, {
      roleTitle: input.roleTitle,
      notes: input.notes,
    });

    if (input.classificationCode === CLASSIFICATION.HEALTHCARE_PROFESSIONAL) {
      await this.deps.repository.ensureHealthcareProfile(row.personId);
    }

    const updated = await this.deps.repository.findActiveById(input.personFacilityId);
    if (!updated) {
      throw new ResourceNotFoundError("person_facility", String(input.personFacilityId));
    }
    return toDto(updated);
  }
}
