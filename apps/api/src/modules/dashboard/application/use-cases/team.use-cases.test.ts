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
  metricByUser?: Record<number, number | null>;
}): Deps & { calls: { metricSubjects: number[] } } {
  const calls = { metricSubjects: [] as number[] };
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
    } as unknown as Deps["teamRepository"],
    directory: {
      findUser: async () => null,
      findManagerZoneIds: async () => overrides.zoneIds ?? [11],
      findManagedUserIds: async () => [],
    } satisfies DashboardDirectoryPort,
    metrics: {
      assignedClinics: metric,
      coverage: metric,
      cadastroCompletion: metric,
      orders: metric,
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

  it("sorts alphabetically and computes no metric by default", async () => {
    const d = deps({
      reps: [member({ userId: 6, name: "Bruno" }), member({ userId: 5, name: "Ana" })],
    });
    const result = await new ListTeamUseCase(d).execute(request(Role.MANAGER));

    expect(result.data.map((row) => row.name)).toEqual(["Ana", "Bruno"]);
    expect(d.calls.metricSubjects).toEqual([]);
    expect(result.data.every((row) => row.metricValue === null)).toBe(true);
  });

  it("computes only the active sort metric, once per member (§7.7)", async () => {
    const d = deps({
      reps: [member({ userId: 5, name: "Ana" }), member({ userId: 6, name: "Bruno" })],
      metricByUser: { 5: 3, 6: 9 },
    });
    const result = await new ListTeamUseCase(d).execute(
      request(Role.MANAGER, { sortBy: "coverage", order: "desc" }),
    );

    expect(d.calls.metricSubjects.sort()).toEqual([5, 6]);
    expect(result.data.map((row) => row.userId)).toEqual([6, 5]);
    expect(result.data[0]!.metricValue).toBe(9);
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
