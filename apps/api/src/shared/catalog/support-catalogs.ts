import {
  clinicalFocuses,
  healthcareSpecialties,
  personFacilityRoles,
  personProfessionalRegistrationCouncils,
} from "@atlasmed/database";
import { createSimpleCatalogRepository } from "./simple-catalog";

/**
 * The support catalogues an ADMIN maintains from `Administração › Catálogos`
 * (spec 0016 §4.6 / §2.2).
 *
 * `docs/architecture/current.md` recorded these as having "no write path in
 * code" and being "populated manually" — which meant a `psql` session every time
 * a clinic needed a focus or a person a role that nobody had thought of yet.
 */
export const clinicalFocusCatalog = createSimpleCatalogRepository({
  table: clinicalFocuses,
  id: clinicalFocuses.id,
  name: clinicalFocuses.name,
  isActive: clinicalFocuses.isActive,
  // Nullable and unique-where-present, so a locally-created focus simply has
  // none rather than an invented code.
  extra: clinicalFocuses.cnesCode,
});

export const personFacilityRoleCatalog = createSimpleCatalogRepository({
  table: personFacilityRoles,
  id: personFacilityRoles.id,
  name: personFacilityRoles.name,
  isActive: personFacilityRoles.isActive,
});

/**
 * Medical specialties — editable since migration `0117`.
 *
 * `cnes_id` was `NOT NULL UNIQUE`, which made this table a mirror nobody could
 * extend: adding a specialty CNES does not list meant inventing an official id,
 * the trap spec 0013 §2 removed from the product coding columns. It is now
 * nullable and unique *where present*, so the 66 imported rows keep their ids
 * and a locally-created specialty simply has none.
 *
 * That absence is the only thing distinguishing the two, which is why the column
 * is offered as an optional field rather than hidden: an admin transcribing a
 * real CBO code should be able to.
 */
export const healthcareSpecialtyCatalog = createSimpleCatalogRepository({
  table: healthcareSpecialties,
  id: healthcareSpecialties.id,
  name: healthcareSpecialties.name,
  isActive: healthcareSpecialties.isActive,
  extra: healthcareSpecialties.cnesId,
  // A `bigint`, unlike every other second column here.
  extraKind: "number",
});

export const professionalCouncilCatalog = createSimpleCatalogRepository({
  table: personProfessionalRegistrationCouncils,
  id: personProfessionalRegistrationCouncils.id,
  name: personProfessionalRegistrationCouncils.name,
  isActive: personProfessionalRegistrationCouncils.isActive,
  // `abbreviation` is NOT NULL and unique — "CRM", "CRO". A council without one
  // could not be displayed anywhere the app shows a registration.
  extra: personProfessionalRegistrationCouncils.abbreviation,
  extraRequired: true,
});
