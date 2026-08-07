import { Elysia, t } from "elysia";
import { z } from "zod";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { ValidationError } from "../../../../shared/errors";
import {
  CLASSIFICATION,
  personUseCases,
} from "../../../person/composition";

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
  roleCodes: z.array(z.string().min(1)),
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
  crmNumber: t.Optional(t.Union([t.String({ minLength: 1 }), t.Null()])),
  crmState: t.Optional(t.Union([t.String({ minLength: 2, maxLength: 2 }), t.Null()])),
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

const facilityIdParams = t.Object({ facilityId: t.Integer({ minimum: 1 }) });
const affiliationParams = t.Object({
  facilityId: t.Integer({ minimum: 1 }),
  personFacilityId: t.Integer({ minimum: 1 }),
});

const listHealthcareRoute = (
  useCases: PersonProjectionsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
    .get(
      "/facilities/:facilityId/healthcare-professionals",
      async ({ params, getScope }) => {
        const scope = await getScope();
        return useCases.listFacilityProjections().execute({
          facilityId: params.facilityId,
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
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
    .post(
      "/facilities/:facilityId/healthcare-professionals",
      async ({ params, body, getScope }) => {
        const scope = await getScope();
        return useCases.upsertFacilityProjection().execute({
          facilityId: params.facilityId,
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
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
    .get(
      "/facilities/:facilityId/healthcare-professionals/:personFacilityId",
      async ({ params, getScope }) => {
        const scope = await getScope();
        return useCases.getFacilityProjection().execute({
          facilityId: params.facilityId,
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
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
    .patch(
      "/facilities/:facilityId/healthcare-professionals/:personFacilityId",
      async ({ params, body, getScope }) => {
        const scope = await getScope();
        return useCases.patchFacilityProjection().execute({
          facilityId: params.facilityId,
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

const putHealthcareRolesRoute = (
  useCases: PersonProjectionsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
    .put(
      "/facilities/:facilityId/healthcare-professionals/:personFacilityId/roles",
      async ({ params, body, getScope }) => {
        const parsed = parseSchema(rolesBodySchema, body);
        const scope = await getScope();
        return useCases.replaceFacilityProjectionRoles().execute({
          facilityId: params.facilityId,
          personFacilityId: params.personFacilityId,
          classificationCode: CLASSIFICATION.HEALTHCARE_PROFESSIONAL,
          scope,
          roleCodes: parsed.roleCodes,
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
          roleCodes: t.Array(t.String({ minLength: 1 })),
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
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
    .delete(
      "/facilities/:facilityId/healthcare-professionals/:personFacilityId",
      async ({ params, getScope, getUser }) => {
        const [scope, user] = await Promise.all([getScope(), getUser()]);
        return useCases.endFacilityAffiliation().execute({
          facilityId: params.facilityId,
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
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
    .get(
      "/facilities/:facilityId/administrative-contacts",
      async ({ params, getScope }) => {
        const scope = await getScope();
        return useCases.listFacilityProjections().execute({
          facilityId: params.facilityId,
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
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
    .post(
      "/facilities/:facilityId/administrative-contacts",
      async ({ params, body, getScope }) => {
        const scope = await getScope();
        return useCases.upsertFacilityProjection().execute({
          facilityId: params.facilityId,
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
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
    .get(
      "/facilities/:facilityId/administrative-contacts/:personFacilityId",
      async ({ params, getScope }) => {
        const scope = await getScope();
        return useCases.getFacilityProjection().execute({
          facilityId: params.facilityId,
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
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
    .patch(
      "/facilities/:facilityId/administrative-contacts/:personFacilityId",
      async ({ params, body, getScope }) => {
        const scope = await getScope();
        return useCases.patchFacilityProjection().execute({
          facilityId: params.facilityId,
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
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
    .put(
      "/facilities/:facilityId/administrative-contacts/:personFacilityId/roles",
      async ({ params, body, getScope }) => {
        const parsed = parseSchema(rolesBodySchema, body);
        const scope = await getScope();
        return useCases.replaceFacilityProjectionRoles().execute({
          facilityId: params.facilityId,
          personFacilityId: params.personFacilityId,
          classificationCode: CLASSIFICATION.ADMINISTRATIVE_CONTACT,
          scope,
          roleCodes: parsed.roleCodes,
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
          roleCodes: t.Array(t.String({ minLength: 1 })),
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
    .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
    .delete(
      "/facilities/:facilityId/administrative-contacts/:personFacilityId",
      async ({ params, getScope, getUser }) => {
        const [scope, user] = await Promise.all([getScope(), getUser()]);
        return useCases.endFacilityAffiliation().execute({
          facilityId: params.facilityId,
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
  authPlugin: any = auth
) {
  return new Elysia()
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
