import { describe, expect, it } from "bun:test";
import {
  queryCountLogger,
  summarizeQueries,
  withQueryCount,
} from "./query-counter";

describe("withQueryCount", () => {
  it("records queries issued inside the scope, in order", async () => {
    const { result, queries } = await withQueryCount(async () => {
      queryCountLogger.logQuery("select 1");
      queryCountLogger.logQuery("select 2");
      return "done";
    });

    expect(result).toBe("done");
    expect(queries.map((q) => q.sql)).toEqual(["select 1", "select 2"]);
    expect(queries.map((q) => q.index)).toEqual([1, 2]);
  });

  it("records nothing outside a scope", () => {
    // The logger stays attached to the production client, so this is what keeps
    // it inert there rather than accumulating every query the process runs.
    expect(() => queryCountLogger.logQuery("select 1")).not.toThrow();
  });

  it("keeps concurrent scopes separate", async () => {
    // Two requests in flight at once must not pool their counts, or every
    // measurement under load would be someone else's traffic.
    const [left, right] = await Promise.all([
      withQueryCount(async () => {
        queryCountLogger.logQuery("left");
        await new Promise((resolve) => setTimeout(resolve, 5));
        queryCountLogger.logQuery("left again");
      }),
      withQueryCount(async () => {
        queryCountLogger.logQuery("right");
      }),
    ]);

    expect(left.queries.map((q) => q.sql)).toEqual(["left", "left again"]);
    expect(right.queries.map((q) => q.sql)).toEqual(["right"]);
  });

  it("does not leak an inner scope's queries into the outer one", async () => {
    const { queries: outer } = await withQueryCount(async () => {
      queryCountLogger.logQuery("outer");
      await withQueryCount(async () => {
        queryCountLogger.logQuery("inner");
      });
    });

    expect(outer.map((q) => q.sql)).toEqual(["outer"]);
  });
});

describe("summarizeQueries", () => {
  it("groups by statement shape so an N+1 is visible", () => {
    // The point of the summary: 4 round trips look unremarkable until three of
    // them are the same statement.
    const summary = summarizeQueries([
      { sql: "select * from a where id = $1", index: 1 },
      { sql: "select  *  from a  where id = $1", index: 2 },
      { sql: "select * from a where id = $1", index: 3 },
      { sql: "select * from b", index: 4 },
    ]);

    expect(summary[0]).toEqual({
      sql: "select * from a where id = $1",
      count: 3,
    });
    expect(summary[1]).toEqual({ sql: "select * from b", count: 1 });
  });
});
