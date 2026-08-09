import { describe, expect, it } from "bun:test";
import { resolveAuditEvent } from "./event-type-map";

describe("interaction audit event map", () => {
  it("maps lifecycle and occurrence commands without including sensitive content", () => {
    expect(resolveAuditEvent("POST", "/api/v1/interactions/1/start")).toEqual({
      eventType: "INTERACTION.STARTED",
    });
    expect(resolveAuditEvent("POST", "/api/v1/interactions/1/complete")).toEqual({
      eventType: "INTERACTION.COMPLETED",
    });
    expect(
      resolveAuditEvent(
        "PATCH",
        "/api/v1/calendar/1/occurrences/2026-08-03T09%3A00%5BUTC%5D"
      )
    ).toEqual({ eventType: "CALENDAR.OCCURRENCE_RESCHEDULED" });
    expect(
      resolveAuditEvent(
        "DELETE",
        "/api/v1/calendar/1/occurrences/2026-08-03T09%3A00%5BUTC%5D"
      )
    ).toEqual({
      eventType: "CALENDAR.OCCURRENCE_CANCELLED",
      severity: "WARNING",
    });
  });
});
