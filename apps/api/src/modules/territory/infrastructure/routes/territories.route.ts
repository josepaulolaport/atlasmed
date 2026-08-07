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
    return territoryUseCases.getTerritoryType().getType(params.id);
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
        assignsClinics: t.Optional(t.Boolean()),
        assignableToUsers: t.Optional(t.Boolean()),
        assignableToManagers: t.Optional(t.Boolean()),
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
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.Union([t.String(), t.Null()])),
        canHaveBoundary: t.Optional(t.Boolean()),
        assignsClinics: t.Optional(t.Boolean()),
        assignableToUsers: t.Optional(t.Boolean()),
        assignableToManagers: t.Optional(t.Boolean()),
        blockSiblingOverlap: t.Optional(t.Boolean()),
        sortOrder: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  )
  .use(requirePermission("read", "TERRITORY"))
  .get("/territories/:id", async ({ params, getScope }) => {
    const scope = await getScope();
    const territory = await territoryUseCases.getTerritory().getTerritory(params.id);
    if (!territory) {
      throw new ResourceNotFoundError("Territory", params.id);
    }
    assertManagerReadableTerritory(scope, params.id);
    return territory;
  })
  .use(requirePermission("create", "TERRITORY"))
  .post(
    "/territories",
    async ({ body, getUser }) => {
      const user = await getUser();
      const role = user.role.name as Role;
      if (isAdminRole(role)) {
        return territoryUseCases.createTerritory().createTerritory(body);
      }
      // Spec 0006: managers may create rep patches only (not manager zones).
      if (isManagerRole(role) && body.typeSlug === "patch") {
        return territoryUseCases.createTerritory().createTerritory(body);
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
        return territoryUseCases.updateTerritory().updateTerritory(params.id, body);
      }

      if (isManagerRole(user.role.name as Role) && body.isActive === false) {
        const scope = await getScope();
        return territoryUseCases.submitApproval().submitRequest({
          requesterId: user.id,
          requesterRole: user.role.name as Role,
          scope,
          type: "deactivate_territory",
          targetTerritoryId: params.id,
          entityPayload: body,
          reason: body.reason,
        });
      }

      throw new InsufficientPermissionsError(["territory:update"], [`role:${user.role.name}`]);
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
        reason: t.Optional(t.String()),
      }),
    }
  )
  .use(requirePermission("delete", "TERRITORY"))
  .delete("/territories/:id", async ({ params, getUser }) => {
    const user = await getUser();
    if (!isAdminRole(user.role.name as Role)) {
      throw new InsufficientPermissionsError(["territory:delete"], [`role:${user.role.name}`]);
    }
    return territoryUseCases.deleteTerritory().deleteTerritory(params.id);
  })
  .use(requirePermission("read", "TERRITORY"))
  .get("/territories/:id/boundary", async ({ params, getScope }) => {
    const scope = await getScope();
    const boundary = await territoryUseCases.getBoundary().getBoundary({
      territoryId: params.id,
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
        territoryId: params.id,
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
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      const { acceptedFacilityIds, ...geoJson } = body;
      return territoryUseCases.saveBoundary().saveBoundary({
        territoryId: params.id,
        scope,
        geoJson,
        acceptedFacilityIds,
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
      territoryId: params.id,
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
        managerZoneId: query.managerZoneId,
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
      body: t.Object({
        territoryId: t.String(),
        reason: t.Optional(t.String()),
      }),
    }
  )
  .post("/facilities/:id/territory/unlock-geo", async ({ params, getUser }) => {
    const user = await getUser();
    if (!isAdminRole(user.role.name as Role)) {
      throw new InsufficientPermissionsError(["clinic:update"], [`role:${user.role.name}`]);
    }
    return territoryUseCases.unlockClinicGeo().unlockClinicGeo({ facilityId: params.id });
  })
  .use(requirePermission("update", "TERRITORY"))
  .post(
    "/territories/approval-requests",
    async ({ body, getUser, getScope }) => {
      const user = await getUser();
      const scope = await getScope();
      return territoryUseCases.submitApproval().submitRequest({
        requesterId: user.id,
        requesterRole: user.role.name as Role,
        scope,
        type: body.type,
        entityPayload: body.entityPayload ?? {},
        targetTerritoryId: body.targetTerritoryId,
        facilityId: body.facilityId,
        toTerritoryId: body.toTerritoryId,
        reason: body.reason,
      });
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal("deactivate_territory"),
          t.Literal("clinic_territory_change"),
        ]),
        entityPayload: t.Optional(t.Record(t.String(), t.Any())),
        targetTerritoryId: t.Optional(t.String()),
        facilityId: t.Optional(t.String()),
        toTerritoryId: t.Optional(t.String()),
        reason: t.Optional(t.String()),
      }),
    }
  )
  .use(requirePermission("manage", "TERRITORY"))
  .get(
    "/territories/approval-requests",
    async ({ query, getUser }) => {
      const user = await getUser();
      if (!isAdminRole(user.role.name as Role)) {
        throw new InsufficientPermissionsError(["territory:manage"], [`role:${user.role.name}`]);
      }
      return territoryUseCases.listApprovalRequests().listRequests({
        status: query.status as "pending" | undefined,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      });
    },
    {
      query: t.Object({
        status: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/territories/approval-requests/:id/approve",
    async ({ params, body, getUser }) => {
      const user = await getUser();
      if (!isAdminRole(user.role.name as Role)) {
        throw new InsufficientPermissionsError(["territory:manage"], [`role:${user.role.name}`]);
      }
      return territoryUseCases.approveRequest().approveRequest({
        requestId: params.id,
        reviewerId: user.id,
        note: body.note,
      });
    },
    {
      body: t.Object({ note: t.Optional(t.String()) }),
    }
  )
  .post(
    "/territories/approval-requests/:id/reject",
    async ({ params, body, getUser }) => {
      const user = await getUser();
      if (!isAdminRole(user.role.name as Role)) {
        throw new InsufficientPermissionsError(["territory:manage"], [`role:${user.role.name}`]);
      }
      return territoryUseCases.rejectRequest().rejectRequest({
        requestId: params.id,
        reviewerId: user.id,
        note: body.note,
      });
    },
    {
      body: t.Object({ note: t.Optional(t.String()) }),
    }
  );
