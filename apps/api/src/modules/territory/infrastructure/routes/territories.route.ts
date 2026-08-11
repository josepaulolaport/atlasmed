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

function parseId(value: string, label: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ResourceNotFoundError(label, value);
  }
  return id;
}

function parseOptionalId(value: string | undefined): number | undefined {
  if (!value) return undefined;
  return parseId(value, "ID");
}

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
          managerTerritoryId: parseOptionalId(query.managerTerritoryId),
          verticalId: parseOptionalId(query.verticalId),
        }
      );
    },
    {
      query: t.Object({
        format: t.Optional(t.Union([t.Literal("tree"), t.Literal("flat")])),
        type: t.Optional(t.String({ description: "Filter by territory type slug (e.g. manager_zone, patch)" })),
        managerTerritoryId: t.Optional(t.String({ description: "Filter patches by manager zone territory ID" })),
        verticalId: t.Optional(t.String({ description: "Filter territories by business vertical" })),
      }),
    }
  )
  .use(requirePermission("read", "TERRITORY"))
  .get("/territory-types", async () => {
    return territoryUseCases.listTerritoryTypes().listTypes();
  })
  .use(requirePermission("read", "TERRITORY"))
  .get("/territory-types/:id", async ({ params }) => {
    return territoryUseCases.getTerritoryType().getType(parseId(params.id, "TerritoryType"));
  })
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
      return territoryUseCases.updateTerritoryType().updateType(parseId(params.id, "TerritoryType"), body);
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.Union([t.String(), t.Null()])),
        canHaveBoundary: t.Optional(t.Boolean()),
        blockSiblingOverlap: t.Optional(t.Boolean()),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  )
  .use(requirePermission("read", "TERRITORY"))
  .get("/territories/:id", async ({ params, getScope }) => {
    const territoryId = parseId(params.id, "Territory");
    const scope = await getScope();
    const territory = await territoryUseCases
      .getTerritory()
      .getTerritory(territoryId, scope);
    if (!territory) {
      throw new ResourceNotFoundError("Territory", territoryId);
    }
    assertManagerReadableTerritory(scope, territoryId);
    return territory;
  })
  .use(requirePermission("create", "TERRITORY"))
  .post(
    "/territories",
    async ({ body, getUser, getScope }) => {
      const user = await getUser();
      const scope = await getScope();
      const role = user.role.name as Role;
      if (isAdminRole(role)) {
        return territoryUseCases.createTerritory().createTerritory({
          ...body,
          verticalId: parseId(body.verticalId, "Vertical"),
          territoryTypeId: body.territoryTypeId
            ? parseId(body.territoryTypeId, "TerritoryType")
            : undefined,
          scope,
        });
      }
      // Spec 0006: managers may create rep patches only (not manager zones).
      if (isManagerRole(role) && body.typeSlug === "patch") {
        return territoryUseCases.createTerritory().createTerritory({
          ...body,
          verticalId: parseId(body.verticalId, "Vertical"),
          territoryTypeId: body.territoryTypeId
            ? parseId(body.territoryTypeId, "TerritoryType")
            : undefined,
          scope,
        });
      }
      throw new InsufficientPermissionsError(["territory:create"], [`role:${user.role.name}`]);
    },
    {
      body: t.Object({
        name: t.String(),
        slug: t.String(),
        verticalId: t.String(),
        territoryTypeId: t.Optional(t.String()),
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
    async ({ params, body, getUser, getScope }) => {
      const user = await getUser();
      if (isAdminRole(user.role.name as Role)) {
        return territoryUseCases.updateTerritory().updateTerritory(parseId(params.id, "Territory"), body);
      }

      throw new InsufficientPermissionsError(["territory:update"], [`role:${user.role.name}`]);
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
        // Spec 0009 R9: `reason` is gone. It was accepted and discarded — never
        // stored, never logged, never read. A field that looks like an audit
        // trail and is not is worse than no field.
      }),
    }
  )
  .use(requirePermission("delete", "TERRITORY"))
  .delete("/territories/:id", async ({ params, getUser }) => {
    const user = await getUser();
    if (!isAdminRole(user.role.name as Role)) {
      throw new InsufficientPermissionsError(["territory:delete"], [`role:${user.role.name}`]);
    }
    return territoryUseCases.deleteTerritory().deleteTerritory(parseId(params.id, "Territory"));
  })
  .use(requirePermission("read", "TERRITORY"))
  .get("/territories/:id/boundary", async ({ params, getScope }) => {
    const territoryId = parseId(params.id, "Territory");
    const scope = await getScope();
    const boundary = await territoryUseCases.getBoundary().getBoundary({
      territoryId,
      scope,
    });
    if (!boundary) {
      return new Response(null, { status: 204 });
    }
    return boundary;
  })
  .use(requirePermission("update", "TERRITORY"))
  .post(
    "/territories/:id/boundary/impact",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return territoryUseCases.previewBoundaryImpact().previewBoundaryImpact({
        territoryId: parseId(params.id, "Territory"),
        scope,
        geoJson: {
          type: body.type,
          coordinates: body.coordinates,
        },
      });
    },
    {
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
    async ({ params, body, getScope, getUserId }) => {
      const scope = await getScope();
      // Spec 0009 R2/R5: recorded against any assignment this edit ends.
      const actorUserId = await getUserId();
      const { acceptedFacilityIds, ...geoJson } = body;
      return territoryUseCases.saveBoundary().saveBoundary({
        territoryId: parseId(params.id, "Territory"),
        scope,
        actorUserId,
        geoJson,
        acceptedFacilityIds: acceptedFacilityIds?.map((id) => parseId(id, "Facility")),
      });
    },
    {
      body: t.Object({
        type: t.Union([t.Literal("Polygon"), t.Literal("MultiPolygon")]),
        coordinates: t.Any(),
        acceptedFacilityIds: t.Optional(t.Array(t.String())),
      }),
      detail: {
        summary: "Save territory boundary (requires acceptedFacilityIds when impact non-empty)",
        tags: ["Territory"],
        security: [{ bearerAuth: [] }],
      },
    }
  )
  .delete("/territories/:id/boundary", async ({ params, getScope }) => {
    const scope = await getScope();
    return territoryUseCases.deleteBoundary().deleteBoundary({
      territoryId: parseId(params.id, "Territory"),
      scope,
    });
  })
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
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        managerZoneId: parseOptionalId(query.managerZoneId),
      });
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        managerZoneId: t.Optional(t.String()),
      }),
      detail: {
        summary: "List clinics in manager zones without a primary consultant",
        tags: ["Territory"],
        security: [{ bearerAuth: [] }],
      },
    }
  );

// Spec 0009 R7: `PATCH /facilities/:id/territory` and
// `POST /facilities/:id/territory/unlock-geo` are gone. Zone membership is
// derived from geometry with no exceptions, so there is no manual setter to
// contradict it — and no `territory_assignment_source` to record which one won.
