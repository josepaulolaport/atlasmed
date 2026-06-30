import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { doctorUseCases } from "../../composition";
import { ResourceNotFoundError } from "../../../../shared/errors";

const listProfessionalsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "PROFESSIONAL"))
  .get(
    "/professionals",
    async ({ query, getScope }) => {
      const scope = await getScope();
      return doctorUseCases.listProfessionals().execute({
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        search: query.search,
        facilityId: query.facilityId,
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
        facilityId: t.Optional(t.String()),
      }),
    }
  );

const createDoctorRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "PROFESSIONAL"))
  .post(
    "/professionals",
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
        facilityIds: t.Optional(t.Array(t.String())),
      }),
    }
  );

const getProfessionalRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "PROFESSIONAL", { resourceIdParam: "id" }))
  .get(
    "/professionals/:id",
    async ({ params, getScope }) => {
      const scope = await getScope();
      const doctor = await doctorUseCases.getProfessional().execute({
        professionalId: params.id,
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
  .use(requirePermission("update", "PROFESSIONAL", { resourceIdParam: "id" }))
  .patch(
    "/professionals/:id",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      const doctor = await doctorUseCases.updateDoctor().execute({
        professionalId: params.id,
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
        facilityIds: t.Optional(t.Array(t.String(), { minItems: 1 })),
      }),
    }
  );

const deleteDoctorRoute = new Elysia()
  .use(auth)
  .use(requirePermission("delete", "PROFESSIONAL", { resourceIdParam: "id" }))
  .delete(
    "/professionals/:id",
    async ({ params, getScope }) => {
      const scope = await getScope();
      const deleted = await doctorUseCases.deleteDoctor().execute({
        professionalId: params.id,
        scope,
      });

      if (!deleted) {
        throw new ResourceNotFoundError("Doctor", params.id);
      }

      return { message: "Professional deleted successfully" };
    },
    {
      detail: {
        summary: "Delete doctor",
        tags: ["Doctors"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

export const professionalsRoute = new Elysia()
  .use(listProfessionalsRoute)
  .use(createDoctorRoute)
  .use(getProfessionalRoute)
  .use(updateDoctorRoute)
  .use(deleteDoctorRoute);
