import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { facilityUseCases } from "../../composition";
import { UNASSIGN_REASONS } from "../../application/use-cases/facility-vertical-rep.use-cases";
import { ordersUseCases } from "../../../orders/composition";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import { parseListFacilitiesQuery } from "../../application/list-facilities-query";
import { cadastroDocumentsRoute } from "./cadastro-documents.route";
import { createCnesFacilityImportRoutes } from "./cnes-facility-import.route";
import { mapFacilitiesRoute } from "./map-facilities.route";
import { personProjectionsRoute } from "./person-projections.route";
import { facilityBookmarksRoute } from "./facility-bookmarks.route";
import { createSimpleCatalogWriteRoutes } from "../../../../shared/catalog/simple-catalog.route";
import { clinicalFocusCatalog } from "../../../../shared/catalog/support-catalogs";

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
        unitTypeIds: t.Optional(
          t.String({
            description:
              "Comma-separated CNES unit type ids; a facility matches any of them",
          }),
        ),
        legalDocumentType: t.Optional(
          t.String({ description: "CNPJ or CPF" }),
        ),
        cpfStatus: t.Optional(
          t.String({
            description:
              "Desempenho drill-down over CPF clinics: 'missing' (no CPF on file) or 'invalid' (fails the módulo-11 check)",
          }),
        ),
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
    async ({ query }) => {
      // Active only by default — the filter and the clinic form both want a
      // picker. `Administração › Catálogos` opts into the retired ones so an
      // admin can bring one back (spec 0016 §4).
      if (query.includeInactive === "true") {
        return { data: await clinicalFocusCatalog.listAll() };
      }
      return facilityUseCases.listClinicalFocuses().execute();
    },
    {
      detail: {
        summary: "List clinical focus catalog for filters",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({ includeInactive: t.Optional(t.String()) }),
    },
  );

/**
 * Admin writes for the clinical focus catalogue (spec 0016 §5.2).
 *
 * The read above keeps `read FACILITY` because a rep needs the picker; these
 * are `create` / `update CATALOG`, which only an ADMIN holds.
 */
const clinicalFocusWritesRoute = createSimpleCatalogWriteRoutes({
  path: "facilities/clinical-focuses",
  resource: "ClinicalFocus",
  tag: "Clinics",
  repository: clinicalFocusCatalog,
  // The CNES code, when the focus maps to one. Nullable and unique-where-present,
  // so a locally-created focus simply has none.
  extraField: { name: "cnesCode" },
});

const listFacilityUnitTypesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/facilities/unit-types",
    async () => {
      return facilityUseCases.listFacilityUnitTypes().execute();
    },
    {
      detail: {
        summary: "List CNES unit types in use, for filters",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
    },
  );

/**
 * The whole catalog, not only the types in use — a separate resource from
 * `/facilities/unit-types`, which answers "what can a rep usefully filter by".
 *
 * Both exist because they answer different questions. A filter drawer wants the
 * 12 types some facility actually has; resolving `facilities.unitTypeId` to a
 * name wants all 39, including types no facility currently carries, or the
 * label comes back empty for a row that has a perfectly valid id.
 */
const listUnitTypeCatalogRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/facilities/unit-types/catalog",
    async () => {
      return facilityUseCases.listUnitTypes().execute();
    },
    {
      detail: {
        summary:
          "List the unit-type catalog with subtypes (resolves facilities.unitTypeId for filters)",
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
          "Create clinic from a CNES establishment (always creates the vertical profile; verticalId required unless the caller has a single vertical)",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        name: t.String(),
        stateId: t.Integer({ minimum: 1 }),
        municipalityId: t.Integer({ minimum: 1 }),
        legalDocumentType: t.Union([t.Literal("CNPJ"), t.Literal("CPF")]),
        legalDocument: t.Optional(t.Union([t.String(), t.Null()])),
        // Spec 0009 R5: a clinic without a position cannot be owned by anyone,
        // so it cannot be created. `facilities.location` is NOT NULL.
        lat: t.Number(),
        lng: t.Number(),
        /*
         * Spec 0015: the establishment this clinic is. Optional in the schema so
         * a missing one is a domain error naming the field rather than a 422 the
         * client renders as "invalid request"; the use case requires it and
         * checks it against the registry.
         */
        cnesCode: t.Optional(t.String({ minLength: 1 })),
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
        userId: actor.id,
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

/**
 * Spec 0009 R2's acceptance criterion: an overridden assignment "appears in an
 * out-of-territory report". Read permission on FACILITY, scoped by the caller's
 * verticals — an override is outside the geometry by definition, so territory
 * scope would hide exactly what the report exists to show.
 */
const listOutOfTerritoryAssignmentsRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "FACILITY"))
  .get(
    "/facilities/out-of-territory-assignments",
    async ({ query, getScope, getUser }) => {
      const scope = await getScope();
      const user = await getUser();
      return facilityUseCases.listOutOfTerritoryAssignments().execute({
        scope,
        role: user.role.name,
        userId: query.userId,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      });
    },
    {
      query: t.Object({
        userId: t.Optional(t.Number({ minimum: 1 })),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: {
        summary: "List rep assignments held outside the rep's patch, with who overrode and why",
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
        overrideReason: body.overrideReason,
      });
    },
    {
      params: verticalPathParams,
      body: t.Object({
        userId: t.Number({ minimum: 1 }),
        /**
         * Spec 0009 R2: assigning a rep outside their patch is allowed when it
         * is on the record. Omit it and the patch-coverage check (I2) applies as
         * before.
         */
        overrideReason: t.Optional(t.String({ minLength: 1 })),
      }),
      detail: {
        summary:
          "Assign or replace REP for facility vertical (overrideReason assigns outside the rep's patch, on the record)",
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
    async ({ params, query, getScope, getUser, getUserId }) => {
      const scope = await getScope();
      const user = await getUser();
      const endedByUserId = await getUserId();
      return facilityUseCases.unassignVerticalRep().execute({
        facilityId: params.id,
        verticalId: params.verticalId,
        scope,
        role: user.role.name,
        endReason: query.reason,
        endedByUserId,
      });
    },
    {
      params: verticalPathParams,
      // On the query string rather than in a body: a DELETE with a body is
      // legal but unevenly supported, and this is one enum value.
      query: t.Object({
        reason: t.Optional(
          t.Union(UNASSIGN_REASONS.map((reason) => t.Literal(reason))),
        ),
      }),
      detail: {
        summary:
          "End active REP assignment for facility vertical, recording why and who",
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
    async ({ query }) =>
      facilityUseCases.listConformityRequirements().execute({
        // Active only by default — this feeds a clinic's checklist, and a
        // retired requirement leaking in would ask a rep for a document nobody
        // wants. `Administração › Requisitos` opts into the full catalogue,
        // which also carries the upload limits and the two behavioural flags.
        includeInactive: query.includeInactive === "true",
      }),
    {
      detail: {
        summary: "List conformity requirements",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      query: t.Object({ includeInactive: t.Optional(t.String()) }),
    }
  );

/**
 * The cadastro catalogue — what every clinic must submit (spec 0016 §4.7).
 *
 * The read above keeps `read FACILITY` because a rep needs the checklist; these
 * are `CATALOG`, which only an ADMIN holds.
 *
 * ⚠️ Creating an **active** requirement immediately makes every clinic in scope
 * non-conformant. It is the widest-reaching write in the panel, which is why
 * `verticalId` and `appliesToLegalDocumentType` exist and why the client warns
 * before saving one.
 */
const requirementBody = {
  name: t.String({ minLength: 1 }),
  description: t.Optional(t.Nullable(t.String())),
  /** Null means every Linha. */
  verticalId: t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
  /** Null means every clinic, CNPJ or CPF. */
  appliesToLegalDocumentType: t.Optional(
    t.Nullable(t.Union([t.Literal("CNPJ"), t.Literal("CPF")]))
  ),
  isActive: t.Optional(t.Boolean()),
  allowedMimeTypes: t.Optional(t.Array(t.String({ minLength: 1 }), { minItems: 1 })),
  maxFiles: t.Optional(t.Number({ minimum: 1 })),
  maxFileSizeBytes: t.Optional(t.Number({ minimum: 1 })),
  maxCombinedSizeBytes: t.Optional(t.Number({ minimum: 1 })),
  requiresFrontAndBack: t.Optional(t.Boolean()),
  requiresValidityDate: t.Optional(t.Boolean()),
} as const;

const createConformityRequirementRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "CATALOG"))
  .post(
    "/conformity/requirements",
    async ({ body }) => facilityUseCases.createConformityRequirement().execute(body),
    {
      detail: {
        summary: "Create a conformity requirement",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      body: t.Object({
        ...requirementBody,
        // Derived from the name when omitted. Chosen once: it is the key every
        // cadastro DTO travels under, so `PATCH` does not accept it.
        slug: t.Optional(t.String({ minLength: 1 })),
      }),
    }
  );

const updateConformityRequirementRoute = new Elysia()
  .use(auth)
  .use(requirePermission("update", "CATALOG"))
  .patch(
    "/conformity/requirements/:id",
    async ({ params, body }) =>
      facilityUseCases.updateConformityRequirement().execute({ id: params.id, ...body }),
    {
      detail: {
        summary: "Update a conformity requirement",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      // No `slug`: it is the stable key, and `name` is the label to change.
      body: t.Object({ ...requirementBody, name: t.Optional(t.String({ minLength: 1 })) }),
    }
  );

const deleteConformityRequirementRoute = new Elysia()
  .use(auth)
  .use(requirePermission("delete", "CATALOG"))
  .delete(
    "/conformity/requirements/:id",
    async ({ params }) =>
      facilityUseCases.deleteConformityRequirement().execute({ id: params.id }),
    {
      detail: {
        summary: "Delete a conformity requirement no clinic has answered",
        tags: ["Facilities"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
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
        // Ceilinged, like /orders. The list joins order_items and groups, so an
        // unbounded limit is a whole-table aggregate a client can ask for.
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        verticalId: t.Optional(t.Number({ minimum: 1 })),
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
  // Same reason, and `PATCH /facilities/clinical-focuses/:id` must not be
  // routed as `PATCH /facilities/:id` either.
  .use(clinicalFocusWritesRoute)
  // Same reason: `cnes-candidates` must not be captured as a facility id.
  .use(createCnesFacilityImportRoutes())
  // Same reason — `unit-types` must not be routed as `/facilities/:id`.
  .use(listUnitTypeCatalogRoute)
  .use(listFacilityUnitTypesRoute)
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
  .use(listOutOfTerritoryAssignmentsRoute)
  .use(assignVerticalRepRoute)
  .use(unassignVerticalRepRoute)
  .use(deactivateFacilityVerticalRoute)
  .use(listConformityRequirementsRoute)
  .use(createConformityRequirementRoute)
  .use(updateConformityRequirementRoute)
  .use(deleteConformityRequirementRoute)
  .use(listFacilityConformityRecordsRoute)
  .use(createFacilityConformityRecordRoute)
  .use(getFacilityCadastroRoute)
  .use(updateFacilityBillingEmailRoute)
  .use(approveFacilityCadastroRecordRoute)
  .use(rejectFacilityCadastroRecordRoute)
  .use(listCadastroSubmissionsRoute)
  .use(listFacilityOrdersRoute)
  .use(listFacilityVisitsRoute)
  .use(createFacilityVisitRoute)
  .use(facilityBookmarksRoute);