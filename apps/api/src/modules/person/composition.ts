import { searchService } from "../../infrastructure/search/search.service";
import { DrizzleHealthcareProfessionalRepository } from "./infrastructure/repositories/drizzle/drizzle-healthcare-professional.repository";
import { DrizzlePersonFacilityProjectionRepository } from "./infrastructure/repositories/drizzle/drizzle-person-facility-projection.repository";
import { DrizzlePersonFacilityRoleCatalogRepository } from "./infrastructure/repositories/drizzle/drizzle-person-facility-role-catalog.repository";
import { DrizzlePersonNoteRepository } from "./infrastructure/repositories/drizzle/drizzle-person-note.repository";
import { DrizzlePersonProfessionalRegistrationCouncilRepository } from "./infrastructure/repositories/drizzle/drizzle-person-professional-registration-council.repository";
import { DrizzlePersonProfessionalRegistrationRepository } from "./infrastructure/repositories/drizzle/drizzle-person-professional-registration.repository";
import { DrizzlePersonRepository } from "./infrastructure/repositories/drizzle/drizzle-person.repository";
import { DrizzleUserPersonRelationshipRepository } from "./infrastructure/repositories/drizzle/drizzle-user-person-relationship.repository";
import { ListHealthcareProfessionalsUseCase } from "./application/use-cases/list-healthcare-professionals.use-case";
import { ListPersonFacilityRolesUseCase } from "./application/use-cases/list-person-facility-roles.use-case";
import { ListPersonProfessionalRegistrationCouncilsUseCase } from "./application/use-cases/list-person-professional-registration-councils.use-case";
import {
  CreatePersonNoteUseCase,
  DeletePersonNoteUseCase,
  ListPersonNotesUseCase,
  UpdatePersonNoteUseCase,
} from "./application/use-cases/person-note.use-cases";
import {
  CreatePersonProfessionalRegistrationUseCase,
  DeactivatePersonProfessionalRegistrationUseCase,
  ListPersonProfessionalRegistrationsUseCase,
  UpdatePersonProfessionalRegistrationUseCase,
} from "./application/use-cases/person-professional-registration.use-cases";
import {
  GetPersonUseCase,
  ListHealthcareSpecialtiesUseCase,
  PatchPersonUseCase,
} from "./application/use-cases/person.use-cases";
import {
  EndPersonFacilityAffiliationUseCase,
  GetPersonFacilityProjectionUseCase,
  ListPersonFacilityProjectionsUseCase,
  PatchPersonFacilityProjectionUseCase,
  ReplacePersonFacilityRolesUseCase,
  UpsertPersonFacilityProjectionUseCase,
} from "./application/use-cases/person-facility-projection.use-cases";
import {
  GetUserPersonRelationshipUseCase,
  UpsertUserPersonRelationshipUseCase,
} from "./application/use-cases/user-person-relationship.use-cases";

const projectionRepository = new DrizzlePersonFacilityProjectionRepository();
const roleCatalogRepository = new DrizzlePersonFacilityRoleCatalogRepository();
const personNoteRepository = new DrizzlePersonNoteRepository();
const personRepository = new DrizzlePersonRepository();
const registrationCouncilRepository =
  new DrizzlePersonProfessionalRegistrationCouncilRepository();
const registrationRepository =
  new DrizzlePersonProfessionalRegistrationRepository();
const userPersonRelationshipRepository =
  new DrizzleUserPersonRelationshipRepository();
const healthcareProfessionalRepository =
  new DrizzleHealthcareProfessionalRepository();

const registrationDeps = {
  registrationRepository,
  councilRepository: registrationCouncilRepository,
};

export const personUseCases = {
  listFacilityProjections: () =>
    new ListPersonFacilityProjectionsUseCase({ repository: projectionRepository }),
  getFacilityProjection: () =>
    new GetPersonFacilityProjectionUseCase({ repository: projectionRepository }),
  upsertFacilityProjection: () =>
    new UpsertPersonFacilityProjectionUseCase({ repository: projectionRepository }),
  patchFacilityProjection: () =>
    new PatchPersonFacilityProjectionUseCase({ repository: projectionRepository }),
  replaceFacilityProjectionRoles: () =>
    new ReplacePersonFacilityRolesUseCase({
      repository: projectionRepository,
      roleCatalogRepository,
    }),
  endFacilityAffiliation: () =>
    new EndPersonFacilityAffiliationUseCase({ repository: projectionRepository }),
  listPersonFacilityRoles: () =>
    new ListPersonFacilityRolesUseCase({ roleCatalogRepository }),

  getPerson: () =>
    new GetPersonUseCase({ personRepository, registrationRepository }),
  patchPerson: () =>
    new PatchPersonUseCase({ personRepository, registrationRepository }),

  listPersonNotes: () =>
    new ListPersonNotesUseCase({ personNoteRepository }),
  createPersonNote: () =>
    new CreatePersonNoteUseCase({ personNoteRepository }),
  updatePersonNote: () =>
    new UpdatePersonNoteUseCase({ personNoteRepository }),
  deletePersonNote: () =>
    new DeletePersonNoteUseCase({ personNoteRepository }),

  getPersonRelationship: () =>
    new GetUserPersonRelationshipUseCase({ userPersonRelationshipRepository }),
  upsertPersonRelationship: () =>
    new UpsertUserPersonRelationshipUseCase({ userPersonRelationshipRepository }),

  listPersonProfessionalRegistrationCouncils: () =>
    new ListPersonProfessionalRegistrationCouncilsUseCase({
      councilRepository: registrationCouncilRepository,
    }),
  listPersonProfessionalRegistrations: () =>
    new ListPersonProfessionalRegistrationsUseCase(registrationDeps),
  createPersonProfessionalRegistration: () =>
    new CreatePersonProfessionalRegistrationUseCase(registrationDeps),
  updatePersonProfessionalRegistration: () =>
    new UpdatePersonProfessionalRegistrationUseCase(registrationDeps),
  deactivatePersonProfessionalRegistration: () =>
    new DeactivatePersonProfessionalRegistrationUseCase(registrationDeps),

  listHealthcareProfessionals: () =>
    new ListHealthcareProfessionalsUseCase({
      healthcareProfessionalRepository,
      userPersonRelationshipRepository,
      searchService,
    }),
  listHealthcareSpecialties: () =>
    new ListHealthcareSpecialtiesUseCase({ personRepository }),
};

export { CLASSIFICATION } from "./application/use-cases/person-facility-projection.use-cases";
