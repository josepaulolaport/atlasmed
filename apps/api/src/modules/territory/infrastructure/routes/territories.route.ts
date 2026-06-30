import { Elysia, t } from "elysia";
import { Role } from "@atlasmed/access";
import { auth } from "../../../access/composition";
import { requirePermission } from "../../../access/infrastructure/middleware/permission.middleware";
import { territoryRepositories, territoryUseCases } from "../../composition";
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
        scope
      );
    },
    {
      query: t.Object({
        format: t.Optional(t.Union([t.Literal("tree"), t.Literal("flat")])),
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
        isCountryLevel: t.Optional(t.Boolean()),
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
        isCountryLevel: t.Optional(t.Boolean()),
        blockSiblingOverlap: t.Optional(t.Boolean()),
        sortOrder: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  )
  .use(requirePermission("read", "TERRITORY"))
  .get("/territories/ambiguous-parents", async ({ getScope }) => {
    const scope = await getScope();
    return territoryUseCases
      .listAmbiguousParentTerritories()
      .listAmbiguousParentTerritories(scope);
  })
  .use(requirePermission("read", "TERRITORY"))
  .get("/territories/:id", async ({ params, getScope }) => {
    const scope = await getScope();
    const territory = await territoryUseCases.getTerritory().getTerritory(params.id);
    if (!territory) {
      throw new ResourceNotFoundError("Territory", params.id);
    }
    if (!scope.isGlobal) {
      await assertManagerReadableTerritory(
        scope,
        params.id,
        territoryRepositories.closure
      );
    }
    return territory;
  })
  .use(requirePermission("read", "TERRITORY"))
  .get("/territories/:id/descendants", async ({ params, getScope }) => {
    const scope = await getScope();
    return territoryUseCases.getDescendants().getDescendants(params.id, scope);
  })
  .use(requirePermission("create", "TERRITORY"))
  .post(
    "/territories",
    async ({ body, getUser, getScope }) => {
      const user = await getUser();
      if (isAdminRole(user.role.name as Role)) {
        return territoryUseCases.createTerritory().createTerritory(body);
      }

      if (isManagerRole(user.role.name as Role)) {
        const scope = await getScope();
        return territoryUseCases.submitApproval().submitRequest({
          requesterId: user.id,
          requesterRole: user.role.name as Role,
          scope,
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
        slug: t.String(),
        territoryTypeId: t.Optional(t.String()),
        typeSlug: t.Optional(t.String()),
        parentId: t.Optional(t.String()),
        countryCode: t.Optional(t.String()),
        reason: t.Optional(t.String()),
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

      if (isManagerRole(user.role.name as Role)) {
        const scope = await getScope();
        const type = body.isActive === false ? "deactivate_territory" : "reparent_territory";
        return territoryUseCases.submitApproval().submitRequest({
          requesterId: user.id,
          requesterRole: user.role.name as Role,
          scope,
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
    "/territories/unassigned-facilities",
    async ({ query, getScope }) => {
      const scope = await getScope();
      return territoryUseCases.listUnassignedFacilities().listUnassignedFacilities({
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
          t.Literal("create_territory"),
          t.Literal("reparent_territory"),
          t.Literal("deactivate_territory"),
          t.Literal("facility_territory_change"),
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
  )
  .use(requirePermission("read", "TERRITORY"))
  .get("/territories/:id/rollup-links", async ({ params, getScope }) => {
    const scope = await getScope();
    return territoryUseCases.listRollupLinks().listRollupLinks(params.id, scope);
  })
  .use(requirePermission("update", "TERRITORY"))
  .post(
    "/territories/:id/rollup-links",
    async ({ params, body, getUser }) => {
      const user = await getUser();
      if (!isAdminRole(user.role.name as Role)) {
        throw new InsufficientPermissionsError(["territory:update"], [`role:${user.role.name}`]);
      }
      return territoryUseCases.addRollupLink().addRollupLink({
        territoryId: params.id,
        ancestorId: body.ancestorId,
        relationshipType: body.relationshipType,
      });
    },
    {
      body: t.Object({
        ancestorId: t.String(),
        relationshipType: t.Optional(t.Literal("reporting")),
      }),
    }
  )
  .delete("/territories/:id/rollup-links/:linkId", async ({ params, getUser }) => {
    const user = await getUser();
    if (!isAdminRole(user.role.name as Role)) {
      throw new InsufficientPermissionsError(["territory:update"], [`role:${user.role.name}`]);
    }
    return territoryUseCases.removeRollupLink().removeRollupLink(params.id, params.linkId);
  })
  .use(requirePermission("read", "TERRITORY"))
  .get("/territories/:id/operational-members", async ({ params, getScope }) => {
    const scope = await getScope();
    return territoryUseCases.listOperationalMembers().listOperationalMembers({
      referenceTerritoryId: params.id,
      scope,
    });
  })
  .get("/territories/:id/geo-memberships", async ({ params, getScope }) => {
    const scope = await getScope();
    return territoryUseCases.listReferenceMemberships().listReferenceMemberships({
      operationalTerritoryId: params.id,
      scope,
    });
  })
  .get(
    "/territories/:id/clipped-boundary/:referenceId",
    async ({ params, getScope }) => {
      const scope = await getScope();
      return territoryUseCases.getClippedBoundary().getClippedBoundary({
        operationalTerritoryId: params.id,
        referenceTerritoryId: params.referenceId,
        scope,
      });
    }
  )
  .get("/territories/:id/coverage-view", async ({ params, getScope }) => {
    const scope = await getScope();
    return territoryUseCases.getReferenceCoverage().getReferenceCoverage({
      referenceTerritoryId: params.id,
      scope,
    });
  });
