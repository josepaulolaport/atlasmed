import { describe, expect, test } from "bun:test";
import {
  assertDisposableDatabaseName,
  assertLocalDatabaseUrl,
  parseDatabaseName,
  parsePushArgs,
} from "./db-push-gates";

describe("db-push hard gates", () => {
  test("parseDatabaseName extracts path db", () => {
    expect(
      parseDatabaseName("postgresql://postgres:postgres@localhost:5432/atlasmed-3"),
    ).toBe("atlasmed-3");
    expect(
      parseDatabaseName("postgresql://postgres@127.0.0.1/atlasmed_test"),
    ).toBe("atlasmed_test");
  });

  test("valued local DB names are refused with no override", () => {
    expect(() => assertDisposableDatabaseName("atlasmed-3")).toThrow(
      /not disposable/,
    );
    expect(() => assertDisposableDatabaseName("atlasmed")).toThrow(
      /not disposable/,
    );
    expect(() => assertDisposableDatabaseName("atlasmed_test")).not.toThrow();
    expect(() => assertDisposableDatabaseName("atlasmed_scratch")).not.toThrow();
    expect(() => assertDisposableDatabaseName("atlasmed_empty")).not.toThrow();
  });

  test("non-local hosts are refused", () => {
    expect(() =>
      assertLocalDatabaseUrl(
        "postgresql://user:pass@ep-cool.neon.tech/neondb",
      ),
    ).toThrow(/not local/);
    expect(() =>
      assertLocalDatabaseUrl(
        "postgresql://postgres:postgres@localhost:5432/atlasmed_test",
      ),
    ).not.toThrow();
  });

  test("parsePushArgs strips --force", () => {
    expect(parsePushArgs(["--force", "--verbose"])).toEqual({
      force: true,
      forward: ["--verbose"],
    });
    expect(parsePushArgs(["-f"])).toEqual({ force: true, forward: [] });
  });
});
