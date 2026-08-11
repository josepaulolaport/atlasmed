import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { facilityUseCases } from "../../composition";
import { ordersUseCases } from "../../../orders/composition";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import { parseListFacilitiesQuery } from "../../application/list-facilities-query";
import { cadastroDocumentsRoute } from "./cadastro-documents.route";
import { mapFacilitiesRoute } from "./map-facilities.route";
import { personProjectionsRoute } from "./person-projections.route";

const listFacilitiesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/facilities",
    async ({ query, getScope, getUser }) => {
      const scope = await getScope();
      const actor = await getUser();
      const filters = parseListFacilitiesQuery(query);
      return facilityUseCases.listFacilities().execute({
        page: query.page,
        limit: query.limit,
        search: query.search,
        ...filters,
        scope,
        userId: actor.id,
        role: actor.role.name,
        verticalId: query.verticalId,
      });
    },
    {
      detail: {
        summary: "List clinics (coordinates exclude facilities without location; results are ordered by distance)",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        search: t.Optional(t.String()),
        latitude: t.Optional(t.String()),
        longitude: t.Optional(t.String()),
        radiusKm: t.Optional(t.String()),
        commercialStatus: t.Optional(t.String()),
        purchaseBucket: t.Optional(t.String()),
        productIds: t.Optional(
          t.String({
            description:
              "Comma-separated CRM product ids (positive integers); parsed server-side",
          }),
        ),
        clinicalFocusIds: t.Optional(t.String()),
        purchaseFunnelStage: t.Optional(t.String()),
        purchaseProfile: t.Optional(t.String()),
        purchaseIntervalMinDays: t.Optional(t.String()),
        purchaseIntervalMaxDays: t.Optional(t.String()),
        sort: t.Optional(t.String()),
        order: t.Optional(t.String()),
        verticalId: t.Optional(t.Number({ minimum: 1 })),
      }),
    }
  );

const listClinicalFocusesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/facilities/clinical-focuses",
    async () => {
      return facilityUseCases.listClinicalFocuses().execute();
    },
    {
      detail: {
        summary: "List clinical focus catalog for filters",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
    },
  );

const createFacilityRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "FACILITY"))
  .post(
    "/facilities",
    async ({ body, getScope, getUser }) => {
      const scope = await getScope();
      const actor = await getUser();
      return facilityUseCases.createFacility().execute({
        ...body,
        scope,
        role: actor.role.name,
      });
    },
    {
      detail: {
        summary:
          "Create clinic (always creates the vertical profile; verticalId required unless the caller has a single vertical)",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        name: t.String(),
        stateId: t.Integer({ minimum: 1 }),
        municipalityId: t.Integer({ minimum: 1 }),
        legalDocumentType: t.Union([t.Literal("CNPJ"), t.Literal("CPF")]),
        legalDocument: t.Optional(t.Union([t.String(), t.Null()])),
        lat: t.Optional(t.Number()),
        lng: t.Optional(t.Number()),
        verticalId: t.Optional(t.Integer({ minimum: 1 })),
      }),
    }
  );

const getFacilityRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id",
    async ({ params, getScope, getUser, query }) => {
      const scope = await getScope();
      const actor = await getUser();
      const clinic = await facilityUseCases.getFacility().execute({
        facilityId: params.id,
        scope,
        role: actor.role.name,
        verticalId: query.verticalId,
      });

      if (!clinic) {
        throw new ResourceNotFoundError("Clinic", params.id);
      }

      return clinic;
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "Get clinic by id",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        verticalId: t.Optional(t.Number({ minimum: 1 })),
      }),
    }
  );

export const purchaseRecurrenceType = t.Union([
  t.Object({ mode: t.Literal("AUTOMATIC") }, { additionalProperties: false }),
  t.Object({
    mode: t.Literal("PRESET"),
    profile: t.Union([
      t.Literal("WEEKLY"), t.Literal("BIWEEKLY"), t.Literal("MONTHLY"),
      t.Literal("BIMONTHLY"), t.Literal("QUARTERLY"), t.Literal("SEMIANNUAL"),
      t.Literal("ANNUAL"),
    ]),
  }, { additionalProperties: false }),
  t.Object({
    mode: t.Literal("CUSTOM"),
    intervalDays: t.Integer({ minimum: 1, maximum: 3650 }),
  }, { additionalProperties: false }),
]);

const updateFacilityRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .patch(
    "/facilities/:id",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      const clinic = await facilityUseCases.updateFacility().execute({
        facilityId: params.id,
        scope,
        ...body,
      });

      if (!clinic) {
        throw new ResourceNotFoundError("Clinic", params.id);
      }

      return clinic;
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "Update clinic",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        name: t.Optional(t.String()),
        lat: t.Optional(t.Union([t.Number(), t.Null()])),
        lng: t.Optional(t.Union([t.Number(), t.Null()])),
        purchaseRecurrence: t.Optional(purchaseRecurrenceType),
        /** Linha comercial — required when clinic has multiple vertical profiles. */
        verticalId: t.Optional(t.Number({ minimum: 1 })),
      }),
    }
  );

const deleteFacilityRoute = new Elysia()
  .use(auth)
  .use(requirePermission("delete", "FACILITY", { resourceIdParam: "id" }))
  .delete(
    "/facilities/:id",
    async ({ params, getScope }) => {
      const scope = await getScope();
      const deleted = await facilityUseCases.deleteFacility().execute({
        facilityId: params.id,
        scope,
      });

      if (!deleted) {
        throw new ResourceNotFoundError("Clinic", params.id);
      }

      return { message: "Facility deleted successfully" };
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "Delete clinic",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const verticalPathParams = t.Object({
  id: t.Number({ minimum: 1 }),
  verticalId: t.Number({ minimum: 1 }),
});

const listVerticalRepAssignmentsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/verticals/:verticalId/rep-assignments",
    async ({ params, getScope, getUser }) => {
      const scope = await getScope();
      const user = await getUser();
      return facilityUseCases.listVerticalRepAssignments().execute({
        facilityId: params.id,
        verticalId: params.verticalId,
        scope,
        role: user.role.name,
      });
    },
    {
      params: verticalPathParams,
      detail: {
        summary: "List facility vertical REP assignment history",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    },
  );

const assignVerticalRepRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .put(
    "/facilities/:id/verticals/:verticalId/rep",
    async ({ params, body, getUserId, getScope, getUser }) => {
      const scope = await getScope();
      const assignedByUserId = await getUserId();
      const user = await getUser();
      return facilityUseCases.assignVerticalRep().execute({
        facilityId: params.id,
        verticalId: params.verticalId,
        userId: body.userId,
        assignedByUserId,
        scope,
        role: user.role.name,
      });
    },
    {
      params: verticalPathParams,
      body: t.Object({
        userId: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "Assign or replace REP for facility vertical",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    },
  );

const unassignVerticalRepRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .delete(
    "/facilities/:id/verticals/:verticalId/rep",
    async ({ params, getScope, getUser }) => {
      const scope = await getScope();
      const user = await getUser();
      return facilityUseCases.unassignVerticalRep().execute({
        facilityId: params.id,
        verticalId: params.verticalId,
        scope,
        role: user.role.name,
      });
    },
    {
      params: verticalPathParams,
      detail: {
        summary: "End active REP assignment for facility vertical",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    },
  );

const deactivateFacilityVerticalRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .delete(
    "/facilities/:id/verticals/:verticalId",
    async ({ params, getScope, getUser }) => {
      const scope = await getScope();
      const user = await getUser();
      return facilityUseCases.deactivateFacilityVertical().execute({
        facilityId: params.id,
        verticalId: params.verticalId,
        scope,
        role: user.role.name,
      });
    },
    {
      params: verticalPathParams,
      detail: {
        summary: "Deactivate facility vertical (ends active REP, keeps history)",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    },
  );

const listConformityRequirementsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/conformity/requirements",
    async () => facilityUseCases.listConformityRequirements().execute(),
    {
      detail: {
        summary: "List conformity requirements",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const getFacilityCadastroRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/cadastro",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.getFacilityCadastroChecklist().execute({
        facilityId: params.id,
        scope,
      });
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "Get facility Cadastro checklist (PF/PJ docs + billing email)",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const updateFacilityBillingEmailRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .put(
    "/facilities/:id/billing-email",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.updateFacilityBillingEmail().execute({
        facilityId: params.id,
        scope,
        email: body.email,
      });
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "Update facility administrative email",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        email: t.String({ minLength: 3, maxLength: 320 }),
      }),
    }
  );

const approveFacilityCadastroRecordRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CADASTRO_SUBMISSION"))
  .post(
    "/facilities/:id/cadastro/records/:recordId/approve",
    async ({ params, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return facilityUseCases.approveFacilityCadastroRecord().execute({
        facilityId: params.id,
        recordId: params.recordId,
        userId,
        scope,
      });
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        recordId: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "Approve a submitted Cadastro document",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const rejectFacilityCadastroRecordRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CADASTRO_SUBMISSION"))
  .post(
    "/facilities/:id/cadastro/records/:recordId/reject",
    async ({ params, body, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return facilityUseCases.rejectFacilityCadastroRecord().execute({
        facilityId: params.id,
        recordId: params.recordId,
        userId,
        scope,
        reviewerNote: body.reviewerNote,
      });
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        recordId: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "Reject a submitted Cadastro document",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        reviewerNote: t.String({ minLength: 1, maxLength: 2000 }),
      }),
    }
  );

const listCadastroSubmissionsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "CADASTRO_SUBMISSION"))
  .get(
    "/cadastro/submissions",
    async ({ query, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.listCadastroSubmissions().execute({
        status: query.status as
          | "SUBMITTED"
          | "VALIDATED"
          | "REJECTED"
          | "UNDER_REVIEW"
          | "APPROVED"
          | undefined,
        scope,
        page: query.page,
        limit: query.limit,
      });
    },
    {
      detail: {
        summary: "List Cadastro document submissions for ops review",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        status: t.Optional(
          t.Union([
            t.Literal("SUBMITTED"),
            t.Literal("VALIDATED"),
            t.Literal("REJECTED"),
            t.Literal("UNDER_REVIEW"),
            t.Literal("APPROVED"),
          ])
        ),
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),      }),
    }
  );

const listFacilityConformityRecordsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/conformity-records",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.listFacilityConformityRecords().execute({
        facilityId: params.id,
        scope,
      });
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "List conformity records for facility",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const createFacilityConformityRecordRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/conformity-records",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.createFacilityConformityRecord().execute({
        facilityId: params.id,
        requirementId: body.requirementId,
        status: body.status,
        scope,
      });
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "Create conformity record for facility",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        requirementId: t.Number({ minimum: 1 }),
        status: t.Optional(t.Union([t.Literal("PENDING"), t.Literal("SUBMITTED")])),
      }),
    }
  );

const listFacilityOrdersRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/orders",
    async ({ params, query, getScope, getUserId, getAuthContext }) => {
      const [scope, userId, authContext] = await Promise.all([
        getScope(),
        getUserId(),
        getAuthContext(),
      ]);
      return ordersUseCases.listOrders().execute({
        facilityId: params.id,
        page: query.page ?? 1,
        limit: query.limit ?? 5,
        includeItemPreviews: true,
        verticalId: query.verticalId,
        actor: { userId, roleName: authContext.roleName },
        scope,
      });
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "List recent orders for a facility (REP: own sales only)",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1 })),        verticalId: t.Optional(t.Number({ minimum: 1 })),
      }),
    }
  );

const listFacilityVisitsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/visits",
    async ({ params, query, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      return facilityUseCases.listFacilityVisits().execute({
        facilityId: params.id,
        userId,
        scope,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
      });
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "List visits for the authenticated user at a facility",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1 })),      }),
    }
  );

const createFacilityVisitRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/visits",
    async ({ params, body, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      return facilityUseCases.createFacilityVisit().execute({
        facilityId: params.id,
        userId,
        scope,
        visitedAt: body.visitedAt,
      });
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "Create a visit for the authenticated user at a facility",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        visitedAt: t.Optional(t.String()),
      }),
    }
  );

const MAX_FACILITY_NOTE_LENGTH = 2000;

const listFacilityNotesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/notes",
    async ({ params, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return facilityUseCases.listFacilityNotes().execute({
        facilityId: params.id,
        userId,
        scope,
      });
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "List private field notes for a facility (caller-owned)",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const createFacilityNoteRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/notes",
    async ({ params, body, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return facilityUseCases.createFacilityNote().execute({
        facilityId: params.id,
        userId,
        note: body.note,
        scope,
      });
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "Create a private field note for a facility",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        note: t.String({ minLength: 1, maxLength: MAX_FACILITY_NOTE_LENGTH }),
      }),
    }
  );

const updateFacilityNoteRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .patch(
    "/facilities/:id/notes/:noteId",
    async ({ params, body, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return facilityUseCases.updateFacilityNote().execute({
        facilityId: params.id,
        noteId: params.noteId,
        userId,
        note: body.note,
        scope,
      });
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        noteId: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "Update my private field note for a facility",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        note: t.String({ minLength: 1, maxLength: MAX_FACILITY_NOTE_LENGTH }),
      }),
    }
  );

const deleteFacilityNoteRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .delete(
    "/facilities/:id/notes/:noteId",
    async ({ params, getScope, getUserId }) => {
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return facilityUseCases.deleteFacilityNote().execute({
        facilityId: params.id,
        noteId: params.noteId,
        userId,
        scope,
      });
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
        noteId: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "Delete my private field note for a facility",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const listFacilityPhotosRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/photos",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.listFacilityPhotos().execute({
        facilityId: params.id,
        scope,
      });
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "List photos for a facility",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const uploadFacilityPhotoRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/photos",
    async ({ params, body, getScope, getUserId }) => {
      const photo = body.photo;
      if (!(photo instanceof File)) {
        throw new ValidationError([
          { field: "photo", message: "Photo file is required" },
        ]);
      }
      const [scope, userId] = await Promise.all([getScope(), getUserId()]);
      return facilityUseCases.uploadFacilityPhoto().execute({
        facilityId: params.id,
        userId,
        scope,
        file: photo,
      });
    },
    {
      params: t.Object({
        id: t.Number({ minimum: 1 }),
      }),
      detail: {
        summary: "Upload a facility photo",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        photo: t.File({ description: "JPEG, PNG, or WebP image up to 5 MB" }),
      }),
    }
  );

const downloadFacilityPhotoRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/facilities/photos/*",
    async ({ params, set, getScope }) => {
      const key = params["*"];
      if (typeof key !== "string") {
        throw new ValidationError([
          { field: "key", message: "Invalid facility photo key" },
        ]);
      }
      const scope = await getScope();
      const result = await facilityUseCases.downloadFacilityPhoto().execute({
        storageKey: key,
        scope,
      });
      set.headers["content-type"] = result.contentType;
      set.headers["cache-control"] = "private, max-age=3600";
      return result.bytes;
    },
    {
      detail: {
        summary: "Download a facility photo by storage key",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

export const facilitiesRoute = new Elysia()
  .use(cadastroDocumentsRoute)
  .use(mapFacilitiesRoute)
  .use(personProjectionsRoute)
  .use(listFacilitiesRoute)
  // Before `/facilities/:id` so `clinical-focuses` is not captured as an id.
  .use(listClinicalFocusesRoute)
  .use(createFacilityRoute)
  .use(getFacilityRoute)
  .use(updateFacilityRoute)
  .use(deleteFacilityRoute)
  .use(listFacilityNotesRoute)
  .use(createFacilityNoteRoute)
  .use(updateFacilityNoteRoute)
  .use(deleteFacilityNoteRoute)
  .use(downloadFacilityPhotoRoute)
  .use(listFacilityPhotosRoute)
  .use(uploadFacilityPhotoRoute)
  .use(listVerticalRepAssignmentsRoute)
  .use(assignVerticalRepRoute)
  .use(unassignVerticalRepRoute)
  .use(deactivateFacilityVerticalRoute)
  .use(listConformityRequirementsRoute)
  .use(listFacilityConformityRecordsRoute)
  .use(createFacilityConformityRecordRoute)
  .use(getFacilityCadastroRoute)
  .use(updateFacilityBillingEmailRoute)
  .use(approveFacilityCadastroRecordRoute)
  .use(rejectFacilityCadastroRecordRoute)
  .use(listCadastroSubmissionsRoute)
  .use(listFacilityOrdersRoute)
  .use(listFacilityVisitsRoute)
  .use(createFacilityVisitRoute);