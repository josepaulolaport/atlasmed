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

type Executable = { execute(input: any): Promise<any> };

export interface PersonProjectionsHttpUseCases {
  listFacilityProjections(): Executable;
  getFacilityProjection(): Executable;
  upsertFacilityProjection(): Executable;
  patchFacilityProjection(): Executable;
  replaceFacilityProjectionRoles(): Executable;
  endFacilityAffiliation(): Executable;
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
          limit: query.limit,
        }),
      {
        detail: {
          summary: "Professionals CNES associates with this facility, not yet linked",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
        params: facilityIdParams,
        query: t.Object({ limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })) }),
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
  cnesSuggestionsUseCase: Executable = new ListCnesSuggestionsUseCase()
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
