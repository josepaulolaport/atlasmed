import { Elysia, t } from "elysia";
import { z } from "zod";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { ValidationError } from "../../../../shared/errors";
import {
  CLASSIFICATION,
  personUseCases,
} from "../../../person/composition";
import { ListCnesSuggestionsUseCase } from "../../application/use-cases/cnes-suggestion.use-cases";
import { ImportCnesProfessionalUseCase } from "../../application/use-cases/cnes-import.use-cases";

type Executable = { execute(input: any): Promise<any> };

export interface PersonProjectionsHttpUseCases {
  listFacilityProjections(): Executable;
  getFacilityProjection(): Executable;
  upsertFacilityProjection(): Executable;
  patchFacilityProjection(): Executable;
  replaceFacilityProjectionRoles(): Executable;
  endFacilityAffiliation(): Executable;
}

/** Query values arrive as strings; anything unusable falls back to the default. */
function parsePositiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseSchema<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      }))
    );
  }

  return parsed.data;
}

const rolesBodySchema = z.object({
  roleIds: z.array(z.number().int().positive()),
});

const identityBody = {
  personId: t.Optional(t.Integer({ minimum: 1 })),
  firstName: t.Optional(t.String({ minLength: 1 })),
  lastName: t.Optional(t.String({ minLength: 1 })),
  socialName: t.Optional(t.Union([t.String(), t.Null()])),
  cpf: t.Optional(t.Union([t.String({ minLength: 11, maxLength: 11 }), t.Null()])),
  email: t.Optional(t.Union([t.String(), t.Null()])),
  mobilePhone: t.Optional(t.Union([t.String(), t.Null()])),
  landlinePhone: t.Optional(t.Union([t.String(), t.Null()])),
  roleTitle: t.Optional(t.Union([t.String(), t.Null()])),
  notes: t.Optional(t.Union([t.String(), t.Null()])),
};

const patchBody = {
  firstName: t.Optional(t.String({ minLength: 1 })),
  lastName: t.Optional(t.String({ minLength: 1 })),
  socialName: t.Optional(t.Union([t.String(), t.Null()])),
  cpf: t.Optional(t.Union([t.String({ minLength: 11, maxLength: 11 }), t.Null()])),
  email: t.Optional(t.Union([t.String(), t.Null()])),
  mobilePhone: t.Optional(t.Union([t.String(), t.Null()])),
  landlinePhone: t.Optional(t.Union([t.String(), t.Null()])),
  roleTitle: t.Optional(t.Union([t.String(), t.Null()])),
  notes: t.Optional(t.Union([t.String(), t.Null()])),
};

const facilityIdParams = t.Object({ id: t.Integer({ minimum: 1 }) });
const affiliationParams = t.Object({
  id: t.Integer({ minimum: 1 }),
  personFacilityId: t.Integer({ minimum: 1 }),
});

