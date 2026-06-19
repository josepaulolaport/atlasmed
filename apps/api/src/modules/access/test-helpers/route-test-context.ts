import { mock } from "bun:test";
import { Elysia } from "elysia";
import {
  createEmptyScopeContext,
  createGlobalScopeContext,
  defineAbilitiesFor,
  type ScopeContext,
  type Action,
  type Subject,
} from "@atlasmed/access";
import type { Role } from "@atlasmed/access";
import { ForbiddenError } from "../../../shared/errors";

export interface RouteTestUser {
  id: string;
  email: string;
  username: string;
  role: {
    id: string;
    name: Role;
    description?: string | null;
  };
}

export const routeTestContext = {
  user: {
    id: "admin-test",
    email: "admin@test.example.com",
    username: "admintest",
    role: { id: "role-admin", name: "ADMIN" as Role },
  } satisfies RouteTestUser,
  scope: createGlobalScopeContext() as ScopeContext,
  mocks: {
    getUserAssignmentsExecute: mock(async (_params?: unknown) =>
      Promise.resolve({
        userId: "target-user",
        managerId: null,
        manager: null,
        territories: [],
        isOperationallyActive: false,
      })
    ),
    assignUserManagerExecute: mock(async (_params?: unknown) => Promise.resolve()),
    assignUserTerritoryExecute: mock(async (_params?: unknown) => Promise.resolve()),
    revokeUserTerritoryExecute: mock(async (_params?: unknown) => Promise.resolve()),
    listUsersExecute: mock(async (_params?: unknown) =>
      Promise.resolve({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      })
    ),
  },
};

export function setRouteTestActor(user: RouteTestUser, scope?: ScopeContext) {
  routeTestContext.user = user;
  routeTestContext.scope = scope ?? createGlobalScopeContext();
}

export function createRouteTestAuthPlugin(actor?: RouteTestUser, scope?: ScopeContext) {
  return new Elysia({ name: `auth-test-${actor?.id ?? "default"}` }).derive(
    { as: "scoped" },
    async () => {
      const user = actor ?? routeTestContext.user;
      const resolvedScope = scope ?? routeTestContext.scope;

      return {
        getUserId: async () => user.id,
        getUser: async () => user,
        getScope: async () => resolvedScope,
        getSessionId: async () => "test-session-id",
        getAuthContext: async () => ({
          userId: user.id,
          sessionId: "test-session-id",
          roleName: user.role.name,
        }),
      };
    }
  );
}

export async function assertRoutePermission(
  getUser: () => Promise<RouteTestUser>,
  action: Action,
  subject: Subject
) {
  const user = await getUser();
  const ability = defineAbilitiesFor(user.role.name);

  if (!ability.can(action, subject)) {
    throw new ForbiddenError();
  }
}

export const adminRouteTestUser: RouteTestUser = {
  id: "admin-test",
  email: "admin@test.example.com",
  username: "admintest",
  role: { id: "role-admin", name: "ADMIN" },
};

export const managerRouteTestUser: RouteTestUser = {
  id: "manager-test",
  email: "manager@test.example.com",
  username: "managertest",
  role: { id: "role-manager", name: "MANAGER" },
};

export const userRouteTestUser: RouteTestUser = {
  id: "user-test",
  email: "user@test.example.com",
  username: "usertest",
  role: { id: "role-user", name: "USER" },
};

export function managerScopedContext(territoryIds: string[]): ScopeContext {
  return {
    isGlobal: false,
    territoryIds,
    clinicIds: [],
    managedUserIds: ["field-user-test"],
    isOperationallyActive: territoryIds.length > 0,
  };
}

export function emptyManagerScope(): ScopeContext {
  return {
    ...createEmptyScopeContext(),
    managedUserIds: [],
  };
}

