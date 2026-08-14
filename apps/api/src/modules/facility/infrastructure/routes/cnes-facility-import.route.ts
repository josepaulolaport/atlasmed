import { Elysia, t } from "elysia";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { ForbiddenError } from "../../../../shared/errors";
import { searchFacilityCandidates } from "../../../../infrastructure/search/facility-candidate-index.service";
import {
  ImportCnesFacilityUseCase,
  PreviewCnesFacilityImportUseCase,
} from "../../application/use-cases/cnes-facility-import.use-cases";
import { DrizzleCnesFacilityImportRepository } from "../repositories/drizzle/drizzle-cnes-facility-import.repository";
import { upsertFacilityCandidateDocument } from "../../../../infrastructure/search/facility-candidate-index.service";
import { upsertFacilitySearchDocument } from "../../../../infrastructure/search/facility-search-index.service";

/**
 * Importing a clinic from CNES (spec 0015 §6).
 *
 * Its own routes rather than an extension of `POST /facilities`, because the
 * surface is different in kind: a national reference list a user searches, not
 * the clinics they operate. `POST /facilities` remains, still requiring a
 * registry-resolvable `cnesCode`, for callers that already know exactly what
 * they are creating.
 */

/**
 * **Managers and admins only, for now** (§6.0). Not a permanent rule: it is the
 * interim answer to "may a rep import outside their patch" (§9.5), pending a
 * product decision. Bounding the list by territory was considered and rejected —
 * too much of the geometry is wrong today for that bound to be a correctness
 * gate rather than an obstacle.
 *
 * Enforced here rather than by a permission alone because it is a property of
 * *this surface*, not of the FACILITY resource: a rep may still create a clinic
 * through `POST /facilities` when they already hold its CNES code.
 */
const IMPORTER_ROLES = new Set(["MANAGER", "ADMIN"]);

function assertMayImport(role: string): void {
  if (!IMPORTER_ROLES.has(role)) throw new ForbiddenError();
}

const repository = new DrizzleCnesFacilityImportRepository();

function defaultPreviewUseCase() {
  return new PreviewCnesFacilityImportUseCase({ repository });
}

function defaultImportUseCase() {
  return new ImportCnesFacilityUseCase({
    repository,
    onFacilityCreated: upsertFacilitySearchDocument,
    onFacilityLocationChanged: upsertFacilitySearchDocument,
    /*
     * Synchronous, and load-bearing: the row must leave the offer list the
     * moment it is imported, or the user taps it again and meets a bare unique
     * violation on `cnes_code`.
     */
    onCandidateChanged: upsertFacilityCandidateDocument,
  });
}

const listCandidatesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "FACILITY"))
  .get(
    "/facilities/cnes-candidates",
    async ({ query, getScope, getUser }) => {
      const actor = await getUser();
      assertMayImport(actor.role.name);
      const scope = await getScope();

      const q = query as Record<string, string | undefined>;
      const lat = q.lat === undefined ? null : Number(q.lat);
      const lng = q.lng === undefined ? null : Number(q.lng);
      const limit = Math.min(Math.max(Number(q.limit ?? 20) || 20, 1), 50);

      const { hits, estimatedTotal } = await searchFacilityCandidates({
        query: q.q ?? "",
        verticalIds: scope.assignedVerticalIds ?? [],
        municipalityId: q.municipalityId ? Number(q.municipalityId) : null,
        stateId: q.stateId ? Number(q.stateId) : null,
        unitTypeId: q.unitTypeId ? Number(q.unitTypeId) : null,
        legalDocumentType:
          q.legalDocumentType === "CNPJ" || q.legalDocumentType === "CPF"
            ? q.legalDocumentType
            : null,
        near:
          lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)
            ? { lat, lng }
            : null,
        limit,
        offset: Math.max(Number(q.offset ?? 0) || 0, 0),
      });

      return { data: hits, meta: { estimatedTotal } };
    },
    {
      detail: {
        summary:
          "Search CNES for clinics to import — those nobody holds, plus ours that this user's verticals do not cover",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

const previewCandidateRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "FACILITY"))
  .get(
    "/facilities/cnes-candidates/:cnesCode",
    async ({ params, getUser }) => {
      const actor = await getUser();
      assertMayImport(actor.role.name);
      return defaultPreviewUseCase().execute({ cnesCode: params.cnesCode });
    },
    {
      detail: {
        summary: "What CNES holds for one establishment, for the import wizard to confirm",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ cnesCode: t.String({ minLength: 1 }) }),
    }
  );

const importCandidateRoute = new Elysia()
  .use(auth)
  .use(requirePermission("create", "FACILITY"))
  .post(
    "/facilities/cnes-candidates/:cnesCode/import",
    async ({ params, body, getScope, getUser }) => {
      const actor = await getUser();
      assertMayImport(actor.role.name);
      const scope = await getScope();

      return defaultImportUseCase().execute({
        ...body,
        cnesCode: params.cnesCode,
        role: actor.role.name,
        assignedVerticalIds: scope.assignedVerticalIds ?? [],
      });
    },
    {
      detail: {
        summary:
          "Import a CNES establishment: creates the clinic and its profiles, or only a profile when we already hold it",
        tags: ["Clinics"],
        security: [{ bearerAuth: [] }],
      },
      params: t.Object({ cnesCode: t.String({ minLength: 1 }) }),
      body: t.Object({
        name: t.Optional(t.String()),
        /*
         * Only ever read for a pessoa física. A CNPJ CNES supplied is the legal
         * identity of the establishment and is never client-writable (§4.6) —
         * accepting one here is how two clinics collide.
         */
        legalDocument: t.Optional(t.Union([t.String(), t.Null()])),
        streetAddress: t.Optional(t.Union([t.String(), t.Null()])),
        streetNumber: t.Optional(t.Union([t.String(), t.Null()])),
        addressComplement: t.Optional(t.Union([t.String(), t.Null()])),
        neighborhood: t.Optional(t.Union([t.String(), t.Null()])),
        postalCode: t.Optional(t.Union([t.String(), t.Null()])),
        phoneNumber: t.Optional(t.Union([t.String(), t.Null()])),
        email: t.Optional(t.Union([t.String(), t.Null()])),
        municipalityId: t.Optional(t.Union([t.Integer({ minimum: 1 }), t.Null()])),
        /* Required only when CNES has no point — 272 of 494 273 active units. */
        lat: t.Optional(t.Union([t.Number(), t.Null()])),
        lng: t.Optional(t.Union([t.Number(), t.Null()])),
        unitTypeId: t.Optional(t.Union([t.Integer({ minimum: 1 }), t.Null()])),
        unitSubtypeId: t.Optional(t.Union([t.Integer({ minimum: 1 }), t.Null()])),
        /*
         * Optional for a user who holds exactly one vertical, required for
         * anyone else — including an admin, who holds none of their own (§6.3).
         */
        verticalIds: t.Optional(t.Array(t.Integer({ minimum: 1 }))),
      }),
    }
  );

export function createCnesFacilityImportRoutes() {
  return new Elysia()
    .use(listCandidatesRoute)
    .use(previewCandidateRoute)
    .use(importCandidateRoute);
}
