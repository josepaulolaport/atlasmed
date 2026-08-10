import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";
import { ValidationError } from "../../../../shared/errors";
import { serializeUser } from "./user.serializer";
import {
  createRouteTestAuthPlugin,
  routeTestContext,
  setRouteTestActor,
  userRouteTestUser,
} from "../../test-helpers/route-test-context";
import {
  createAccessTestApp,
  parseJsonResponse,
} from "../../test-helpers/access-test-app";

const fullUser = {
  id: userRouteTestUser.id,
  email: userRouteTestUser.email,
  username: userRouteTestUser.username,
  phoneNumber: "+5511999999999",
  firstName: "Field",
  lastName: "User",
  avatarUrl: "https://example.com/avatar.png",
  status: "ACTIVE",
  emailVerified: true,
  phoneVerified: false,
  twoFactorEnabled: true,
  emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  phoneVerifiedAt: null,
  role: userRouteTestUser.role,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

function buildUserTestRoute() {
  return new Elysia()
    .use(createRouteTestAuthPlugin(fullUser as any))
    .get("/user", async ({ getUser }: any) => serializeUser(await getUser()))
    .patch("/user", async ({ getUserId, body }: any) => {
      const userId = await getUserId();
      const updated = await routeTestContext.mocks.updateProfileExecute({
        userId,
        ...(body as Record<string, unknown>),
      });
      return serializeUser(updated as any);
    })
    .get("/user/capabilities", async ({ getUserId }: any) => {
      const userId = await getUserId();
      return routeTestContext.mocks.getCapabilitiesExecute({ userId });
    })
    .get("/user/preferences", async ({ getUserId }: any) => {
      const userId = await getUserId();
      return routeTestContext.mocks.getUserPreferencesExecute({ userId });
    })
    .patch("/user/preferences", async ({ getUserId, body }: any) => {
      const userId = await getUserId();
      return routeTestContext.mocks.updateUserPreferencesExecute({
        userId,
        ...(body as Record<string, unknown>),
      });
    });
}

describe("userRoute", () => {
  beforeEach(() => {
    setRouteTestActor(userRouteTestUser);
    routeTestContext.mocks.updateProfileExecute.mockReset();
    routeTestContext.mocks.updateProfileExecute.mockImplementation(() =>
      Promise.resolve({ ...fullUser, firstName: "Updated" } as any),
    );
    routeTestContext.mocks.getUserPreferencesExecute.mockReset();
    routeTestContext.mocks.getUserPreferencesExecute.mockImplementation(() =>
      Promise.resolve({
        theme: "system",
        pushNotificationsEnabled: true,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: false,
      }),
    );
    routeTestContext.mocks.updateUserPreferencesExecute.mockReset();
    routeTestContext.mocks.updateUserPreferencesExecute.mockImplementation(
      (input: any) =>
        Promise.resolve({
          theme: input.theme ?? "system",
          pushNotificationsEnabled: true,
          emailNotificationsEnabled: true,
          smsNotificationsEnabled: false,
        }),
    );
  });

  function createApp() {
    return createAccessTestApp().use(buildUserTestRoute());
  }

  it("returns the larger authenticated user shape from GET /user", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/user"),
    );

    expect(response.status).toBe(200);
    const body = await parseJsonResponse<Record<string, unknown>>(response);
    expect(body).toMatchObject({
      id: fullUser.id,
      email: fullUser.email,
      username: fullUser.username,
      phoneNumber: fullUser.phoneNumber,
      firstName: fullUser.firstName,
      lastName: fullUser.lastName,
      avatarUrl: fullUser.avatarUrl,
      status: fullUser.status,
      emailVerified: true,
      phoneVerified: false,
      twoFactorEnabled: true,
      emailVerifiedAt: fullUser.emailVerifiedAt.toISOString(),
      role: { id: fullUser.role.id, name: fullUser.role.name },
      createdAt: fullUser.createdAt.toISOString(),
      updatedAt: fullUser.updatedAt.toISOString(),
    });
  });

  it("updates the authenticated user profile from PATCH /user", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/user", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName: "Updated" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(routeTestContext.mocks.updateProfileExecute).toHaveBeenCalledWith({
      userId: fullUser.id,
      firstName: "Updated",
    });
  });

  it("returns the authenticated capability snapshot from GET /user/capabilities", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/user/capabilities"),
    );

    expect(response.status).toBe(200);
    expect(routeTestContext.mocks.getCapabilitiesExecute).toHaveBeenCalledWith({
      userId: fullUser.id,
    });
    expect(
      await parseJsonResponse<{
        version: number;
        capabilities: Array<{ resource: string; actions: string[] }>;
      }>(response),
    ).toEqual({
      version: 2,
      capabilities: [{ resource: "agenda", actions: ["read"] }],
    });
  });

  it("reads preferences from GET /user/preferences", async () => {
    const response = await createApp().handle(
      new Request("http://localhost/user/preferences"),
    );

    expect(response.status).toBe(200);
    expect(
      routeTestContext.mocks.getUserPreferencesExecute,
    ).toHaveBeenCalledWith({
      userId: fullUser.id,
    });
  });

  it("rejects unknown preference fields", async () => {
    routeTestContext.mocks.updateUserPreferencesExecute.mockImplementationOnce(
      () => {
        throw new ValidationError([
          { field: "body.unknown", message: "Unknown preference field" },
        ]);
      },
    );

    const response = await createApp().handle(
      new Request("http://localhost/user/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ unknown: true }),
      }),
    );

    expect(response.status).toBe(400);
    expect(
      routeTestContext.mocks.updateUserPreferencesExecute,
    ).toHaveBeenCalledWith({
      userId: fullUser.id,
      unknown: true,
    });
  });
});
