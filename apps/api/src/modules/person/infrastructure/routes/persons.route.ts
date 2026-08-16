import { Elysia, t } from "elysia";
import { RELATIONSHIP_LEVEL_MAX, RELATIONSHIP_LEVEL_MIN } from "@atlasmed/database";
import { z } from "zod";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { ValidationError } from "../../../../shared/errors";
import { personUseCases } from "../../composition";

type Executable = { execute(input: any): Promise<any> };

export interface PersonsHttpUseCases {
  getPerson(): Executable;
  patchPerson(): Executable;
  replacePersonSpecialties(): Executable;
  listPersonNotes(): Executable;
  createPersonNote(): Executable;
  updatePersonNote(): Executable;
  deletePersonNote(): Executable;
  getPersonRelationship(): Executable;
  upsertPersonRelationship(): Executable;
  listPersonProfessionalRegistrations(): Executable;
  createPersonProfessionalRegistration(): Executable;
  updatePersonProfessionalRegistration(): Executable;
  deactivatePersonProfessionalRegistration(): Executable;
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

const MAX_PERSON_NOTE_LENGTH = 2_000;

const personNoteSchema = z.object({
  note: z.string().trim().min(1, "Note must not be empty").max(MAX_PERSON_NOTE_LENGTH),
});

const relationshipSchema = z.object({
  relationshipLevel: z
    .number()
    .int()
    .min(RELATIONSHIP_LEVEL_MIN)
    .max(RELATIONSHIP_LEVEL_MAX),
});

const personIdParams = t.Object({
  personId: t.Number({ minimum: 1 }),
});

const personNoteParams = t.Object({
  personId: t.Number({ minimum: 1 }),
  noteId: t.Number({ minimum: 1 }),
});

const personRegistrationParams = t.Object({
  personId: t.Number({ minimum: 1 }),
  registrationId: t.Number({ minimum: 1 }),
});

const createRegistrationSchema = z.object({
  councilId: z.number().int().positive(),
  stateCode: z.string().trim().min(2).max(2),
  registrationNumber: z.string().trim().min(1).max(64),
  isPrimary: z.boolean().optional(),
});

const patchRegistrationSchema = z
  .object({
    councilId: z.number().int().positive().optional(),
    stateCode: z.string().trim().min(2).max(2).optional(),
    registrationNumber: z.string().trim().min(1).max(64).optional(),
    isPrimary: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.councilId !== undefined ||
      value.stateCode !== undefined ||
      value.registrationNumber !== undefined ||
      value.isPrimary !== undefined ||
      value.isActive !== undefined,
    { message: "At least one field is required" }
  );

const nullableString = t.Union([t.String(), t.Null()]);
const nullableCpf = t.Union([
  t.String({ minLength: 11, maxLength: 11 }),
  t.Null(),
]);
const nullableBirthDate = t.Union([
  t.String({
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
  }),
  t.Null(),
]);

const patchPersonSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  socialName: z.string().trim().nullable().optional(),
  cpf: z
    .string()
    .regex(/^\d{11}$/, "CPF must be 11 digits")
    .nullable()
    .optional(),
  email: z.string().trim().nullable().optional(),
  mobilePhone: z.string().trim().nullable().optional(),
  landlinePhone: z.string().trim().nullable().optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate must be YYYY-MM-DD")
    .nullable()
    .optional(),
  favoriteTeam: z.string().trim().nullable().optional(),
  hobbies: z.string().trim().nullable().optional(),
  languages: z.string().trim().nullable().optional(),
});

