import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import {
  CLASSIFICATION,
  personUseCases,
} from "../../../person/composition";

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

const listHealthcareRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "PERSON"))
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
  .get(
    "/facilities/:facilityId/healthcare-professionals",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return personUseCases.listFacilityProjections().execute({
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
      params: t.Object({ facilityId: t.Integer({ minimum: 1 }) }),
    }
  );

const createHealthcareRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "PERSON"))
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
  .post(
    "/facilities/:facilityId/healthcare-professionals",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return personUseCases.upsertFacilityProjection().execute({
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
      params: t.Object({ facilityId: t.Integer({ minimum: 1 }) }),
      body: t.Object(identityBody),
    }
  );

const getHealthcareRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "PERSON"))
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
  .get(
    "/facilities/:facilityId/healthcare-professionals/:personFacilityId",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return personUseCases.getFacilityProjection().execute({
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
      params: t.Object({
        facilityId: t.Integer({ minimum: 1 }),
        personFacilityId: t.Integer({ minimum: 1 }),
      }),
    }
  );

const patchHealthcareRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "PERSON"))
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
  .patch(
    "/facilities/:facilityId/healthcare-professionals/:personFacilityId",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return personUseCases.patchFacilityProjection().execute({
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
      params: t.Object({
        facilityId: t.Integer({ minimum: 1 }),
        personFacilityId: t.Integer({ minimum: 1 }),
      }),
      body: t.Object(patchBody),
    }
  );

const listAdminRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "PERSON"))
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
  .get(
    "/facilities/:facilityId/administrative-contacts",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return personUseCases.listFacilityProjections().execute({
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
      params: t.Object({ facilityId: t.Integer({ minimum: 1 }) }),
    }
  );

const createAdminRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "PERSON"))
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
  .post(
    "/facilities/:facilityId/administrative-contacts",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return personUseCases.upsertFacilityProjection().execute({
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
      params: t.Object({ facilityId: t.Integer({ minimum: 1 }) }),
      body: t.Object(identityBody),
    }
  );

const getAdminRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "PERSON"))
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
  .get(
    "/facilities/:facilityId/administrative-contacts/:personFacilityId",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return personUseCases.getFacilityProjection().execute({
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
      params: t.Object({
        facilityId: t.Integer({ minimum: 1 }),
        personFacilityId: t.Integer({ minimum: 1 }),
      }),
    }
  );

const patchAdminRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "PERSON"))
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "facilityId" }))
  .patch(
    "/facilities/:facilityId/administrative-contacts/:personFacilityId",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return personUseCases.patchFacilityProjection().execute({
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
      params: t.Object({
        facilityId: t.Integer({ minimum: 1 }),
        personFacilityId: t.Integer({ minimum: 1 }),
      }),
      body: t.Object(patchBody),
    }
  );

export const personProjectionsRoute = new Elysia()
  .use(listHealthcareRoute)
  .use(createHealthcareRoute)
  .use(getHealthcareRoute)
  .use(patchHealthcareRoute)
  .use(listAdminRoute)
  .use(createAdminRoute)
  .use(getAdminRoute)
  .use(patchAdminRoute);
