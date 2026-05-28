import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { doctorUseCases } from "../../composition";
import { ResourceNotFoundError } from "../../../../shared/errors";

const listDoctorsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "DOCTOR"))
  .get(
    "/doctors",
    async ({ query, getScope }) => {
      const scope = await getScope();
      return doctorUseCases.listDoctors().execute({
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        search: query.search,
        clinicId: query.clinicId,
        scope,
      });
    },
    {
      detail: {
        summary: "List doctors",
        tags: ["Doctors"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        search: t.Optional(t.String()),
        clinicId: t.Optional(t.String()),
      }),
    }
  );

const createDoctorRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "DOCTOR"))
  .post(
    "/doctors",
    async ({ body, getScope }) => {
      const scope = await getScope();
      return doctorUseCases.createDoctor().execute({
        ...body,
        scope,
      });
    },
    {
      detail: {
        summary: "Create doctor",
        tags: ["Doctors"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        firstName: t.String(),
        lastName: t.String(),
        specialty: t.Optional(t.String()),
        clinicIds: t.Array(t.String(), { minItems: 1 }),
      }),
    }
  );

const getDoctorRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "DOCTOR", { resourceIdParam: "id" }))
  .get(
    "/doctors/:id",
    async ({ params, getScope }) => {
      const scope = await getScope();
      const doctor = await doctorUseCases.getDoctor().execute({
        doctorId: params.id,
        scope,
      });

      if (!doctor) {
        throw new ResourceNotFoundError("Doctor", params.id);
      }

      return doctor;
    },
    {
      detail: {
        summary: "Get doctor by id",
        tags: ["Doctors"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const updateDoctorRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "DOCTOR", { resourceIdParam: "id" }))
  .patch(
    "/doctors/:id",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      const doctor = await doctorUseCases.updateDoctor().execute({
        doctorId: params.id,
        scope,
        ...body,
      });

      if (!doctor) {
        throw new ResourceNotFoundError("Doctor", params.id);
      }

      return doctor;
    },
    {
      detail: {
        summary: "Update doctor",
        tags: ["Doctors"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        firstName: t.Optional(t.String()),
        lastName: t.Optional(t.String()),
        specialty: t.Optional(t.Union([t.String(), t.Null()])),
        clinicIds: t.Optional(t.Array(t.String(), { minItems: 1 })),
      }),
    }
  );

const deleteDoctorRoute = new Elysia()
  .use(auth)
  .use(requirePermission("delete", "DOCTOR", { resourceIdParam: "id" }))
  .delete(
    "/doctors/:id",
    async ({ params, getScope }) => {
      const scope = await getScope();
      const deleted = await doctorUseCases.deleteDoctor().execute({
        doctorId: params.id,
        scope,
      });

      if (!deleted) {
        throw new ResourceNotFoundError("Doctor", params.id);
      }

      return { message: "Doctor deleted successfully" };
    },
    {
      detail: {
        summary: "Delete doctor",
        tags: ["Doctors"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

export const doctorsRoute = new Elysia()
  .use(listDoctorsRoute)
  .use(createDoctorRoute)
  .use(getDoctorRoute)
  .use(updateDoctorRoute)
  .use(deleteDoctorRoute);
