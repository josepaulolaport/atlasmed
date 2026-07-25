import { Elysia, t } from "elysia";
import {
  createProfessionalSchema,
  updateProfessionalSchema,
} from "@atlasmed/access";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { doctorUseCases } from "../../composition";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import { parseListProfessionalsQuery } from "../../application/list-professionals-query";
import { z } from "zod";

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

const professionalPersonBody = {
  fullName: t.Optional(t.Union([t.String(), t.Null()])),
  socialName: t.Optional(t.Union([t.String(), t.Null()])),
  taxId: t.Optional(t.Union([t.String(), t.Null()])),
  birthDate: t.Optional(t.Union([t.String(), t.Null()])),
  mobilePhone: t.Optional(t.Union([t.String(), t.Null()])),
  landlinePhone: t.Optional(t.Union([t.String(), t.Null()])),
  email: t.Optional(t.Union([t.String(), t.Null()])),
  websiteUrl: t.Optional(t.Union([t.String(), t.Null()])),
  imageUrl: t.Optional(t.Union([t.String(), t.Null()])),
  primarySpecialtyLabel: t.Optional(t.Union([t.String(), t.Null()])),
  specialty: t.Optional(t.Union([t.String(), t.Null()])),
  crmCouncil: t.Optional(t.Union([t.String(), t.Null()])),
  crmNumber: t.Optional(t.Union([t.String(), t.Null()])),
  crmState: t.Optional(t.Union([t.String(), t.Null()])),
  favoriteTeam: t.Optional(t.Union([t.String(), t.Null()])),
  favoriteSport: t.Optional(t.Union([t.String(), t.Null()])),
  languages: t.Optional(t.Union([t.String(), t.Null()])),
  hobbies: t.Optional(t.Union([t.String(), t.Null()])),
  notes: t.Optional(t.Union([t.String(), t.Null()])),
};

const listProfessionalsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "PROFESSIONAL"))
  .get(
    "/professionals",
    async ({ query, getScope }) => {
      const scope = await getScope();
      const filters = parseListProfessionalsQuery(query);
      return doctorUseCases.listProfessionals().execute({
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        search: query.search,
        facilityId: query.facilityId,
        ...filters,
        scope,
      });
    },
    {
      detail: {
        summary: "List professionals (coordinates use nearest visible linked facility and exclude professionals without one)",
        tags: ["Professionals"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        search: t.Optional(t.String()),
        facilityId: t.Optional(t.String()),
        latitude: t.Optional(t.String()),
        longitude: t.Optional(t.String()),
        radiusKm: t.Optional(t.String()),
        specialty: t.Optional(t.String()),
      }),
    }
  );

/** Static path — must register before `/professionals/:id`. */
const listProfessionalSpecialtiesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "PROFESSIONAL"))
  .get(
    "/professionals/specialties",
    async ({ getScope }) => {
      const scope = await getScope();
      return doctorUseCases.listProfessionalSpecialties().execute({ scope });
    },
    {
      detail: {
        summary: "List distinct professional specialty labels visible in the caller's scope",
        tags: ["Professionals"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const createDoctorRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "PROFESSIONAL"))
  .post(
    "/professionals",
    async ({ body, getScope }) => {
      const scope = await getScope();
      const parsed = parseSchema(createProfessionalSchema, body);
      return doctorUseCases.createDoctor().execute({
        ...parsed,
        scope,
      });
    },
    {
      detail: {
        summary: "Create professional",
        tags: ["Professionals"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        firstName: t.String(),
        lastName: t.String(),
        ...professionalPersonBody,
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
      const professional = await doctorUseCases.getProfessional().execute({
        professionalId: params.id,
        scope,
      });

      if (!professional) {
        throw new ResourceNotFoundError("Professional", params.id);
      }

      return professional;
    },
    {
      detail: {
        summary: "Get professional by id",
        tags: ["Professionals"],
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
      const parsed = parseSchema(updateProfessionalSchema, body);
      const professional = await doctorUseCases.updateDoctor().execute({
        professionalId: params.id,
        scope,
        ...parsed,
      });

      if (!professional) {
        throw new ResourceNotFoundError("Professional", params.id);
      }

      return professional;
    },
    {
      detail: {
        summary: "Update professional",
        tags: ["Professionals"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        firstName: t.Optional(t.String()),
        lastName: t.Optional(t.String()),
        ...professionalPersonBody,
        facilityIds: t.Optional(t.Array(t.String(), { minItems: 1 })),
      }),
    }
  );

const professionalNoteSchema = z.object({
  note: z.string().trim().min(1, "Note must not be empty").max(2_000),
});

const MAX_PROFESSIONAL_NOTE_LENGTH = 2_000;

const professionalNoteBody = t.Object({
  note: t.String({ minLength: 1, maxLength: MAX_PROFESSIONAL_NOTE_LENGTH }),
});

const listProfessionalNotesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "PROFESSIONAL", { resourceIdParam: "id" }))
  .get(
    "/professionals/:id/notes",
    async ({ params, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return doctorUseCases.listProfessionalNotes().execute({
        professionalId: params.id,
        userId,
        scope,
      });
    },
    {
      detail: {
        summary: "List my notes for a professional",
        tags: ["Professionals"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const createProfessionalNoteRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "PROFESSIONAL", { resourceIdParam: "id" }))
  .post(
    "/professionals/:id/notes",
    async ({ params, body, getScope, getUserId }) => {
      const parsed = parseSchema(
        professionalNoteSchema,
        body
      );
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return doctorUseCases.createProfessionalNote().execute({
        professionalId: params.id,
        userId,
        note: parsed.note,
        scope,
      });
    },
    {
      detail: {
        summary: "Create a private note for a professional",
        tags: ["Professionals"],
        security: [{ bearerAuth: [] }],
      },
      body: professionalNoteBody,
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
        throw new ResourceNotFoundError("Professional", params.id);
      }

      return { message: "Professional deleted successfully" };
    },
    {
      detail: {
        summary: "Delete professional",
        tags: ["Professionals"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

export const professionalsRoute = new Elysia()
  .use(listProfessionalsRoute)
  .use(listProfessionalSpecialtiesRoute)
  .use(createDoctorRoute)
  .use(listProfessionalNotesRoute)
  .use(createProfessionalNoteRoute)
  .use(getProfessionalRoute)
  .use(updateDoctorRoute)
  .use(deleteDoctorRoute);
