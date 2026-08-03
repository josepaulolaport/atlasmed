import { describe, expect, it } from "bun:test";
import { InvalidInviteError } from "../../../../shared/errors";
import { mapAcceptInviteRouteError } from "./accept-invite.route";

describe("accept invite route errors", () => {
  it("preserves INVALID_INVITE as a structured 400 response", () => {
    expect(mapAcceptInviteRouteError(new InvalidInviteError())).toEqual({
      status: 400,
      body: {
        error: {
          code: "INVALID_INVITE",
          message: "Invalid invite",
        },
      },
    });
  });
});
