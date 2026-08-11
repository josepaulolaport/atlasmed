import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { inviteUserBodySchema } from "./invite-user.route";

describe("inviteUserRoute request body", () => {
  it("accepts numeric CRM IDs sent by mobile", async () => {
    const app = new Elysia().post("/invite", ({ body }) => body, {
      body: inviteUserBodySchema,
    });

    const response = await app.handle(
      new Request("http://localhost/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "invitee@example.com",
          phoneNumber: "21988181024",
          firstName: "Invitee",
          lastName: "Example",
          birthDate: "2000-10-07",
          roleId: 1,
          verticalAssignments: [{ verticalId: 1, territoryIds: [] }],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      roleId: 1,
      verticalAssignments: [{ verticalId: 1, territoryIds: [] }],
    });
  });
});
