import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { clinicUseCases } from "../../composition";
import { ResourceNotFoundError } from "../../../../shared/errors";

const listClinicsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CLINIC"))
  .get(
    "/clinics",
    async ({ query, getScope }) => {
      const scope = await getScope();
      return clinicUseCases.listClinics().execute({
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        search: query.search,
        scope,
      });
    },
    {
      detail: {
        summary: "List clinics",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    }
  );

const createClinicRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "CLINIC"))
  .post(
    "/clinics",
    async ({ body }) => {
      return clinicUseCases.createClinic().execute(body);
    },
    {
      detail: {
        summary: "Create clinic",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        name: t.String(),
        address: t.Optional(t.String()),
        lat: t.Optional(t.Number()),
        lng: t.Optional(t.Number()),
      }),
    }
  );

const getClinicRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CLINIC", { resourceIdParam: "id" }))
  .get(
    "/clinics/:id",
    async ({ params, getScope }) => {
      const scope = await getScope();
      const clinic = await clinicUseCases.getClinic().execute({
        clinicId: params.id,
        scope,
      });

      if (!clinic) {
        throw new ResourceNotFoundError("Clinic", params.id);
      }

      return clinic;
    },
    {
      detail: {
        summary: "Get clinic by id",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const updateClinicRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CLINIC", { resourceIdParam: "id" }))
  .patch(
    "/clinics/:id",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      const clinic = await clinicUseCases.updateClinic().execute({
        clinicId: params.id,
        scope,
        ...body,
      });

      if (!clinic) {
        throw new ResourceNotFoundError("Clinic", params.id);
      }

      return clinic;
    },
    {
      detail: {
        summary: "Update clinic",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        name: t.Optional(t.String()),
        address: t.Optional(t.Union([t.String(), t.Null()])),
        lat: t.Optional(t.Union([t.Number(), t.Null()])),
        lng: t.Optional(t.Union([t.Number(), t.Null()])),
      }),
    }
  );

const deleteClinicRoute = new Elysia()
  .use(auth)
  .use(requirePermission("delete", "CLINIC", { resourceIdParam: "id" }))
  .delete(
    "/clinics/:id",
    async ({ params, getScope }) => {
      const scope = await getScope();
      const deleted = await clinicUseCases.deleteClinic().execute({
        clinicId: params.id,
        scope,
      });

      if (!deleted) {
        throw new ResourceNotFoundError("Clinic", params.id);
      }

      return { message: "Clinic deleted successfully" };
    },
    {
      detail: {
        summary: "Delete clinic",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const listClinicDoctorsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CLINIC", { resourceIdParam: "id" }))
  .get(
    "/clinics/:id/doctors",
    async ({ params, query, getScope }) => {
      const scope = await getScope();
      return clinicUseCases.listClinicDoctors().execute({
        clinicId: params.id,
        scope,
        view: query.view as "source" | "confirmed" | "pending" | "all" | undefined,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        search: query.search,
      });
    },
    {
      detail: {
        summary: "List doctors for a clinic by association view",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        view: t.Optional(
          t.Union([
            t.Literal("source"),
            t.Literal("confirmed"),
            t.Literal("pending"),
            t.Literal("all"),
          ])
        ),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    }
  );

const confirmDoctorRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CLINIC", { resourceIdParam: "id" }))
  .post(
    "/clinics/:id/doctors/:doctorId/confirm",
    async ({ params, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      return clinicUseCases.confirmDoctorAtClinic().execute({
        clinicId: params.id,
        doctorId: params.doctorId,
        userId,
        scope,
      });
    },
    {
      detail: {
        summary: "Confirm a source-listed doctor at a clinic",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const associateDoctorRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CLINIC", { resourceIdParam: "id" }))
  .post(
    "/clinics/:id/doctors/:doctorId/associate",
    async ({ params, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      return clinicUseCases.manuallyAssociateDoctor().execute({
        clinicId: params.id,
        doctorId: params.doctorId,
        userId,
        scope,
      });
    },
    {
      detail: {
        summary: "Manually associate a doctor with a clinic",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const endDoctorAssociationRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CLINIC", { resourceIdParam: "id" }))
  .delete(
    "/clinics/:id/doctors/:doctorId",
    async ({ params, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      const result = await clinicUseCases.endDoctorClinicAssociation().execute({
        clinicId: params.id,
        doctorId: params.doctorId,
        userId,
        scope,
      });

      if (!result) {
        throw new ResourceNotFoundError("DoctorClinicAssociation", params.doctorId);
      }

      return result;
    },
    {
      detail: {
        summary: "End doctor-clinic association",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

export const clinicsRoute = new Elysia()
  .use(listClinicsRoute)
  .use(createClinicRoute)
  .use(getClinicRoute)
  .use(updateClinicRoute)
  .use(deleteClinicRoute)
  .use(listClinicDoctorsRoute)
  .use(confirmDoctorRoute)
  .use(associateDoctorRoute)
  .use(endDoctorAssociationRoute);
