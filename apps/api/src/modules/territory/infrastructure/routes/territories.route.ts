import { Elysia, t } from "elysia";
import { Role } from "@atlasmed/access";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { territoryUseCases } from "../../composition";
import {
  InsufficientPermissionsError,
  ResourceNotFoundError,
} from "../../../../shared/errors";
import { isAdminRole, isManagerRole, assertManagerReadableTerritory } from "../../application/use-cases/territory-crud.use-cases";

export const territoriesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "TERRITORY"))
  .get(
    "/territories",
    async ({ query, getScope }) => {
      const scope = await getScope();
      return territoryUseCases.listTerritories().listTerritories(
        query.format === "tree" ? "tree" : "flat",
        scope,
        {
          typeSlug: query.type,
          managerTerritoryId: query.managerTerritoryId,
          verticalId: query.verticalId,
        }
      );
    },
    {
      query: t.Object({
        format: t.Optional(t.Union([t.Literal("tree"), t.Literal("flat")])),
        type: t.Optional(t.String({ description: "Filter by territory type slug (e.g. manager_zone, patch)" })),
        managerTerritoryId: t.Optional(t.Number({ minimum: 1, description: "Filter patches by manager zone territory ID" })),
        verticalId: t.Optional(t.Number({ minimum: 1, description: "Filter territories by business vertical" })),
      }),
    }
  )
  .use(requirePermission("read", "TERRITORY"))
  .get("/territory-types", async () => {
    return territoryUseCases.listTerritoryTypes().listTypes();
  })
  .use(requirePermission("read", "TERRITORY"))
  .get(
    "/territory-types/:id",
    async ({ params }) => {
      return territoryUseCases.getTerritoryType().getType(params.id);
    },
    {
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
    }
  )
  .use(requirePermission("create", "TERRITORY"))
  .post(
    "/territory-types",
    async ({ body, getUser }) => {
      const user = await getUser();
      if (!isAdminRole(user.role.name as Role)) {
        throw new InsufficientPermissionsError(["territory:create"], [`role:${user.role.name}`]);
      }
      return territoryUseCases.createTerritoryType().createType(body);
    },
    {
      body: t.Object({
        slug: t.String(),
        name: t.String(),
        description: t.Optional(t.String()),
        canHaveBoundary: t.Optional(t.Boolean()),
        blockSiblingOverlap: t.Optional(t.Boolean()),
        sortOrder: t.Optional(t.Number()),
      }),
    }
  )
  .use(requirePermission("update", "TERRITORY"))
  .patch(
    "/territory-types/:id",
    async ({ params, body, getUser }) => {
      const user = await getUser();
      if (!isAdminRole(user.role.name as Role)) {
        throw new InsufficientPermissionsError(["territory:update"], [`role:${user.role.name}`]);
      }
      return territoryUseCases.updateTerritoryType().updateType(params.id, body);
    },
    {
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.Union([t.String(), t.Null()])),
        canHaveBoundary: t.Optional(t.Boolean()),
        blockSiblingOverlap: t.Optional(t.Boolean()),
        sortOrder: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  )
  .use(requirePermission("read", "TERRITORY"))
  .get(
    "/territories/:id",
    async ({ params, getScope }) => {
      const scope = await getScope();
      const territory = await territoryUseCases.getTerritory().getTerritory(params.id);
      if (!territory) {
        throw new ResourceNotFoundError("Territory", params.id);
      }
      assertManagerReadableTerritory(scope, params.id);
      return territory;
    },
    {
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
    }
  )
  .use(requirePermission("create", "TERRITORY"))
  .post(
    "/territories",
    async ({ body, getUser }) => {
      const user = await getUser();
      const role = user.role.name as Role;
      if (isAdminRole(role)) {
        return territoryUseCases.createTerritory().createTerritory({
          ...body,
          verticalId: body.verticalId,
          territoryTypeId: body.territoryTypeId,
        });
      }
      // Spec 0006: managers may create rep patches only (not manager zones).
      if (isManagerRole(role) && body.typeSlug === "patch") {
        return territoryUseCases.createTerritory().createTerritory({
          ...body,
          verticalId: body.verticalId,
          territoryTypeId: body.territoryTypeId,
        });
      }
      throw new InsufficientPermissionsError(["territory:create"], [`role:${user.role.name}`]);
    },
    {
      body: t.Object({
        name: t.String(),
        slug: t.String(),
        verticalId: t.Number({ minimum: 1 }),
        territoryTypeId: t.Optional(t.Number({ minimum: 1 })),
        typeSlug: t.Optional(t.String()),
        boundary: t.Optional(
          t.Object({
            type: t.Union([t.Literal("Polygon"), t.Literal("MultiPolygon")]),
            coordinates: t.Unknown(),
          })
        ),
      }),
    }
  )
  .use(requirePermission("update", "TERRITORY"))
  .patch(
    "/territories/:id",
    async ({ params, body, getUser }) => {
      const user = await getUser();
      if (isAdminRole(user.role.name as Role)) {
        return territoryUseCases.updateTerritory().updateTerritory(params.id, body);
      }

      // Manager deactivate-via-approval removed — admin-only updates for now.
      throw new InsufficientPermissionsError(["territory:update"], [`role:${user.role.name}`]);
    },
    {
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        name: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
        reason: t.Optional(t.String()),
      }),
    }
  )
  .use(requirePermission("delete", "TERRITORY"))
  .delete(
    "/territories/:id",
    async ({ params, getUser }) => {
      const user = await getUser();
      if (!isAdminRole(user.role.name as Role)) {
        throw new InsufficientPermissionsError(["territory:delete"], [`role:${user.role.name}`]);
      }
      return territoryUseCases.deleteTerritory().deleteTerritory(params.id);
    },
    {
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
    }
  )
  .use(requirePermission("read", "TERRITORY"))
  .get(
    "/territories/:id/boundary",
    async ({ params, getScope }) => {
      const scope = await getScope();
      const boundary = await territoryUseCases.getBoundary().getBoundary({
        territoryId: params.id,
        scope,
      });
      if (!boundary) {
        return new Response(null, { status: 204 });
      }
      return boundary;
    },
    {
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
    }
  )
  .use(requirePermission("update", "TERRITORY"))
  .post(
    "/territories/:id/boundary/impact",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return territoryUseCases.previewBoundaryImpact().previewBoundaryImpact({
        territoryId: params.id,
        scope,
        geoJson: {
          type: body.type,
          coordinates: body.coordinates,
        },
      });
    },
    {
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        type: t.Union([t.Literal("Polygon"), t.Literal("MultiPolygon")]),
        coordinates: t.Any(),
      }),
      detail: {
        summary: "Preview clinic deassignment impact for a proposed boundary",
        tags: ["Territory"],
        security: [{ bearerAuth: [] }],
      },
    }
  )
  .put(
    "/territories/:id/boundary",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      const { acceptedFacilityIds, ...geoJson } = body;
      return territoryUseCases.saveBoundary().saveBoundary({
        territoryId: params.id,
        scope,
        geoJson,
        acceptedFacilityIds: acceptedFacilityIds,
      });
    },
    {
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        type: t.Union([t.Literal("Polygon"), t.Literal("MultiPolygon")]),
        coordinates: t.Any(),
        acceptedFacilityIds: t.Optional(t.Array(t.Number({ minimum: 1 }))),
      }),
      detail: {
        summary: "Save territory boundary (requires acceptedFacilityIds when impact non-empty)",
        tags: ["Territory"],
        security: [{ bearerAuth: [] }],
      },
    }
  )
  .delete(
    "/territories/:id/boundary",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return territoryUseCases.deleteBoundary().deleteBoundary({
        territoryId: params.id,
        scope,
      });
    },
    {
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
    }
  )
  .use(requirePermission("manage", "TERRITORY"))
  .post("/territories/recompute-membership", async ({ getUser }) => {
    const user = await getUser();
    if (!isAdminRole(user.role.name as Role)) {
      throw new InsufficientPermissionsError(["territory:manage"], [`role:${user.role.name}`]);
    }
    return territoryUseCases.recomputeMembership().recomputeMembership();
  })
  .use(requirePermission("read", "TERRITORY"))
  .get(
    "/territories/unassigned-facilities",
    async ({ query, getScope }) => {
      const scope = await getScope();
      return territoryUseCases.listUnassignedFacilities().listUnassignedFacilities({
        scope,
        page: query.page,
        limit: query.limit,
        managerZoneId: query.managerZoneId,
      });
    },
    {
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1 })),
        managerZoneId: t.Optional(t.Number({ minimum: 1 })),
      }),
      detail: {
        summary: "List clinics in manager zones without a primary consultant",
        tags: ["Territory"],
        security: [{ bearerAuth: [] }],
      },
    }
  )
  .use(requirePermission("manage", "FACILITY"))
  .patch(
    "/facilities/:id/territory",
    async ({ params, body, getUser }) => {
      const user = await getUser();
      if (!isAdminRole(user.role.name as Role)) {
        throw new InsufficientPermissionsError(["clinic:update"], [`role:${user.role.name}`]);
      }
      return territoryUseCases.adminOverrideClinicTerritory().adminOverrideClinicTerritory({
        facilityId: params.id,
        territoryId: body.territoryId,
        reason: body.reason,
      });
    },
    {
      params: t.Object({ id: t.Number({ minimum: 1 }) }),
      body: t.Object({
        territoryId: t.Number({ minimum: 1 }),
        reason: t.Optional(t.String()),
      }),
    }
  )
;