const listHealthcareRoute = (
  useCases: PersonProjectionsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .get(
      "/facilities/:id/healthcare-professionals",
      async ({ params, getScope }) => {
        const scope = await getScope();
        return useCases.listFacilityProjections().execute({
          facilityId: params.id,
          classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
          scope,
        });
      },
      {
        detail: {
          summary: "List healthcare professionals at a facility",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        params: facilityIdParams,
      }
    );

const createHealthcareRoute = (
  useCases: PersonProjectionsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("create", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .post(
      "/facilities/:id/healthcare-professionals",
      async ({ params, body, getScope }) => {
        const scope = await getScope();
        return useCases.upsertFacilityProjection().execute({
          facilityId: params.id,
          classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
          scope,
          ...body,
        });
      },
      {
        detail: {
          summary: "Link or create healthcare professional at a facility",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        params: facilityIdParams,
        body: t.Object(identityBody),
      }
    );

const getHealthcareRoute = (
  useCases: PersonProjectionsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .get(
      "/facilities/:id/healthcare-professionals/:personFacilityId",
      async ({ params, getScope }) => {
        const scope = await getScope();
        return useCases.getFacilityProjection().execute({
          facilityId: params.id,
          personFacilityId: params.personFacilityId,
          classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
          scope,
        });
      },
      {
        detail: {
          summary: "Get healthcare professional affiliation at a facility",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        params: affiliationParams,
      }
    );

const patchHealthcareRoute = (
  useCases: PersonProjectionsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .patch(
      "/facilities/:id/healthcare-professionals/:personFacilityId",
      async ({ params, body, getScope }) => {
        const scope = await getScope();
        return useCases.patchFacilityProjection().execute({
          facilityId: params.id,
          personFacilityId: params.personFacilityId,
          classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
          scope,
          ...body,
        });
      },
      {
        detail: {
          summary: "Update healthcare professional affiliation at a facility",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        params: affiliationParams,
        body: t.Object(patchBody),
      }
    );

/**
 * Create one of our people from a professional CNES places here (spec 0012 §6).
 *
 * `create PERSON` + `read FACILITY`, the same pair the sibling create route
 * carries — this creates a person and links them, so it is that action with the
 * identity taken from the registry instead of from the request.
 *
 * **Any role may import.** The gate is access to the clinic, not seniority: a
 * rep standing in a clinic is the person who knows whether CNES is right, and
 * routing it through someone else's queue means the roster stays wrong until
 * they get to it.
 */
const importCnesProfessionalRoute = (
  useCase: ImportCnesProfessionalUseCase = new ImportCnesProfessionalUseCase(),
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("create", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .post(
      "/facilities/:id/healthcare-professionals/cnes-imports",
      async ({ params, body, getScope }) => {
        const scope = await getScope();
        return useCase.execute({
          facilityId: params.id,
          scope,
          ...body,
        });
      },
      {
        detail: {
          summary: "Create a person from a CNES-registered professional",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        params: facilityIdParams,
        body: t.Object({
          professionalCnesId: t.String({ minLength: 1 }),
          /*
           * Names only. The council registration is deliberately absent: it is
           * copied from the registry, because it is the field that has to match
           * CNES and the one a hurried rep is most likely to mistype.
           */
          firstName: t.Optional(t.String({ minLength: 1 })),
          lastName: t.Optional(t.String({ minLength: 1 })),
          socialName: t.Optional(t.Union([t.String(), t.Null()])),
          cpf: t.Optional(
            t.Union([t.String({ minLength: 11, maxLength: 11 }), t.Null()])
          ),
          email: t.Optional(t.Union([t.String(), t.Null()])),
          mobilePhone: t.Optional(t.Union([t.String(), t.Null()])),
        }),
      }
    );

/**
 * CNES-suggested professionals for a clinic (spec 0012 §5).
 *
 * Read-only and scoped to one facility, so it carries the same permissions as
 * the roster it sits beside — a suggestion reveals that a person exists and
 * where they work, which is exactly what `read PERSON` + `read FACILITY` gate.
 */
const listCnesSuggestionsRoute = (
  useCase: Executable = new ListCnesSuggestionsUseCase(),
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .get(
      "/facilities/:id/healthcare-professionals/cnes-suggestions",
      async ({ params, query }) =>
        useCase.execute({
          facilityId: params.id,
          // Parsed here rather than declared as a `query` schema. Every sibling
          // route in this file declares none and therefore tolerates whatever
          // the client attaches; a strict `t.Object` on this one route would
          // turn any extra parameter into a 422, which the app renders as
          // "não foi possível consultar" — indistinguishable from CNES being
          // down. The use case clamps the value, so the edge check bought
          // nothing.
          limit: parsePositiveInt((query as Record<string, unknown>)?.limit),
        }),
      {
        detail: {
          summary: "Professionals CNES associates with this facility, not yet linked",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        params: facilityIdParams,
      }
    );

const putHealthcareRolesRoute = (
  useCases: PersonProjectionsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .put(
      "/facilities/:id/healthcare-professionals/:personFacilityId/roles",
      async ({ params, body, getScope }) => {
        const parsed = parseSchema(rolesBodySchema, body);
        const scope = await getScope();
        return useCases.replaceFacilityProjectionRoles().execute({
          facilityId: params.id,
          personFacilityId: params.personFacilityId,
          classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
          scope,
          roleIds: parsed.roleIds,
        });
      },
      {
        detail: {
          summary: "Replace healthcare professional role assignments at a facility",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        params: affiliationParams,
        body: t.Object({
          roleIds: t.Array(t.Integer({ minimum: 1 })),
        }),
      }
    );

const deleteHealthcareRoute = (
  useCases: PersonProjectionsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .delete(
      "/facilities/:id/healthcare-professionals/:personFacilityId",
      async ({ params, getScope, getUser }) => {
        const [scope, user] = await Promise.all([getScope(), getUser()]);
        return useCases.endFacilityAffiliation().execute({
          facilityId: params.id,
          personFacilityId: params.personFacilityId,
          classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
          scope,
          endedByUserId: user.id,
        });
      },
      {
        detail: {
          summary: "End healthcare professional affiliation at a facility",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        params: affiliationParams,
      }
    );

const listAdminRoute = (
  useCases: PersonProjectionsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .get(
      "/facilities/:id/administrative-contacts",
      async ({ params, getScope }) => {
        const scope = await getScope();
        return useCases.listFacilityProjections().execute({
          facilityId: params.id,
          classificationCode: CLASSIFICATION.ADMINISTRATIVE_CONTACT,
          scope,
        });
      },
      {
        detail: {
          summary: "List administrative contacts at a facility",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        params: facilityIdParams,
      }
    );

const createAdminRoute = (
  useCases: PersonProjectionsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("create", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .post(
      "/facilities/:id/administrative-contacts",
      async ({ params, body, getScope }) => {
        const scope = await getScope();
        return useCases.upsertFacilityProjection().execute({
          facilityId: params.id,
          classificationCode: CLASSIFICATION.ADMINISTRATIVE_CONTACT,
          scope,
          ...body,
        });
      },
      {
        detail: {
          summary: "Link or create administrative contact at a facility",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        params: facilityIdParams,
        body: t.Object(identityBody),
      }
    );

const getAdminRoute = (
  useCases: PersonProjectionsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .get(
      "/facilities/:id/administrative-contacts/:personFacilityId",
      async ({ params, getScope }) => {
        const scope = await getScope();
        return useCases.getFacilityProjection().execute({
          facilityId: params.id,
          personFacilityId: params.personFacilityId,
          classificationCode: CLASSIFICATION.ADMINISTRATIVE_CONTACT,
          scope,
        });
      },
      {
        detail: {
          summary: "Get administrative contact affiliation at a facility",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        params: affiliationParams,
      }
    );

const patchAdminRoute = (
  useCases: PersonProjectionsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .patch(
      "/facilities/:id/administrative-contacts/:personFacilityId",
      async ({ params, body, getScope }) => {
        const scope = await getScope();
        return useCases.patchFacilityProjection().execute({
          facilityId: params.id,
          personFacilityId: params.personFacilityId,
          classificationCode: CLASSIFICATION.ADMINISTRATIVE_CONTACT,
          scope,
          ...body,
        });
      },
      {
        detail: {
          summary: "Update administrative contact affiliation at a facility",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        params: affiliationParams,
        body: t.Object(patchBody),
      }
    );

const putAdminRolesRoute = (
  useCases: PersonProjectionsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .put(
      "/facilities/:id/administrative-contacts/:personFacilityId/roles",
      async ({ params, body, getScope }) => {
        const parsed = parseSchema(rolesBodySchema, body);
        const scope = await getScope();
        return useCases.replaceFacilityProjectionRoles().execute({
          facilityId: params.id,
          personFacilityId: params.personFacilityId,
          classificationCode: CLASSIFICATION.ADMINISTRATIVE_CONTACT,
          scope,
          roleIds: parsed.roleIds,
        });
      },
      {
        detail: {
          summary: "Replace administrative contact role assignments at a facility",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        params: affiliationParams,
        body: t.Object({
          roleIds: t.Array(t.Integer({ minimum: 1 })),
        }),
      }
    );

const deleteAdminRoute = (
  useCases: PersonProjectionsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
    .delete(
      "/facilities/:id/administrative-contacts/:personFacilityId",
      async ({ params, getScope, getUser }) => {
        const [scope, user] = await Promise.all([getScope(), getUser()]);
        return useCases.endFacilityAffiliation().execute({
          facilityId: params.id,
          personFacilityId: params.personFacilityId,
          classificationCode: CLASSIFICATION.ADMINISTRATIVE_CONTACT,
          scope,
          endedByUserId: user.id,
        });
      },
      {
        detail: {
          summary: "End administrative contact affiliation at a facility",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        params: affiliationParams,
      }
    );

export function createPersonProjectionsRoutes(
  useCases: PersonProjectionsHttpUseCases = personUseCases,
  authPlugin: any = auth,
  cnesSuggestionsUseCase: Executable = new ListCnesSuggestionsUseCase(),
  cnesImportUseCase: ImportCnesProfessionalUseCase = new ImportCnesProfessionalUseCase()
) {
  return new Elysia()
    /**
     * `cnes-suggestions` occupies the same path slot as `:personFacilityId` in
     * `getHealthcareRoute`, which is typed as an integer — so if the dynamic
     * route won the match, this endpoint would 422 instead of answering.
     *
     * It does not: Elysia's router prefers the static segment, verified by
     * registering this route last and watching the integration test still pass.
     * The order here is only for readability, and the test is the real guard.
     */
    .use(listCnesSuggestionsRoute(cnesSuggestionsUseCase, authPlugin))
    // Static segment, same as `cnes-suggestions` above, and registered before
    // the `:personFacilityId` routes for the same reason.
    .use(importCnesProfessionalRoute(cnesImportUseCase, authPlugin))
    .use(listHealthcareRoute(useCases, authPlugin))
    .use(createHealthcareRoute(useCases, authPlugin))
    .use(getHealthcareRoute(useCases, authPlugin))
    .use(patchHealthcareRoute(useCases, authPlugin))
    .use(putHealthcareRolesRoute(useCases, authPlugin))
    .use(deleteHealthcareRoute(useCases, authPlugin))
    .use(listAdminRoute(useCases, authPlugin))
    .use(createAdminRoute(useCases, authPlugin))
    .use(getAdminRoute(useCases, authPlugin))
    .use(patchAdminRoute(useCases, authPlugin))
    .use(putAdminRolesRoute(useCases, authPlugin))
    .use(deleteAdminRoute(useCases, authPlugin));
}

export const personProjectionsRoute = createPersonProjectionsRoutes();
