import { upsertPersonSearchDocument } from "../../infrastructure/search/person-search-index.service";
import { searchService } from "../../infrastructure/search/search.service";
import { DrizzleHealthcareProfessionalRepository } from "./infrastructure/repositories/drizzle/drizzle-healthcare-professional.repository";
import { DrizzlePersonFacilityProjectionRepository } from "./infrastructure/repositories/drizzle/drizzle-person-facility-projection.repository";
import { DrizzlePersonFacilityRoleCatalogRepository } from "./infrastructure/repositories/drizzle/drizzle-person-facility-role-catalog.repository";
import { DrizzlePersonBookmarkRepository } from "./infrastructure/repositories/drizzle/drizzle-person-bookmark.repository";
import {
  AddPersonBookmarkUseCase,
  ListPersonBookmarksUseCase,
  RemovePersonBookmarkUseCase,
} from "./application/use-cases/person-bookmark.use-cases";
import { DrizzlePersonNoteRepository } from "./infrastructure/repositories/drizzle/drizzle-person-note.repository";
import { DrizzlePersonProfessionalRegistrationCouncilRepository } from "./infrastructure/repositories/drizzle/drizzle-person-professional-registration-council.repository";
import { DrizzlePersonProfessionalRegistrationRepository } from "./infrastructure/repositories/drizzle/drizzle-person-professional-registration.repository";
import { DrizzlePersonRepository } from "./infrastructure/repositories/drizzle/drizzle-person.repository";
import { DrizzleUserPersonRelationshipRepository } from "./infrastructure/repositories/drizzle/drizzle-user-person-relationship.repository";
import { DrizzleHealthcareSpecialtyCatalogRepository } from "./infrastructure/repositories/drizzle/drizzle-healthcare-specialty-catalog.repository";
import { ListHealthcareProfessionalsUseCase } from "./application/use-cases/list-healthcare-professionals.use-case";
import { ListHealthcareSpecialtyCatalogUseCase } from "./application/use-cases/list-healthcare-specialty-catalog.use-case";
import { ReplacePersonSpecialtiesUseCase } from "./application/use-cases/replace-person-specialties.use-case";
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
const specialtyCatalogRepository = new DrizzleHealthcareSpecialtyCatalogRepository();
const personRepository = new DrizzlePersonRepository();
const registrationCouncilRepository =
  new DrizzlePersonProfessionalRegistrationCouncilRepository();
const registrationRepository =
  new DrizzlePersonProfessionalRegistrationRepository();
const userPersonRelationshipRepository =
  new DrizzleUserPersonRelationshipRepository();
const healthcareProfessionalRepository =
  new DrizzleHealthcareProfessionalRepository();

const personBookmarkRepository = new DrizzlePersonBookmarkRepository();

const personBookmarkDeps = {
  personBookmarkRepository,
  healthcareProfessionalRepository,
};

const registrationDeps = {
  registrationRepository,
  councilRepository: registrationCouncilRepository,
  onPersonSearchChanged: upsertPersonSearchDocument,
};

export const personUseCases = {
  addPersonBookmark: () => new AddPersonBookmarkUseCase(personBookmarkDeps),
  removePersonBookmark: () => new RemovePersonBookmarkUseCase(personBookmarkDeps),
  listPersonBookmarks: () => new ListPersonBookmarksUseCase(personBookmarkDeps),
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
    new GetPersonUseCase({
      personRepository,
      registrationRepository,
      personBookmarkRepository,
    }),
  patchPerson: () =>
    new PatchPersonUseCase({ personRepository, registrationRepository }),
  replacePersonSpecialties: () =>
    new ReplacePersonSpecialtiesUseCase({
      personRepository,
      specialtyCatalogRepository,
    }),

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
  listHealthcareSpecialtyCatalog: () =>
    new ListHealthcareSpecialtyCatalogUseCase({ specialtyCatalogRepository }),
};

export { CLASSIFICATION } from "./application/use-cases/person-facility-projection.use-cases";
