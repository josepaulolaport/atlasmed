import { describe, expect, it } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { parseSpecialtyFilterValues } from "../../../application/specialty-filter";
import { buildSpecialtyMatchCondition } from "./drizzle-healthcare-professional.repository";

/**
 * Explorar's doctor specialty filter matched only the professional's *primary*
 * specialty, so filtering for Ortopedia hid every doctor who practises it as a
 * secondary one. Nothing errored and the response was a plausible list, which
 * is why it survived: only a rep who knew a specific doctor should be there
 * could tell.
 *
 * Found 2026-08-13 alongside the clinic filter audit, which established that
 * clinic focuses match ANY of a clinic's focuses. The two lists sat side by
 * side in the same UI answering the same question differently.
 *
 * Asserting on rendered SQL rather than on the expression: Drizzle expressions
 * are cyclic and compare equal by identity, so a test over them would pass
 * whether or not the flag was still there.
 */
const dialect = new PgDialect();

const render = (values: string[]) =>
  dialect.sqlToQuery(buildSpecialtyMatchCondition(values)).sql;

describe("buildSpecialtyMatchCondition", () => {
  it("does not restrict the match to the primary specialty", () => {
    // The defect, exactly: this string used to be present.
    expect(render(["ortopedia"])).not.toContain("is_primary");
  });

  it("still scopes the match to the professional being filtered", () => {
    // Without this correlation the EXISTS is true for every row as soon as any
    // professional anywhere holds the specialty — a filter that filters
    // nothing, which is worse than the bug it replaced.
    const sql = render(["ortopedia"]);
    expect(sql).toContain("phps.person_id =");
    expect(sql).toContain('"persons"."id"');
  });

  it("matches any of several specialties", () => {
    const { params } = dialect.sqlToQuery(
      buildSpecialtyMatchCondition(["ortopedia", "pediatria"]),
    );
    expect(params).toEqual(["ortopedia", "pediatria"]);
  });

  it("binds the values rather than inlining them", () => {
    // The values reach here from a query string.
    const { sql, params } = dialect.sqlToQuery(
      buildSpecialtyMatchCondition(["'); drop table persons;--"]),
    );
    expect(sql).not.toContain("drop table");
    expect(params).toEqual(["'); drop table persons;--"]);
  });

  it("compares against the same normalization the parser produces", () => {
    // Accents and repeated whitespace are stripped on both sides, so a rep
    // typing "Ortopedia" still matches "ORTOPEDIA  E TRAUMATOLOGIA" style rows.
    const sql = render(parseSpecialtyFilterValues("Ortopedia"));
    expect(sql).toContain("translate(lower(hs.name)");
    expect(sql).toContain("'[[:space:]]+', ' ', 'g'");
  });
});
