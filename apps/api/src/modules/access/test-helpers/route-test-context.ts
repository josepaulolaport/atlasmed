import { mock } from "bun:test";
import { Elysia } from "elysia";
import {
  createEmptyScopeContext,
  createGlobalScopeContext,
  defineAbilitiesFor,
  withTerritoryScopeAliases,
  type ScopeContext,
  type Action,
  type Subject,
} from "@atlasmed/access";
import type { Role } from "@atlasmed/access";
import { ForbiddenError } from "../../../shared/errors";

export interface RouteTestUser {
  id: number;
  email: string;
  username: string;
  role: {
    id: number;
    name: Role;
    description?: string | null;
  };
}

export const routeTestContext = {
  user: {
    id: 1,
    email: "admin@test.example.com",
    username: "admintest",
    role: { id: 1, name: "ADMIN" as Role },
  } satisfies RouteTestUser,
  scope: createGlobalScopeContext() as ScopeContext,
  mocks: {
    getUserAssignmentsExecute: mock(async (_params?: unknown) =>
      Promise.resolve({
        userId: 2,
        isOperationallyActive: false,
        verticalAssignments: [],
      }),
    ),
    assignUserManagerExecute: mock(async (_params?: unknown) =>
      Promise.resolve(),
    ),
    assignUserTerritoryExecute: mock(async (_params?: unknown) =>
      Promise.resolve(),
    ),
    revokeUserTerritoryExecute: mock(async (_params?: unknown) =>
      Promise.resolve(),
    ),
    updateProfileExecute: mock(async (_params?: unknown) =>
      Promise.resolve(routeTestContext.user),
    ),
    getUserPreferencesExecute: mock(async (_params?: unknown) =>
      Promise.resolve({
        theme: "system",
        pushNotificationsEnabled: true,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: false,
      }),
    ),
    updateUserPreferencesExecute: mock(async (_params?: unknown) =>
      Promise.resolve({
        theme: "system",
        pushNotificationsEnabled: true,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: false,
      }),
    ),
    listUsersExecute: mock(async (_params?: unknown) =>
      Promise.resolve({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      }),
    ),
  },
};

export function setRouteTestActor(user: RouteTestUser, scope?: ScopeContext) {
  routeTestContext.user = user;
  routeTestContext.scope = scope ?? createGlobalScopeContext();
}

export function createRouteTestAuthPlugin(
  actor?: RouteTestUser,
  scope?: ScopeContext,
) {
  return new Elysia({ name: `auth-test-${actor?.id ?? "default"}` }).derive(
    { as: "scoped" },
    async () => {
      const user = actor ?? routeTestContext.user;
      const resolvedScope = scope ?? routeTestContext.scope;

      return {
        getUserId: async () => user.id,
        getUser: async () => user,
        getScope: async () => resolvedScope,
        getSessionId: async () => 1,
        getAuthContext: async () => ({
          userId: user.id,
          sessionId: 1,
          roleName: user.role.name,
        }),
      };
    },
  );
}

export async function assertRoutePermission(
  getUser: () => Promise<RouteTestUser>,
  action: Action,
  subject: Subject,
) {
  const user = await getUser();
  const ability = defineAbilitiesFor(user.role.name);

  if (!ability.can(action, subject)) {
    throw new ForbiddenError();
  }
}

export const adminRouteTestUser: RouteTestUser = {
  id: 1,
  email: "admin@test.example.com",
  username: "admintest",
  role: { id: 1, name: "ADMIN" },
};

export const managerRouteTestUser: RouteTestUser = {
  id: 2,
  email: "manager@test.example.com",
  username: "managertest",
  role: { id: 2, name: "MANAGER" },
};

export const userRouteTestUser: RouteTestUser = {
  id: 3,
  email: "user@test.example.com",
  username: "usertest",
  role: { id: 3, name: "REP" },
};

export function managerScopedContext(territoryIds: number[]): ScopeContext {
  return withTerritoryScopeAliases({
    isGlobal: false,
    assignedTerritoryIds: territoryIds,
    effectiveTerritoryIds: territoryIds,
    analyticsEffectiveTerritoryIds: [],
    facilityIds: [],
    analyticsFacilityIds: [],
    managedUserIds: [4],
    isOperationallyActive: territoryIds.length > 0,
  });
}

export function scopedManagerContext(input: {
  territoryIds: number[];
  facilityIds?: number[];
  analyticsFacilityIds?: number[];
  analyticsTerritoryIds?: number[];
  managedUserIds?: number[];
  isOperationallyActive?: boolean;
  grantIds?: number[];
}): ScopeContext {
  return withTerritoryScopeAliases({
    isGlobal: false,
    assignedTerritoryIds: input.territoryIds,
    effectiveTerritoryIds: input.territoryIds,
    analyticsEffectiveTerritoryIds: input.analyticsTerritoryIds ?? [],
    facilityIds: input.facilityIds ?? [],
    analyticsFacilityIds: input.analyticsFacilityIds ?? [],
    managedUserIds: input.managedUserIds ?? [],
    isOperationallyActive:
      input.isOperationallyActive ?? input.territoryIds.length > 0,
    grantIds: input.grantIds,
  });
}

export function emptyManagerScope(): ScopeContext {
  return {
    ...createEmptyScopeContext(),
    managedUserIds: [],
  };
}
