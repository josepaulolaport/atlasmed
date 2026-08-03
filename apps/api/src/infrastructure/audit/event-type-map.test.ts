import { describe, expect, it } from "bun:test";
import { resolveAuditEvent } from "./event-type-map";

describe("interaction audit event map", () => {
  it("maps lifecycle commands without including correction content", () => {
    expect(resolveAuditEvent("POST", "/api/v1/interactions/interaction-1/start")).toEqual({ eventType: "INTERACTION.STARTED" });
    expect(resolveAuditEvent("POST", "/api/v1/interactions/interaction-1/complete")).toEqual({ eventType: "INTERACTION.COMPLETED" });
  });
});
