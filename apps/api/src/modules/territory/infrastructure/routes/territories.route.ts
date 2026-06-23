import { Elysia, t } from "elysia";
import { Role } from "@atlasmed/access";
import { auth } from "../../access/composition";
import { requirePermission } from "../../access/infrastructure/middleware/permission.middleware";
import { territoryUseCases } from "../composition";
import {
  InsufficientPermissionsError,
  ResourceNotFoundError,
} from "../../../shared/errors";
import { isAdminRole, isManagerRole } from "../application/use-cases/territory-crud.use-cases";

export const territoriesRoute = new Elysia()
  .use(auth)
  .use(requirePermission("read", "TERRITORY"))
  .get(
    "/territories",
    async ({ query }) => {
      return territoryUseCases.listTerritories().listTerritories(
        query.format === "tree" ? "tree" : "flat"
      );
    },
    {
      query: t.Object({
        format: t.Optional(t.Union([t.Literal("tree"), t.Literal("flat")])),
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
    if (!scope.isGlobal && !scope.effectiveTerritoryIds.includes(params.id)) {
      throw new InsufficientPermissionsError(["territory:read"], ["out_of_scope"]);
    }
    return territory;
  })
  .use(requirePermission("read", "TERRITORY"))
  .get("/territories/:id/descendants", async ({ params }) => {
    return territoryUseCases.getDescendants().getDescendants(params.id);
  })
  .use(requirePermission("create", "TERRITORY"))
  .post(
    "/territories",
    async ({ body, getUser }) => {
      const user = await getUser();
      if (isAdminRole(user.role.name as Role)) {
        return territoryUseCases.createTerritory().createTerritory(body);
      }

      if (isManagerRole(user.role.name as Role)) {
        return territoryUseCases.submitApproval().submitRequest({
          requesterId: user.id,
          requesterRole: user.role.name as Role,
          type: "create_territory",
          entityPayload: body,
          reason: body.reason,
        });
      }

      throw new InsufficientPermissionsError(["territory:create"], [`role:${user.role.name}`]);
    },
    {
      body: t.Object({
        name: t.String(),
        nodeType: t.Union([
          t.Literal("root"),
          t.Literal("region"),
          t.Literal("state"),
          t.Literal("intermediate"),
          t.Literal("patch"),
        ]),
        parentId: t.Optional(t.String()),
        regionSlug: t.Optional(t.String()),
        stateCode: t.Optional(t.String()),
        reason: t.Optional(t.String()),
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

      if (isManagerRole(user.role.name as Role)) {
        const type = body.isActive === false ? "deactivate_territory" : "reparent_territory";
        return territoryUseCases.submitApproval().submitRequest({
          requesterId: user.id,
          requesterRole: user.role.name as Role,
          type,
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
        parentId: t.Optional(t.Union([t.String(), t.Null()])),
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
    return territoryUseCases.deactivateTerritory().deactivateTerritory(params.id);
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
  .put(
    "/territories/:id/boundary",
    async ({ params, body, getScope }) => {
      const scope = await getScope();
      return territoryUseCases.saveBoundary().saveBoundary({
        territoryId: params.id,
        scope,
        geoJson: body,
      });
    },
    {
      body: t.Object({
        type: t.Union([t.Literal("Polygon"), t.Literal("MultiPolygon")]),
        coordinates: t.Any(),
      }),
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
    "/territories/unassigned-clinics",
    async ({ query, getScope }) => {
      const scope = await getScope();
      return territoryUseCases.listUnassignedClinics().listUnassignedClinics({
        scope,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      });
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )
  .use(requirePermission("manage", "CLINIC"))
  .patch(
    "/clinics/:id/territory",
    async ({ params, body, getUser }) => {
      const user = await getUser();
      if (!isAdminRole(user.role.name as Role)) {
        throw new InsufficientPermissionsError(["clinic:update"], [`role:${user.role.name}`]);
      }
      return territoryUseCases.adminOverrideClinicTerritory().adminOverrideClinicTerritory({
        clinicId: params.id,
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
  .post("/clinics/:id/territory/unlock-geo", async ({ params, getUser }) => {
    const user = await getUser();
    if (!isAdminRole(user.role.name as Role)) {
      throw new InsufficientPermissionsError(["clinic:update"], [`role:${user.role.name}`]);
    }
    return territoryUseCases.unlockClinicGeo().unlockClinicGeo({ clinicId: params.id });
  })
  .use(requirePermission("update", "TERRITORY"))
  .post(
    "/territories/approval-requests",
    async ({ body, getUser }) => {
      const user = await getUser();
      return territoryUseCases.submitApproval().submitRequest({
        requesterId: user.id,
        requesterRole: user.role.name as Role,
        type: body.type,
        entityPayload: body.entityPayload ?? {},
        targetTerritoryId: body.targetTerritoryId,
        clinicId: body.clinicId,
        toTerritoryId: body.toTerritoryId,
        reason: body.reason,
      });
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal("create_territory"),
          t.Literal("reparent_territory"),
          t.Literal("deactivate_territory"),
          t.Literal("clinic_territory_change"),
        ]),
        entityPayload: t.Optional(t.Record(t.String(), t.Any())),
        targetTerritoryId: t.Optional(t.String()),
        clinicId: t.Optional(t.String()),
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
