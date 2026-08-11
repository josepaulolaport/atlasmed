import { describe, expect, it } from "bun:test";
import { Role } from "@atlasmed/access";
import { ForbiddenError, ValidationError } from "../../../shared/errors";
import {
  buildProfileFilter,
  resolveDenominator,
  resolveSingleVerticalId,
  resolveSubject,
  type DashboardDirectoryPort,
  type DashboardSubject,
} from "./dashboard-query";

function directory(
  overrides: Partial<DashboardDirectoryPort> = {},
): DashboardDirectoryPort {
  return {
    findUser: async () => null,
    findManagerZoneIds: async () => [],
    findManagedUserIds: async () => [],
    ...overrides,
  };
}

const rep: DashboardSubject = { userId: 5, roleName: Role.REP };
const manager: DashboardSubject = { userId: 2, roleName: Role.MANAGER };
const admin: DashboardSubject = { userId: 1, roleName: Role.ADMIN };

describe("resolveSingleVerticalId (spec 0014 §3)", () => {
  it("uses the caller's only vertical when none is requested", () => {
    expect(
      resolveSingleVerticalId({
        requestedVerticalId: null,
        accessibleVerticalIds: [7],
      }),
    ).toBe(7);
  });

  it("refuses to guess when the caller has more than one", () => {
    expect(() =>
      resolveSingleVerticalId({
        requestedVerticalId: null,
        accessibleVerticalIds: [1, 2],
      }),
    ).toThrow(ValidationError);
  });

  it("rejects a vertical the caller does not hold", () => {
    expect(() =>
      resolveSingleVerticalId({
        requestedVerticalId: 9,
        accessibleVerticalIds: [1, 2],
      }),
    ).toThrow(ForbiddenError);
  });
});

describe("resolveSubject (spec 0014 §2)", () => {
  it("defaults to the viewer", async () => {
    const subject = await resolveSubject({
      viewer: rep,
      subjectUserId: null,
      managedUserIds: [],
      directory: directory(),
    });
    expect(subject).toEqual(rep);
  });

  it("lets a manager open one of their own reps", async () => {
    const subject = await resolveSubject({
      viewer: manager,
      subjectUserId: 5,
      managedUserIds: [5, 6],
      directory: directory({ findUser: async () => rep }),
    });
    expect(subject).toEqual(rep);
  });

  it("refuses a manager a rep who is not theirs", async () => {
    await expect(
      resolveSubject({
        viewer: manager,
        subjectUserId: 99,
        managedUserIds: [5, 6],
        directory: directory({ findUser: async () => rep }),
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses a rep anyone but themselves", async () => {
    await expect(
      resolveSubject({
        viewer: rep,
        subjectUserId: 6,
        managedUserIds: [],
        directory: directory({ findUser: async () => rep }),
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("lets ops open anyone — it already reads every clinic in the linha", async () => {
    // Regression: ops may list the roster (`ListTeamUseCase`), so refusing it a
    // subject made the whole request 403 the moment that roster was sorted by a
    // metric — every row is computed by resolving that member as the subject.
    const subject = await resolveSubject({
      viewer: { userId: 8, roleName: Role.OPS },
      subjectUserId: 2,
      managedUserIds: [],
      directory: directory({ findUser: async () => manager }),
    });
    expect(subject).toEqual(manager);
  });

  it("lets an admin open anyone", async () => {
    const subject = await resolveSubject({
      viewer: admin,
      subjectUserId: 2,
      managedUserIds: [],
      directory: directory({ findUser: async () => manager }),
    });
    expect(subject).toEqual(manager);
  });
});

describe("resolveDenominator (spec 0014 §3)", () => {
  it("measures a rep on the clinics assigned to them", async () => {
    expect(
      await resolveDenominator({
        subject: rep,
        verticalId: 1,
        directory: directory(),
      }),
    ).toEqual({ kind: "rep", userId: 5 });
  });

  it("measures a manager on the clinics in their zones", async () => {
    expect(
      await resolveDenominator({
        subject: manager,
        verticalId: 1,
        directory: directory({ findManagerZoneIds: async () => [11, 12] }),
      }),
    ).toEqual({ kind: "zones", zoneIds: [11, 12] });
  });

  it("gives an admin the whole vertical — never more than one vertical", async () => {
    expect(
      await resolveDenominator({
        subject: admin,
        verticalId: 1,
        directory: directory(),
      }),
    ).toEqual({ kind: "global" });
  });
});

describe("buildProfileFilter", () => {
  it("narrows an admin by a manager filter to that manager's zones", async () => {
    const resolved = await buildProfileFilter({
      verticalId: 1,
      denominator: { kind: "global" },
      filters: { managerId: 2 },
      directory: directory({ findManagerZoneIds: async () => [11] }),
    });

    expect(resolved).toEqual({
      empty: false,
      filter: {
        verticalId: 1,
        zoneIds: [11],
        repUserId: null,
        stateId: null,
        municipalityId: null,
        unitTypeId: null,
      },
    });
  });

  it("intersects zone sets rather than widening them", async () => {
    const resolved = await buildProfileFilter({
      verticalId: 1,
      denominator: { kind: "zones", zoneIds: [11, 12] },
      filters: { managerId: 3 },
      directory: directory({ findManagerZoneIds: async () => [12, 13] }),
    });

    expect(resolved).toEqual({
      empty: false,
      filter: expect.objectContaining({ zoneIds: [12] }),
    });
  });

  it("resolves a contradictory rep filter to nothing, not to everything", async () => {
    const resolved = await buildProfileFilter({
      verticalId: 1,
      denominator: { kind: "rep", userId: 5 },
      filters: { repId: 7 },
      directory: directory(),
    });

    expect(resolved).toEqual({ empty: true });
  });

  it("resolves a manager with no zones to nothing", async () => {
    const resolved = await buildProfileFilter({
      verticalId: 1,
      denominator: { kind: "zones", zoneIds: [] },
      filters: {},
      directory: directory(),
    });

    expect(resolved).toEqual({ empty: true });
  });

  it("carries geography and unit-type filters through unchanged", async () => {
    const resolved = await buildProfileFilter({
      verticalId: 1,
      denominator: { kind: "global" },
      filters: { stateId: 35, municipalityId: 3550308, unitTypeId: 4 },
      directory: directory(),
    });

    expect(resolved).toEqual({
      empty: false,
      filter: {
        verticalId: 1,
        zoneIds: null,
        repUserId: null,
        stateId: 35,
        municipalityId: 3550308,
        unitTypeId: 4,
      },
    });
  });
});
