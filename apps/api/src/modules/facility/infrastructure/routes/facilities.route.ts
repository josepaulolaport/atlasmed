import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { facilityUseCases } from "../../composition";
import { ordersUseCases } from "../../../orders/composition";
import { registryReadService } from "../../../registry-ingestion/composition";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import { parseListFacilitiesQuery } from "../../application/list-facilities-query";
import { cadastroSubmissionsRoute } from "./cadastro-submissions.route";
import { mapFacilitiesRoute } from "./map-facilities.route";

const listFacilitiesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/facilities",
    async ({ query, getScope, getUser }: any) => {
      const scope = await getScope();
      const actor = await getUser();
      const filters = parseListFacilitiesQuery(query);
      return facilityUseCases.listFacilities().execute({
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
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
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        search: t.Optional(t.String()),
        latitude: t.Optional(t.String()),
        longitude: t.Optional(t.String()),
        radiusKm: t.Optional(t.String()),
        commercialStatus: t.Optional(t.String()),
        purchaseBucket: t.Optional(t.String()),
        productIds: t.Optional(t.String()),
        serviceCodes: t.Optional(t.String()),
        purchaseFunnelStage: t.Optional(t.String()),
        purchaseProfile: t.Optional(t.String()),
        purchaseIntervalMinDays: t.Optional(t.String()),
        purchaseIntervalMaxDays: t.Optional(t.String()),
        sort: t.Optional(t.String()),
        order: t.Optional(t.String()),
        verticalId: t.Optional(t.String()),
      }),
    }
  );

const listFacilityServicesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/facilities/services",
    async () => {
      return facilityUseCases.listFacilityServices().execute();
    },
    {
      detail: {
        summary: "List CNES facility service catalog for filters",
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
    async ({ body }) => {
      return facilityUseCases.createFacility().execute(body);
    },
    {
      detail: {
        summary: "Create clinic",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        name: t.String(),
        lat: t.Optional(t.Number()),
        lng: t.Optional(t.Number()),
      }),
    }
  );

const getFacilityRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id",
    async ({ params, getScope, getUser, query }: any) => {
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
      detail: {
        summary: "Get clinic by id",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        verticalId: t.Optional(t.String()),
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
        verticalId: t.Optional(t.String()),
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
      detail: {
        summary: "Delete clinic",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const listFacilityProfessionalsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/professionals",
    async ({ params, query, getScope, getUserId }) => {
      const scope = await getScope();
      const userId = await getUserId();
      return facilityUseCases.listFacilityProfessionals().execute({
        facilityId: params.id,
        scope,
        userId,
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

const representativeRoleBody = {
  isPartner: t.Optional(t.Boolean()),
  isAdministrator: t.Optional(t.Boolean()),
  isDecisionMaker: t.Optional(t.Boolean()),
  isBuyer: t.Optional(t.Boolean()),
  isBiller: t.Optional(t.Boolean()),
  isSecretary: t.Optional(t.Boolean()),
};

const listFacilityRepresentativesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/representatives",
    async ({ params, query, getScope, getUserId }) => {
      const scope = await getScope();
      const userId = await getUserId();
      return facilityUseCases.listFacilityRepresentatives().execute({
        facilityId: params.id,
        scope,
        userId,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        search: query.search,
      });
    },
    {
      detail: {
        summary: "List active CRM administrative professionals for a facility",
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

const createFacilityRepresentativeRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/representatives",
    async ({ params, body, getScope, getUserId }) => {
      const scope = await getScope();
      const userId = await getUserId();
      return facilityUseCases.createFacilityRepresentative().execute({
        facilityId: params.id,
        scope,
        userId,
        representativeName: body.representativeName,
        roleTitle: body.roleTitle,
        email: body.email,
        phone: body.phone,
        contactType: body.contactType,
        isPartner: body.isPartner,
        isAdministrator: body.isAdministrator,
        isDecisionMaker: body.isDecisionMaker,
        isBuyer: body.isBuyer,
        isBiller: body.isBiller,
        isSecretary: body.isSecretary,
      });
    },
    {
      detail: {
        summary: "Create an administrative professional on a facility",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        representativeName: t.String({ minLength: 1 }),
        roleTitle: t.Optional(t.Union([t.String(), t.Null()])),
        email: t.Optional(t.Union([t.String(), t.Null()])),
        phone: t.Optional(t.Union([t.String(), t.Null()])),
        contactType: t.Optional(
          t.Union([
            t.Literal("PROFESSIONAL"),
            t.Literal("DECISOR"),
            t.Literal("COMPRADOR"),
          ])
        ),
        ...representativeRoleBody,
      }),
    }
  );

const updateFacilityRepresentativeRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .patch(
    "/facilities/:id/representatives/:repId",
    async ({ params, body, getScope, getUserId }) => {
      const scope = await getScope();
      const userId = await getUserId();
      return facilityUseCases.updateFacilityRepresentative().execute({
        facilityId: params.id,
        representativeId: params.repId,
        scope,
        userId,
        representativeName: body.representativeName,
        roleTitle: body.roleTitle,
        email: body.email,
        phone: body.phone,
        contactType: body.contactType,
        isPartner: body.isPartner,
        isAdministrator: body.isAdministrator,
        isDecisionMaker: body.isDecisionMaker,
        isBuyer: body.isBuyer,
        isBiller: body.isBiller,
        isSecretary: body.isSecretary,
        relationshipLevel: body.relationshipLevel,
      });
    },
    {
      detail: {
        summary:
          "Update facility representative fields/role flags; relationshipLevel is user×representative",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        representativeName: t.Optional(t.String({ minLength: 1 })),
        roleTitle: t.Optional(t.Union([t.String(), t.Null()])),
        email: t.Optional(t.Union([t.String(), t.Null()])),
        phone: t.Optional(t.Union([t.String(), t.Null()])),
        contactType: t.Optional(
          t.Union([
            t.Literal("PROFESSIONAL"),
            t.Literal("DECISOR"),
            t.Literal("COMPRADOR"),
          ])
        ),
        ...representativeRoleBody,
        relationshipLevel: t.Optional(
          t.Union([t.Number({ minimum: 1, maximum: 10 }), t.Null()])
        ),
      }),
    }
  );

const MAX_FACILITY_NOTE_LENGTH = 2_000;

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
      detail: {
        summary: "List my private field notes for a facility",
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
  .get(
    "/facilities/photos/*",
    async ({ params, set }) => {
      const key = params["*"];
      if (typeof key !== "string") {
        throw new ValidationError([
          { field: "key", message: "Invalid facility photo key" },
        ]);
      }
      const result = await facilityUseCases.downloadFacilityPhoto().execute({
        storageKey: key,
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

const confirmDoctorRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/professionals/:professionalId/confirm",
    async ({ params, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      return facilityUseCases.confirmProfessionalAtFacility().execute({
        facilityId: params.id,
        professionalId: params.professionalId,
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
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/professionals/:professionalId/associate",
    async ({ params, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      return facilityUseCases.manuallyAssociateProfessional().execute({
        facilityId: params.id,
        professionalId: params.professionalId,
        userId,
        scope,
      });
    },
    {
      detail: {
        summary: "Manually associate a professional with a facility",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const getFacilityProfessionalContextRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/professionals/:professionalId",
    async ({ params, getScope, getUserId }) => {
      const scope = await getScope();
      const userId = await getUserId();
      const context = await facilityUseCases.getFacilityProfessionalContext().execute({
        facilityId: params.id,
        professionalId: params.professionalId,
        scope,
        userId,
      });

      if (!context) {
        throw new ResourceNotFoundError("FacilityProfessional", params.professionalId);
      }

      return context;
    },
    {
      detail: {
        summary: "Get professional registration context for a facility",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const updateFacilityProfessionalRoleRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .patch(
    "/facilities/:id/professionals/:professionalId",
    async ({ params, body, getScope, getUserId }) => {
      const scope = await getScope();
      const userId = await getUserId();
      const association = await facilityUseCases.updateFacilityProfessionalRole().execute({
        facilityId: params.id,
        professionalId: params.professionalId,
        userId,
        scope,
        ...body,
      });

      if (!association) {
        throw new ResourceNotFoundError("FacilityProfessional", params.professionalId);
      }

      return association;
    },
    {
      detail: {
        summary:
          "Update facility-scoped professional role flags; relationshipLevel is user×professional",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        isPartner: t.Optional(t.Boolean()),
        isPrescriber: t.Optional(t.Boolean()),
        isBuyer: t.Optional(t.Boolean()),
        isDecisionMaker: t.Optional(t.Boolean()),
        relationshipLevel: t.Optional(
          t.Union([
            t.Number({ minimum: 1, maximum: 10 }),
            t.Null(),
          ])
        ),
        specialtyLabel: t.Optional(t.Union([t.String(), t.Null()])),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    }
  );

const endDoctorAssociationRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .delete(
    "/facilities/:id/professionals/:professionalId",
    async ({ params, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      const result = await facilityUseCases.endFacilityProfessional().execute({
        facilityId: params.id,
        professionalId: params.professionalId,
        userId,
        scope,
      });

      if (!result) {
        throw new ResourceNotFoundError("FacilityProfessional", params.professionalId);
      }

      return result;
    },
    {
      detail: {
        summary: "End facility-professional association",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const getRegistryFacilityRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/registry/facility",
    async ({ params, getScope }) => {
      const scope = await getScope();
      const result = await registryReadService.getRegistryFacility({
        facilityId: params.id,
        scope,
      });
      if (!result) throw new ResourceNotFoundError("RegistryFacility", params.id);
      return result;
    },
    {
      detail: {
        summary: "Get registry facility projection",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const getRegistryProfessionalsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/registry/professionals",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return registryReadService.getRegistryProfessionals({
        facilityId: params.id,
        scope,
      });
    },
    {
      detail: {
        summary: "List registry professionals for facility",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const getRegistryRepresentativesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/registry/representatives",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return registryReadService.getRegistryRepresentatives({
        facilityId: params.id,
        scope,
      });
    },
    {
      detail: {
        summary: "List registry representatives for facility",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const confirmRegistryProfessionalRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/registry/professionals/:professionalId/confirm",
    async ({ params, body, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      return facilityUseCases.confirmRegistryProfessional().execute({
        facilityId: params.id,
        professionalId: params.professionalId,
        occupationCode: body.occupationCode,
        userId,
        scope,
      });
    },
    {
      detail: {
        summary: "Confirm registry professional at facility",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        occupationCode: t.String(),
      }),
    }
  );

const confirmRegistryRepresentativeRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/registry/representatives/:externalKey/confirm",
    async ({ params, getUserId, getScope }) => {
      const scope = await getScope();
      const userId = await getUserId();
      return facilityUseCases.confirmRegistryRepresentative().execute({
        facilityId: params.id,
        externalKey: params.externalKey,
        userId,
        scope,
      });
    },
    {
      detail: {
        summary: "Confirm registry representative at facility",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const listConsultantAssignmentsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY", { resourceIdParam: "id" }))
  .get(
    "/facilities/:id/consultant-assignments",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.listConsultantAssignments().execute({
        facilityId: params.id,
        scope,
      });
    },
    {
      detail: {
        summary: "List facility consultant assignments",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const assignConsultantRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "FACILITY", { resourceIdParam: "id" }))
  .post(
    "/facilities/:id/consultant-assignments",
    async ({ params, body, getUserId, getScope, getUser }) => {
      const scope = await getScope();
      const assignedByUserId = await getUserId();
      const user = await getUser();
      return facilityUseCases.assignConsultant().execute({
        facilityId: params.id,
        userId: body.userId,
        verticalId: body.verticalId,
        assignedByUserId,
        scope,
        role: user.role.name,
      });
    },
    {
      detail: {
        summary: "Assign consultant to facility",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        userId: t.String(),
        verticalId: t.Optional(t.String()),
      }),
    }
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

const downloadFacilityCadastroFileRoute = new Elysia()
  .use(auth)
  .get(
    "/facilities/cadastro/files/*",
    async ({ params, set }) => {
      const key = params["*"];
      if (typeof key !== "string") {
        throw new ValidationError([
          { field: "key", message: "Invalid cadastro file key" },
        ]);
      }
      const result = await facilityUseCases.downloadFacilityCadastroFile().execute({
        storageKey: key,
      });
      set.headers["content-type"] = result.contentType;
      set.headers["cache-control"] = "private, max-age=3600";
      return result.bytes;
    },
    {
      detail: {
        summary: "Download a Cadastro document by storage key",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
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
    async ({ query }) => {
      return facilityUseCases.listCadastroSubmissions().execute({
        status: query.status as
          | "SUBMITTED"
          | "VALIDATED"
          | "REJECTED"
          | "UNDER_REVIEW"
          | "APPROVED"
          | undefined,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
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
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
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
      detail: {
        summary: "Create conformity record for facility",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        requirementId: t.String(),
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
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 5,
        includeItemPreviews: true,
        verticalId: query.verticalId,
        actor: { userId, roleName: authContext.roleName },
        scope,
      });
    },
    {
      detail: {
        summary: "List recent orders for a facility (REP: own sales only)",
        tags: ["Orders"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        verticalId: t.Optional(t.String()),
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
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 20,
      });
    },
    {
      detail: {
        summary: "List visits for the authenticated user at a facility",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
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

export const facilitiesRoute = new Elysia()
  .use(cadastroSubmissionsRoute)
  .use(mapFacilitiesRoute)
  .use(listFacilitiesRoute)
  // Before `/facilities/:id` so `services` is not captured as an id.
  .use(listFacilityServicesRoute)
  .use(createFacilityRoute)
  .use(getFacilityRoute)
  .use(updateFacilityRoute)
  .use(deleteFacilityRoute)
  .use(listFacilityProfessionalsRoute)
  .use(listFacilityRepresentativesRoute)
  .use(createFacilityRepresentativeRoute)
  .use(updateFacilityRepresentativeRoute)
  .use(listFacilityNotesRoute)
  .use(createFacilityNoteRoute)
  .use(downloadFacilityPhotoRoute)
  .use(downloadFacilityCadastroFileRoute)
  .use(listFacilityPhotosRoute)
  .use(uploadFacilityPhotoRoute)
  .use(confirmDoctorRoute)
  .use(associateDoctorRoute)
  .use(getFacilityProfessionalContextRoute)
  .use(updateFacilityProfessionalRoleRoute)
  .use(endDoctorAssociationRoute)
  .use(getRegistryFacilityRoute)
  .use(getRegistryProfessionalsRoute)
  .use(getRegistryRepresentativesRoute)
  .use(confirmRegistryProfessionalRoute)
  .use(confirmRegistryRepresentativeRoute)
  .use(listConsultantAssignmentsRoute)
  .use(assignConsultantRoute)
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
