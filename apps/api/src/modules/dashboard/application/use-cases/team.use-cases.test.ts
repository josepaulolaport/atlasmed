import { describe, expect, it } from "bun:test";
import {
  Role,
  createEmptyScopeContext,
  withTerritoryScopeAliases,
} from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";
import type { DashboardDirectoryPort } from "../dashboard-query";
import type { TeamMemberRow } from "../../infrastructure/repositories/drizzle-team.repository";
import {
  GetMemberTerritoryMapUseCase,
  GetTeamMemberUseCase,
  ListAssignableClinicsUseCase,
  ListRepsWithoutPatchUseCase,
  ListTeamUseCase,
  type ListTeamRequest,
} from "./team.use-cases";

function member(overrides: Partial<TeamMemberRow>): TeamMemberRow {
  return {
    userId: 5,
    name: "Ana",
    email: "ana@example.com",
    avatarUrl: null,
    roleName: Role.REP,
    territories: [],
    assignedClinicCount: 0,
    ...overrides,
  };
}

type Deps = ConstructorParameters<typeof ListTeamUseCase>[0];

function deps(overrides: {
  managers?: TeamMemberRow[];
  reps?: TeamMemberRow[];
  zoneIds?: number[];
  /** Feeds the batched query's coverage figure, and the per-member fakes. */
  metricByUser?: Record<number, number | null>;
}): Deps & {
  calls: {
    metricSubjects: number[];
    batchScopes: string[];
    batchIds: number[][];
    batchZones: Array<number[] | null>;
  };
} {
  const calls = {
    metricSubjects: [] as number[],
    batchScopes: [] as string[],
    batchIds: [] as number[][],
    batchZones: [] as Array<number[] | null>,
  };
  const metric = {
    execute: async (request: { subjectUserId?: number | null }) => {
      calls.metricSubjects.push(request.subjectUserId!);
      const value = overrides.metricByUser?.[request.subjectUserId!] ?? null;
      return { value, percent: value, month: value ?? 0, metrics: [] };
    },
  };

  return {
    calls,
    teamRepository: {
      listManagers: async () => overrides.managers ?? [],
      listRepsUnderZones: async () => overrides.reps ?? [],
      listRepsWithoutPatch: async () => [],
      findMemberMetrics: async (input: {
        userIds: number[];
        scope: string;
        withinZoneIds?: number[] | null;
      }) => {
        calls.batchScopes.push(input.scope);
        calls.batchIds.push(input.userIds);
        calls.batchZones.push(input.withinZoneIds ?? null);
        // Only people with something in scope produce a row, exactly as the
        // real query's GROUP BY does — so anyone absent from `metricByUser`
        // exercises the holds-nothing path rather than a zeroed row.
        return new Map(
          input.userIds
            .filter((userId) => overrides.metricByUser?.[userId] != null)
            .map((userId) => {
              const value = overrides.metricByUser![userId]!;
              return [
                userId,
                {
                  assignedClinics: value,
                  coveragePercent: value,
                  cadastroPercent: value,
                  ordersMonth: value,
                },
              ];
            }),
        );
      },
    } as unknown as Deps["teamRepository"],
    directory: {
      findUser: async () => null,
      findManagerZoneIds: async () => overrides.zoneIds ?? [11],
      findManagedUserIds: async () => [],
    } satisfies DashboardDirectoryPort,
    metrics: {
      penetration: metric,
      unassignedClinics: metric,
    } as unknown as Deps["metrics"],
  };
}

function request(role: string, overrides: Partial<ListTeamRequest> = {}): ListTeamRequest {
  return {
    viewerId: 2,
    viewerRole: role,
    scope: withTerritoryScopeAliases({
      ...createEmptyScopeContext(),
      assignedVerticalIds: [1],
      managedUserIds: [5],
      isOperationallyActive: true,
    }),
    verticalId: 1,
    ...overrides,
  };
}

