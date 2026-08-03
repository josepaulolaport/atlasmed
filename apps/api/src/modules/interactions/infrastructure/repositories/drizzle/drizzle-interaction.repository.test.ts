import { describe, expect, it } from "bun:test";
import { collectOverdueCandidates } from "./drizzle-interaction.repository";

interface Candidate {
  interaction: { id: string; updatedAt: Date; recurrenceKey: string };
  effectiveEndsAt: Date;
  cancelled: boolean;
}

describe("interaction overdue candidate pagination", () => {
  it("scans past more than limit*4 future rows without starving overdue rows", async () => {
    const now = new Date("2026-08-03T12:00:00.000Z");
    const rows: Candidate[] = Array.from({ length: 401 }, (_, index) => ({
      interaction: { id: `future-${String(index).padStart(3, "0")}`, updatedAt: new Date(index), recurrenceKey: `future-${index}` },
      effectiveEndsAt: new Date("2026-08-04T12:00:00.000Z"),
      cancelled: false,
    }));
    rows.push({ interaction: { id: "overdue", updatedAt: new Date(401), recurrenceKey: "overdue" },
      effectiveEndsAt: new Date("2026-08-03T11:00:00.000Z"), cancelled: false });

    const result = await collectOverdueCandidates<Candidate>({
      limit: 100,
      pageSize: 100,
      isOverdue: (candidate) => !candidate.cancelled && candidate.effectiveEndsAt < now,
      fetchPage: async (cursor) => rows.filter((row) => !cursor
        || row.interaction.updatedAt > cursor.updatedAt
        || (row.interaction.updatedAt.getTime() === cursor.updatedAt.getTime() && row.interaction.id > cursor.id)).slice(0, 100),
    });

    expect(result.map((row) => row.interaction.id)).toEqual(["overdue"]);
  });
});
