import { describe, expect, test } from "bun:test";
import { isDatabaseReachable } from "../../../../test-utils/db-harness";
import type { DashboardProfileFilter } from "../../application/dashboard-query";
import {
  PURCHASE_BUCKET_STAGES,
  metricPredicateForTest,
} from "../../application/use-cases/dashboard-metrics.use-cases";
import { DrizzleDashboardRepository } from "./drizzle-dashboard.repository";

/**
 * Every number on Desempenho opens a list. This asserts the list holds exactly
 * as many clinics as the number that opened it.
 *
 * The property is not theoretical. The donut counts funnel stages and the
 * client groups them; the drill-down filters rows server-side. Those are two
 * expressions of one rule, and when the grouping moved to the client the
 * predicate stayed behind — the card read "26 Ativas" and its list held 15,
 * "20 Inativas" held 14, "1090 Nunca compraram" held 1107. Nothing failed:
 * both screens looked plausible on their own, and only opening one from the
 * other showed it.
 *
 * Asserted against real rows rather than rendered SQL, because the defect was
 * never in the SQL's shape — both queries were well-formed and meant different
 * things.
 */
const dbUp = await isDatabaseReachable();

const repository = new DrizzleDashboardRepository();

function filter(
  overrides: Partial<DashboardProfileFilter> = {},
): DashboardProfileFilter {
  return {
    verticalId: 1,
    zoneIds: null,
    repUserIds: null,
    stateIds: null,
    municipalityIds: null,
    unitTypeIds: null,
    ...overrides,
  };
}

async function drillDownTotal(
  metric: Parameters<typeof metricPredicateForTest>[0],
  scope: DashboardProfileFilter,
): Promise<number> {
  const { total } = await repository.listScopedClinics({
    filter: scope,
    predicate: metricPredicateForTest(metric),
    offset: 0,
    limit: 1,
  });
  return total;
}

describe.if(dbUp)("a card and the list it opens hold the same clinics", () => {
  // Global and manager-shaped, because the two scopes reach the rows by
  // different predicates: an unscoped reader can agree while a manager does
  // not. That is exactly how the CPF card shipped a count of 1 over an empty
  // list — the count was scoped by zone and its list by rep assignment.
  const scopes: Array<{ name: string; filter: DashboardProfileFilter }> = [
    { name: "global", filter: filter() },
    { name: "manager zones", filter: filter({ zoneIds: [3, 4, 5] }) },
  ];

  for (const scope of scopes) {
    test(`purchase buckets partition the donut — ${scope.name}`, async () => {
      const buckets = await repository.countPurchaseBuckets(scope.filter);

      // Grouped the way the client groups them, which is the number the rep
      // actually reads off the card.
      const expected = {
        "bucket-active": PURCHASE_BUCKET_STAGES["bucket-active"].reduce(
          (sum, stage) => sum + buckets.stages[stage],
          0,
        ),
        "bucket-inactive": PURCHASE_BUCKET_STAGES["bucket-inactive"].reduce(
          (sum, stage) => sum + buckets.stages[stage],
          0,
        ),
        "bucket-never-bought":
          buckets.stages.NEVER_PURCHASED + buckets.stages.UNKNOWN,
      } as const;

      for (const [metric, count] of Object.entries(expected)) {
        const total = await drillDownTotal(
          metric as Parameters<typeof metricPredicateForTest>[0],
          scope.filter,
        );
        expect(`${metric}=${total}`).toBe(`${metric}=${count}`);
      }

      // And nothing falls between the slices.
      const summed = Object.values(expected).reduce((a, b) => a + b, 0);
      expect(summed).toBe(buckets.total);
    });

    test(`the CPF warning opens its own count — ${scope.name}`, async () => {
      const issues = await repository.countCpfIssues(scope.filter);

      expect(await drillDownTotal("cpf-missing", scope.filter)).toBe(
        issues.missing,
      );
      expect(await drillDownTotal("cpf-invalid", scope.filter)).toBe(
        issues.invalid,
      );
    });

    test(`cadastro completion opens its own count — ${scope.name}`, async () => {
      const { registered } = await repository.countRegisteredProfiles(
        scope.filter,
      );
      expect(await drillDownTotal("cadastro-completion", scope.filter)).toBe(
        registered,
      );
    });

    test(`unassigned clinics open their own count — ${scope.name}`, async () => {
      const count = await repository.countProfilesWithoutRep(scope.filter);
      expect(await drillDownTotal("unassigned-clinics", scope.filter)).toBe(
        count,
      );
    });

    test(`assigned clinics open their own count — ${scope.name}`, async () => {
      const count = await repository.countProfilesWithRep(scope.filter);
      expect(await drillDownTotal("assigned-clinics", scope.filter)).toBe(count);
    });

    test(`atribuídas and não atribuídas partition the scope — ${scope.name}`, async () => {
      // The defect this pair shipped with: "Clínicas atribuídas" counted the
      // whole scope, so an admin read 2374 atribuídas beside 941 sem
      // representante — the same clinics counted twice, under two labels that
      // contradict each other. Neither number alone looked wrong.
      const [withRep, withoutRep, total] = await Promise.all([
        repository.countProfilesWithRep(scope.filter),
        repository.countProfilesWithoutRep(scope.filter),
        repository.countProfiles(scope.filter),
      ]);

      expect(withRep + withoutRep).toBe(total);
    });
  }
});