describe("member profile (spec 0015 §4)", () => {
  function profileDeps(overrides: {
    zoneIds?: number[];
    member?: Record<string, unknown> | null;
  }) {
    const seen: Array<{
      userId: number;
      verticalId: number;
      withinZoneIds: number[] | null;
    }> = [];
    return {
      seen,
      deps: {
        teamRepository: {
          findMember: async (input: {
            userId: number;
            verticalId: number;
            withinZoneIds: number[] | null;
          }) => {
            seen.push(input);
            return overrides.member === undefined
              ? { userId: input.userId }
              : overrides.member;
          },
        },
        directory: {
          findUser: async () => null,
          findManagerZoneIds: async () => overrides.zoneIds ?? [11],
          findManagedUserIds: async () => [],
        } satisfies DashboardDirectoryPort,
      } as unknown as ConstructorParameters<typeof GetTeamMemberUseCase>[0],
    };
  }

  function profileRequest(role: string, subjectUserId: number, viewerId = 2) {
    return {
      viewerId,
      viewerRole: role,
      scope: withTerritoryScopeAliases({
        ...createEmptyScopeContext(),
        assignedVerticalIds: [1],
        managedUserIds: [5],
        isOperationallyActive: true,
      }),
      subjectUserId,
      verticalId: 1,
    };
  }

  it("refuses a REP — Equipe shows them no one, including themselves", async () => {
    const { deps } = profileDeps({});
    await expect(
      new GetTeamMemberUseCase(deps).execute(profileRequest(Role.REP, 5, 5)),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses a manager someone their zones do not contain", async () => {
    // The roster's rule, not a second one: a profile reachable by someone the
    // roster would never list is a hole in the same fence.
    const { deps } = profileDeps({});
    await expect(
      new GetTeamMemberUseCase(deps).execute(profileRequest(Role.MANAGER, 99)),
    ).rejects.toThrow(ForbiddenError);
  });

  it("narrows a manager's reading to their own zones (0015 R1)", async () => {
    const { deps, seen } = profileDeps({ zoneIds: [11, 12] });
    await new GetTeamMemberUseCase(deps).execute(
      profileRequest(Role.MANAGER, 5),
    );

    expect(seen[0]).toEqual({ userId: 5, verticalId: 1, withinZoneIds: [11, 12] });
  });

  it("gives an admin the whole person", async () => {
    const { deps, seen } = profileDeps({});
    await new GetTeamMemberUseCase(deps).execute(profileRequest(Role.ADMIN, 5, 1));

    expect(seen[0]).toEqual({ userId: 5, verticalId: 1, withinZoneIds: null });
  });

  it("lets a manager open their own profile", async () => {
    const { deps } = profileDeps({});
    await expect(
      new GetTeamMemberUseCase(deps).execute(profileRequest(Role.MANAGER, 2)),
    ).resolves.toBeDefined();
  });

  it("refuses rather than rendering an empty profile", async () => {
    const { deps } = profileDeps({ member: null });
    await expect(
      new GetTeamMemberUseCase(deps).execute(profileRequest(Role.MANAGER, 5)),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("member territory map (spec 0015 §6)", () => {
  function mapDeps(overrides: { subjectRole?: string; zoneIds?: number[] }) {
    const seen: Array<Record<string, unknown>> = [];
    const feature = (name: string) => ({ id: 1, name, boundary: {}, holderName: null });
    return {
      seen,
      deps: {
        teamRepository: {
          listTerritoryFeatures: async (input: Record<string, unknown>) => {
            seen.push({ call: "patches", ...input });
            return [feature("Patch")];
          },
          listZoneFeatures: async (ids: number[]) => {
            seen.push({ call: "zones", ids });
            return ids.map((id) => feature(`Zona $${id}`));
          },
          listOtherZoneFeatures: async (input: Record<string, unknown>) => {
            seen.push({ call: "others", ...input });
            return [feature("Outra zona")];
          },
        },
        directory: {
          findUser: async (id: number) => ({
            userId: id,
            roleName: overrides.subjectRole ?? Role.REP,
          }),
          findManagerZoneIds: async () => overrides.zoneIds ?? [11],
          findManagedUserIds: async () => [],
        },
      } as unknown as ConstructorParameters<
        typeof GetMemberTerritoryMapUseCase
      >[0],
    };
  }

  function mapRequest(role: string, overrides: Record<string, unknown> = {}) {
    return {
      viewerId: 2,
      viewerRole: role,
      scope: withTerritoryScopeAliases({
        ...createEmptyScopeContext(),
        assignedVerticalIds: [1],
        managedUserIds: [5],
        isOperationallyActive: true,
      }),
      subjectUserId: 5,
      verticalId: 1,
      ...overrides,
    } as Parameters<GetMemberTerritoryMapUseCase["execute"]>[0];
  }

  it("draws a rep inside the viewing manager's own ground", async () => {
    const { deps, seen } = mapDeps({ zoneIds: [11, 12] });
    const map = await new GetMemberTerritoryMapUseCase(deps).execute(
      mapRequest(Role.MANAGER),
    );

    expect(map.subject).toHaveLength(1);
    expect(map.context).toHaveLength(2);
    expect(map.taken).toEqual([]);
    // The patches are filtered to the same zones the outline draws, so the map
    // never shows a polygon this manager has no authority over.
    expect(seen[0]).toMatchObject({ call: "patches", withinZoneIds: [11, 12] });
  });

  it("shows an admin a manager's zones against everyone else's", async () => {
    // I3 forbids overlap, so a zone grows only into unclaimed ground. Shading
    // the rest is what makes that visible before the save refuses it.
    const { deps } = mapDeps({ subjectRole: Role.MANAGER, zoneIds: [21] });
    const map = await new GetMemberTerritoryMapUseCase(deps).execute(
      mapRequest(Role.ADMIN, { viewerId: 1, subjectUserId: 541 }),
    );

    expect(map.subject).toHaveLength(1);
    expect(map.taken).toHaveLength(1);
    // A zone encloses nothing, so there is no outline to draw.
    expect(map.context).toEqual([]);
  });

  it("gives an admin the manager-context view of a rep (R9)", async () => {
    // Reached through a team, so the rep is drawn as that manager sees them
    // rather than against the whole country.
    const { deps, seen } = mapDeps({ zoneIds: [31] });
    const map = await new GetMemberTerritoryMapUseCase(deps).execute(
      mapRequest(Role.ADMIN, { viewerId: 1, viaManagerId: 541 }),
    );

    expect(map.context).toHaveLength(1);
    expect(seen[0]).toMatchObject({ withinZoneIds: [31] });
  });

  it("lets a manager redraw a patch but never a zone", async () => {
    // Zone geometry is ADMIN-only (spec 0009 §3.3).
    const patch = mapDeps({});
    const onPatch = await new GetMemberTerritoryMapUseCase(patch.deps).execute(
      mapRequest(Role.MANAGER),
    );
    expect(onPatch.canEdit).toBe(true);

    const zone = mapDeps({ subjectRole: Role.MANAGER });
    const onZone = await new GetMemberTerritoryMapUseCase(zone.deps).execute(
      mapRequest(Role.MANAGER, { subjectUserId: 5 }),
    );
    expect(onZone.canEdit).toBe(false);
  });

  it("lets OPS look and never draw (R3)", async () => {
    const { deps } = mapDeps({});
    const map = await new GetMemberTerritoryMapUseCase(deps).execute(
      mapRequest(Role.OPS, { viewerId: 9 }),
    );

    expect(map.canEdit).toBe(false);
  });

  it("refuses a manager a rep outside their zones", async () => {
    const { deps } = mapDeps({});
    await expect(
      new GetMemberTerritoryMapUseCase(deps).execute(
        mapRequest(Role.MANAGER, { subjectUserId: 99 }),
      ),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("assignable clinics (spec 0015 R6)", () => {
  function assignableDeps(overrides: {
    subjectRole?: string;
    zoneIds?: number[];
  }) {
    const seen: Array<Record<string, unknown>> = [];
    return {
      seen,
      deps: {
        teamRepository: {
          listAssignableClinics: async (input: Record<string, unknown>) => {
            seen.push(input);
            return { rows: [], total: 0 };
          },
        },
        directory: {
          findUser: async (id: number) => ({
            userId: id,
            roleName: overrides.subjectRole ?? Role.REP,
          }),
          findManagerZoneIds: async () => overrides.zoneIds ?? [11],
          findManagedUserIds: async () => [],
        },
      } as unknown as ConstructorParameters<
        typeof ListAssignableClinicsUseCase
      >[0],
    };
  }

  function assignableRequest(
    role: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      viewerId: 2,
      viewerRole: role,
      scope: withTerritoryScopeAliases({
        ...createEmptyScopeContext(),
        assignedVerticalIds: [1],
        managedUserIds: [5],
        isOperationallyActive: true,
      }),
      subjectUserId: 5,
      verticalId: 1,
      ...overrides,
    } as Parameters<ListAssignableClinicsUseCase["execute"]>[0];
  }

  it("refuses a manager subject — only a rep holds clinics", async () => {
    // An empty list would read as "none available", which is a different and
    // wrong answer to "can this person take a clinic".
    const { deps } = assignableDeps({ subjectRole: Role.MANAGER });
    await expect(
      new ListAssignableClinicsUseCase(deps).execute(
        assignableRequest(Role.MANAGER),
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses OPS — it reads everything and changes nothing", async () => {
    const { deps } = assignableDeps({});
    await expect(
      new ListAssignableClinicsUseCase(deps).execute(
        assignableRequest(Role.OPS),
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses a manager a rep outside their zones", async () => {
    const { deps } = assignableDeps({});
    await expect(
      new ListAssignableClinicsUseCase(deps).execute(
        assignableRequest(Role.MANAGER, { subjectUserId: 99 }),
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it("defaults to the patch door, scoped to the reader's ground", async () => {
    const { deps, seen } = assignableDeps({ zoneIds: [11, 12] });
    await new ListAssignableClinicsUseCase(deps).execute(
      assignableRequest(Role.MANAGER),
    );

    expect(seen[0]).toMatchObject({
      mode: "patch",
      withinZoneIds: [11, 12],
      userId: 5,
    });
  });

  it("does not scan the linha for an empty search", async () => {
    // Measured at ~770ms against 1.4k clinics with no term, ~30ms with one —
    // and "every clinic in the linha" is not a list anyone asked for.
    const { deps, seen } = assignableDeps({});
    const result = await new ListAssignableClinicsUseCase(deps).execute(
      assignableRequest(Role.MANAGER, { mode: "search", search: "   " }),
    );

    expect(result.data).toEqual([]);
    expect(seen).toHaveLength(0);
  });

  it("searches once a term is given", async () => {
    const { deps, seen } = assignableDeps({});
    await new ListAssignableClinicsUseCase(deps).execute(
      assignableRequest(Role.MANAGER, { mode: "search", search: "  clinica " }),
    );

    expect(seen[0]).toMatchObject({ mode: "search", search: "clinica" });
  });

  it("gives an admin the whole ground to assign from", async () => {
    const { deps, seen } = assignableDeps({});
    await new ListAssignableClinicsUseCase(deps).execute(
      assignableRequest(Role.ADMIN, { viewerId: 1 }),
    );

    expect(seen[0]).toMatchObject({ withinZoneIds: null });
  });
});

describe("Equipe roster (spec 0014 §6)", () => {
  it("shows a manager their own reps", async () => {
    const d = deps({ reps: [member({ userId: 5 }), member({ userId: 6, name: "Bruno" })] });
    const result = await new ListTeamUseCase(d).execute(request(Role.MANAGER));

    expect(result.data.map((row) => row.userId)).toEqual([5, 6]);
  });

  it("shows an admin the managers, and one manager's team when asked", async () => {
    const managers = deps({ managers: [member({ userId: 2, roleName: Role.MANAGER })] });
    const roster = await new ListTeamUseCase(managers).execute(request(Role.ADMIN));
    expect(roster.data[0]!.roleName).toBe(Role.MANAGER);

    const team = deps({ reps: [member({ userId: 5 })] });
    const drilled = await new ListTeamUseCase(team).execute(
      request(Role.ADMIN, { managerId: 2 }),
    );
    expect(drilled.data[0]!.userId).toBe(5);
  });

  it("refuses a manager another manager's team", async () => {
    const d = deps({});
    await expect(
      new ListTeamUseCase(d).execute(request(Role.MANAGER, { managerId: 99 })),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses a REP — a rep has no team", async () => {
    const d = deps({});
    await expect(
      new ListTeamUseCase(d).execute(request(Role.REP, { viewerId: 5 })),
    ).rejects.toThrow(ForbiddenError);
  });

  it("sorts alphabetically and still carries every row metric", async () => {
    const d = deps({
      reps: [member({ userId: 6, name: "Bruno" }), member({ userId: 5, name: "Ana" })],
      metricByUser: { 5: 3, 6: 9 },
    });
    const result = await new ListTeamUseCase(d).execute(request(Role.MANAGER));

    expect(result.data.map((row) => row.name)).toEqual(["Ana", "Bruno"]);
    expect(result.data.every((row) => row.metricValue === null)).toBe(true);
    // The row metrics are not conditional on the sort — that is the whole point
    // of batching them, and the screen shows several at once.
    expect(result.data.map((row) => row.metrics?.ordersMonth)).toEqual([3, 9]);
    expect(d.calls.metricSubjects).toEqual([]);
  });

  it("sorts by a row metric without a single per-member query", async () => {
    const d = deps({
      reps: [member({ userId: 5, name: "Ana" }), member({ userId: 6, name: "Bruno" })],
      metricByUser: { 5: 3, 6: 9 },
    });
    const result = await new ListTeamUseCase(d).execute(
      request(Role.MANAGER, { sortBy: "coverage", order: "desc" }),
    );

    expect(result.data.map((row) => row.userId)).toEqual([6, 5]);
    expect(result.data[0]!.metricValue).toBe(9);
    // The N+1 this replaced: one metric use case call per member, per roster.
    expect(d.calls.metricSubjects).toEqual([]);
    expect(d.calls.batchIds).toEqual([[5, 6]]);
  });

  it("reads holding nothing as zero clinics, not as a missing figure", async () => {
    // Someone with an empty patch aggregates to no row in the batch. Treating
    // that as "not calculable" would sort them with the failures instead of at
    // the bottom where zero belongs — and would show "—" for a count that is
    // genuinely 0.
    const d = deps({ reps: [member({ userId: 9, name: 'Novo' })] });
    const result = await new ListTeamUseCase(d).execute(
      request(Role.MANAGER, { sortBy: "assigned-clinics" }),
    );

    expect(result.data[0]!.metrics.assignedClinics).toBe(0);
    expect(result.data[0]!.metrics.ordersMonth).toBe(0);
    expect(result.data[0]!.metricValue).toBe(0);
    // A percentage of nothing stays absent — 0% would be a claim about a
    // denominator that does not exist.
    expect(result.data[0]!.metrics.coveragePercent).toBeNull();
  });

  it("still computes penetração per member — it is not a row metric", async () => {
    const d = deps({
      reps: [member({ userId: 5, name: "Ana" }), member({ userId: 6, name: "Bruno" })],
      metricByUser: { 5: 3, 6: 9 },
    });
    await new ListTeamUseCase(d).execute(
      request(Role.MANAGER, { sortBy: "penetration" }),
    );

    expect(d.calls.metricSubjects.sort()).toEqual([5, 6]);
  });

  it("measures a rep roster against the zones it was built from (0015 R1)", async () => {
    // The same zones that selected the members narrow their figures. That is
    // what makes a manager's header equal the sum of the rows beneath it, and
    // what stops a rep shared with another manager contributing clinics this
    // manager cannot act on.
    const own = deps({ reps: [member({ userId: 5 })], zoneIds: [11, 12] });
    await new ListTeamUseCase(own).execute(request(Role.MANAGER));
    expect(own.calls.batchZones).toEqual([[11, 12]]);

    const drilled = deps({ reps: [member({ userId: 5 })], zoneIds: [21] });
    await new ListTeamUseCase(drilled).execute(
      request(Role.ADMIN, { managerId: 2 }),
    );
    expect(drilled.calls.batchZones).toEqual([[21]]);

    // A manager roster is the ground itself — there is nothing to narrow to.
    const managers = deps({ managers: [member({ userId: 2, roleName: Role.MANAGER })] });
    await new ListTeamUseCase(managers).execute(request(Role.ADMIN));
    expect(managers.calls.batchZones).toEqual([null]);
  });

  it("measures each roster against its own denominator", async () => {
    // Spec 0014 §3: a manager is measured on the clinics in their zones, a rep
    // on the clinics assigned to them. Sending the wrong scope would silently
    // give a manager a figure of zero — they hold no assignments.
    const admin = deps({ managers: [member({ userId: 2, roleName: Role.MANAGER })] });
    await new ListTeamUseCase(admin).execute(request(Role.ADMIN));
    expect(admin.calls.batchScopes).toEqual(["manager"]);

    const drilled = deps({ reps: [member({ userId: 5 })] });
    await new ListTeamUseCase(drilled).execute(
      request(Role.ADMIN, { managerId: 2 }),
    );
    expect(drilled.calls.batchScopes).toEqual(["rep"]);
  });

  it("sorts members with no calculable value last, in both directions", async () => {
    for (const order of ["asc", "desc"] as const) {
      const d = deps({
        reps: [
          member({ userId: 5, name: "Ana" }),
          member({ userId: 6, name: "Bruno" }),
        ],
        metricByUser: { 5: null, 6: 4 },
      });
      const result = await new ListTeamUseCase(d).execute(
        request(Role.MANAGER, { sortBy: "coverage", order }),
      );

      expect(result.data.at(-1)!.userId).toBe(5);
    }
  });
});

describe("reps without a patch (spec 0009 R8 / 0014 §7.8)", () => {
  it("lists them for an admin", async () => {
    const rows = [member({ userId: 7, name: "Sem patch" })];
    const useCase = new ListRepsWithoutPatchUseCase({
      teamRepository: {
        listRepsWithoutPatch: async () => rows,
      } as unknown as Deps["teamRepository"],
    });

    expect(await useCase.execute({ viewerRole: Role.ADMIN })).toEqual({ data: rows });
  });

  it("refuses a manager — such a rep is on no team by definition", async () => {
    const useCase = new ListRepsWithoutPatchUseCase({
      teamRepository: {
        listRepsWithoutPatch: async () => [],
      } as unknown as Deps["teamRepository"],
    });

    await expect(useCase.execute({ viewerRole: Role.MANAGER })).rejects.toThrow(
      ForbiddenError,
    );
  });
});