const getPersonRoute = (useCases: PersonsHttpUseCases, authPlugin: any = auth) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .get(
      "/persons/:personId",
      async ({ params, getUserId }: any) => {
        return useCases.getPerson().execute({
          personId: params.personId,
          userId: await getUserId(),
        });
      },
      {
        params: personIdParams,
        detail: {
          summary: "Get person identity/profile",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const patchPersonRoute = (useCases: PersonsHttpUseCases, authPlugin: any = auth) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .patch(
      "/persons/:personId",
      async ({ params, body }) => {
        const parsed = parseSchema(patchPersonSchema, body);
        return useCases.patchPerson().execute({
          personId: params.personId,
          ...parsed,
        });
      },
      {
        params: personIdParams,
        body: t.Object({
          firstName: t.Optional(t.String({ minLength: 1 })),
          lastName: t.Optional(t.String({ minLength: 1 })),
          socialName: t.Optional(nullableString),
          cpf: t.Optional(nullableCpf),
          email: t.Optional(nullableString),
          mobilePhone: t.Optional(nullableString),
          landlinePhone: t.Optional(nullableString),
          birthDate: t.Optional(nullableBirthDate),
          favoriteTeam: t.Optional(nullableString),
          hobbies: t.Optional(nullableString),
          languages: t.Optional(nullableString),
        }),
        detail: {
          summary: "Patch person identity fields",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

/**
 * The whole selection, not a diff — the screen is a multiselect, and a
 * partially applied diff would leave the doctor tagged with neither the old set
 * nor the new one.
 */
const replacePersonSpecialtiesRoute = (
  useCases: PersonsHttpUseCases,
  authPlugin: any = auth,
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .put(
      "/persons/:personId/specialties",
      async ({ params, body }) =>
        useCases.replacePersonSpecialties().execute({
          personId: params.personId,
          specialties: body.specialties,
        }),
      {
        params: personIdParams,
        body: t.Object({
          specialties: t.Array(
            t.Object({
              id: t.Number({ minimum: 1 }),
              isPrimary: t.Boolean(),
            }),
            { maxItems: 50 },
          ),
        }),
        detail: {
          summary:
            "Set a doctor's specialties, at most one of them the primary one",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const listPersonNotesRoute = (useCases: PersonsHttpUseCases, authPlugin: any = auth) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .get(
      "/persons/:personId/notes",
      async ({ params, getUserId }) => {
        const userId = await getUserId();
        return useCases.listPersonNotes().execute({
          personId: params.personId,
          userId,
        });
      },
      {
        params: personIdParams,
        detail: {
          summary: "List my private notes for a person",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const createPersonNoteRoute = (useCases: PersonsHttpUseCases, authPlugin: any = auth) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .post(
      "/persons/:personId/notes",
      async ({ params, body, getUserId }) => {
        const parsed = parseSchema(personNoteSchema, body);
        const userId = await getUserId();
        return useCases.createPersonNote().execute({
          personId: params.personId,
          userId,
          note: parsed.note,
        });
      },
      {
        params: personIdParams,
        body: t.Object({
          note: t.String({ minLength: 1, maxLength: MAX_PERSON_NOTE_LENGTH }),
        }),
        detail: {
          summary: "Create a private note for a person",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const updatePersonNoteRoute = (useCases: PersonsHttpUseCases, authPlugin: any = auth) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .patch(
      "/persons/:personId/notes/:noteId",
      async ({ params, body, getUserId }) => {
        const parsed = parseSchema(personNoteSchema, body);
        const userId = await getUserId();
        return useCases.updatePersonNote().execute({
          personId: params.personId,
          noteId: params.noteId,
          userId,
          note: parsed.note,
        });
      },
      {
        params: personNoteParams,
        body: t.Object({
          note: t.String({ minLength: 1, maxLength: MAX_PERSON_NOTE_LENGTH }),
        }),
        detail: {
          summary: "Update my private note for a person",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const deletePersonNoteRoute = (useCases: PersonsHttpUseCases, authPlugin: any = auth) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .delete(
      "/persons/:personId/notes/:noteId",
      async ({ params, getUserId }) => {
        const userId = await getUserId();
        return useCases.deletePersonNote().execute({
          personId: params.personId,
          noteId: params.noteId,
          userId,
        });
      },
      {
        params: personNoteParams,
        detail: {
          summary: "Delete my private note for a person",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const getPersonRelationshipRoute = (
  useCases: PersonsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .get(
      "/persons/:personId/relationship",
      async ({ params, getUserId }) => {
        const userId = await getUserId();
        return useCases.getPersonRelationship().execute({
          personId: params.personId,
          userId,
        });
      },
      {
        params: personIdParams,
        detail: {
          summary: "Get my relationship level for a person",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const relationshipBody = t.Object({
  relationshipLevel: t.Number({
    minimum: RELATIONSHIP_LEVEL_MIN,
    maximum: RELATIONSHIP_LEVEL_MAX,
  }),
});

const patchPersonRelationshipRoute = (
  useCases: PersonsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .patch(
      "/persons/:personId/relationship",
      async ({ params, body, getUserId }) => {
        const parsed = parseSchema(relationshipSchema, body);
        const userId = await getUserId();
        return useCases.upsertPersonRelationship().execute({
          personId: params.personId,
          userId,
          relationshipLevel: parsed.relationshipLevel,
        });
      },
      {
        params: personIdParams,
        body: relationshipBody,
        detail: {
          summary: "Upsert my relationship level for a person (1–10)",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const putPersonRelationshipRoute = (
  useCases: PersonsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .put(
      "/persons/:personId/relationship",
      async ({ params, body, getUserId }) => {
        const parsed = parseSchema(relationshipSchema, body);
        const userId = await getUserId();
        return useCases.upsertPersonRelationship().execute({
          personId: params.personId,
          userId,
          relationshipLevel: parsed.relationshipLevel,
        });
      },
      {
        params: personIdParams,
        body: relationshipBody,
        detail: {
          summary: "Upsert my relationship level for a person (1–10)",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const listPersonRegistrationsRoute = (
  useCases: PersonsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("read", "PERSON"))
    .get(
      "/persons/:personId/professional-registrations",
      async ({ params, query }) =>
        useCases.listPersonProfessionalRegistrations().execute({
          personId: params.personId,
          includeInactive: query.includeInactive === true,
        }),
      {
        params: personIdParams,
        query: t.Object({
          includeInactive: t.Optional(t.Boolean()),
        }),
        detail: {
          summary: "List professional registrations for a person",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const createPersonRegistrationRoute = (
  useCases: PersonsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .post(
      "/persons/:personId/professional-registrations",
      async ({ params, body }) => {
        const parsed = parseSchema(createRegistrationSchema, body);
        return useCases.createPersonProfessionalRegistration().execute({
          personId: params.personId,
          ...parsed,
        });
      },
      {
        params: personIdParams,
        body: t.Object({
          councilId: t.Number({ minimum: 1 }),
          stateCode: t.String({ minLength: 2, maxLength: 2 }),
          registrationNumber: t.String({ minLength: 1, maxLength: 64 }),
          isPrimary: t.Optional(t.Boolean()),
        }),
        detail: {
          summary: "Create a professional registration for a person",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const updatePersonRegistrationRoute = (
  useCases: PersonsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .patch(
      "/persons/:personId/professional-registrations/:registrationId",
      async ({ params, body }) => {
        const parsed = parseSchema(patchRegistrationSchema, body);
        return useCases.updatePersonProfessionalRegistration().execute({
          personId: params.personId,
          registrationId: params.registrationId,
          ...parsed,
        });
      },
      {
        params: personRegistrationParams,
        body: t.Object({
          councilId: t.Optional(t.Number({ minimum: 1 })),
          stateCode: t.Optional(t.String({ minLength: 2, maxLength: 2 })),
          registrationNumber: t.Optional(
            t.String({ minLength: 1, maxLength: 64 })
          ),
          isPrimary: t.Optional(t.Boolean()),
          isActive: t.Optional(t.Boolean()),
        }),
        detail: {
          summary: "Update a professional registration",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

const deactivatePersonRegistrationRoute = (
  useCases: PersonsHttpUseCases,
  authPlugin: any = auth
) =>
  new Elysia()
    .use(authPlugin)
    .use(requirePermission("update", "PERSON"))
    .delete(
      "/persons/:personId/professional-registrations/:registrationId",
      async ({ params }) =>
        useCases.deactivatePersonProfessionalRegistration().execute({
          personId: params.personId,
          registrationId: params.registrationId,
        }),
      {
        params: personRegistrationParams,
        detail: {
          summary:
            "Soft-deactivate a professional registration (clears primary if set)",
          tags: ["Persons"],
          security: [{ bearerAuth: [] }],
        },
      }
    );

export function createPersonsRoutes(
  useCases: PersonsHttpUseCases = personUseCases,
  authPlugin: any = auth
) {
  return new Elysia()
    .use(getPersonRoute(useCases, authPlugin))
    .use(patchPersonRoute(useCases, authPlugin))
    .use(replacePersonSpecialtiesRoute(useCases, authPlugin))
    .use(listPersonNotesRoute(useCases, authPlugin))
    .use(createPersonNoteRoute(useCases, authPlugin))
    .use(updatePersonNoteRoute(useCases, authPlugin))
    .use(deletePersonNoteRoute(useCases, authPlugin))
    .use(getPersonRelationshipRoute(useCases, authPlugin))
    .use(patchPersonRelationshipRoute(useCases, authPlugin))
    .use(putPersonRelationshipRoute(useCases, authPlugin))
    .use(listPersonRegistrationsRoute(useCases, authPlugin))
    .use(createPersonRegistrationRoute(useCases, authPlugin))
    .use(updatePersonRegistrationRoute(useCases, authPlugin))
    .use(deactivatePersonRegistrationRoute(useCases, authPlugin));
}

export const personsRoute = createPersonsRoutes();
