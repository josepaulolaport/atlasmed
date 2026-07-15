import { Elysia, t } from "elysia";
import { updateFacilityProfessionalSchema } from "@atlasmed/access";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { facilityUseCases } from "../../composition";
import { registryReadService } from "../../../registry-ingestion/composition";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import { parseListFacilitiesQuery } from "../../application/list-facilities-query";
import type { z } from "zod";

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

const listFacilitiesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/facilities",
    async ({ query, getScope }) => {
      const scope = await getScope();
      const filters = parseListFacilitiesQuery(query);
      return facilityUseCases.listFacilities().execute({
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        search: query.search,
        ...filters,
        scope,
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
        productIds: t.Optional(t.String()),
      }),
    }
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
    async ({ params, getScope }) => {
      const scope = await getScope();
      const clinic = await facilityUseCases.getFacility().execute({
        facilityId: params.id,
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
    async ({ params, query, getScope }) => {
      const scope = await getScope();
      return facilityUseCases.listFacilityProfessionals().execute({
        facilityId: params.id,
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
    async ({ params, getScope }) => {
      const scope = await getScope();
      const context = await facilityUseCases.getFacilityProfessionalContext().execute({
        facilityId: params.id,
        professionalId: params.professionalId,
        scope,
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
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      const parsed = parseSchema(updateFacilityProfessionalSchema, body);
      const association = await facilityUseCases.updateFacilityProfessionalRole().execute({
        facilityId: params.id,
        professionalId: params.professionalId,
        scope,
        ...parsed,
      });

      if (!association) {
        throw new ResourceNotFoundError("FacilityProfessional", params.professionalId);
      }

      return association;
    },
    {
      detail: {
        summary: "Update facility-scoped professional role flags",
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
    async ({ params, body, getUserId, getScope }) => {
      const scope = await getScope();
      const assignedByUserId = await getUserId();
      return facilityUseCases.assignConsultant().execute({
        facilityId: params.id,
        userId: body.userId,
        assignedByUserId,
        scope,
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
  .use(listFacilitiesRoute)
  .use(createFacilityRoute)
  .use(getFacilityRoute)
  .use(updateFacilityRoute)
  .use(deleteFacilityRoute)
  .use(listFacilityProfessionalsRoute)
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
  .use(listFacilityVisitsRoute)
  .use(createFacilityVisitRoute);
