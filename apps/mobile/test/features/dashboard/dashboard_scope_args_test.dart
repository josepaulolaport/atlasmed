import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('DashboardScopeArgs', () {
    test('always sends the linha — a dashboard never mixes two', () {
      const args = DashboardScopeArgs(verticalId: 3);
      expect(args.toQuery(), {'verticalId': '3'});
    });

    test('carries every filter so metrics answer for the same population', () {
      const args = DashboardScopeArgs(
        verticalId: 1,
        subjectUserId: 5,
        unitTypeIds: [4],
        managerIds: [2],
        repIds: [7, 8],
        stateIds: [35, 33],
        municipalityIds: [3550308],
      );

      expect(args.toQuery(), {
        'verticalId': '1',
        'subjectUserId': '5',
        'unitTypeIds': '4',
        'managerIds': '2',
        'repIds': '7,8',
        'stateIds': '35,33',
        'municipalityIds': '3550308',
      });
    });

    test('an empty filter is absent from the query, not sent as empty', () {
      // `?stateIds=` would reach the API as a string that fails its digit
      // pattern, turning "no filter" into a 400.
      const args = DashboardScopeArgs(verticalId: 1);
      expect(args.toQuery(), {'verticalId': '1'});
    });

    test('clearing filters keeps the linha and the subject', () {
      const args = DashboardScopeArgs(
        verticalId: 1,
        subjectUserId: 5,
        stateIds: [35],
      );
      final cleared = args.cleared();

      expect(cleared.verticalId, 1);
      expect(cleared.subjectUserId, 5);
      expect(cleared.stateIds, isEmpty);
      expect(cleared.hasFilters, isFalse);
    });

    test(
      'equality keys the metric providers, so a filter change refetches',
      () {
        const a = DashboardScopeArgs(verticalId: 1, stateIds: [35]);
        const b = DashboardScopeArgs(verticalId: 1, stateIds: [35]);
        const c = DashboardScopeArgs(verticalId: 1, stateIds: [35, 41]);

        expect(a, b);
        expect(a.hashCode, b.hashCode);
        // Adding a second state has to count as a different scope, or the
        // cards would keep showing the answer to the previous question.
        expect(a, isNot(c));
      },
    );
  });

  group('cascadeSelection (spec 0014 §5)', () {
    const rioCity = FilterOption(
      id: 3304557,
      label: 'Rio de Janeiro',
      parentIds: [33],
    );
    const niteroi = FilterOption(
      id: 3303302,
      label: 'Niterói',
      parentIds: [33],
    );
    const saoPaulo = FilterOption(
      id: 3550308,
      label: 'São Paulo',
      parentIds: [35],
    );

    test('picking a city selects its state', () {
      final result = cascadeSelection(
        parentIds: const [],
        childIds: const [3304557],
        children: const [rioCity, niteroi, saoPaulo],
        childChanged: true,
      );

      expect(result.parentIds, [33]);
      expect(result.childIds, [3304557]);
    });

    test('clearing a state drops the cities inside it', () {
      final result = cascadeSelection(
        parentIds: const [],
        childIds: const [3304557, 3550308],
        children: const [rioCity, niteroi, saoPaulo],
        childChanged: false,
      );

      expect(result.childIds, isEmpty);
    });

    test('keeps cities of the states that are still selected', () {
      final result = cascadeSelection(
        parentIds: const [35],
        childIds: const [3304557, 3550308],
        children: const [rioCity, niteroi, saoPaulo],
        childChanged: false,
      );

      expect(result.childIds, [3550308]);
    });

    test('a rep under two managers survives losing one of them', () {
      // Spec 0009 allows a rep to hold patches under two managers, so dropping
      // them because one manager was cleared would remove clinics the other
      // manager still owns.
      const rep = FilterOption(id: 7, label: 'Ana', parentIds: [2, 3]);
      final result = cascadeSelection(
        parentIds: const [3],
        childIds: const [7],
        children: const [rep],
        childChanged: false,
      );

      expect(result.childIds, [7]);
    });

    test('a child of unknown parentage is kept, never silently dropped', () {
      // The option lists are already narrowed, so a municipality whose state
      // was filtered out is simply absent from them. Dropping it would clear a
      // filter the user can no longer see to put back.
      final result = cascadeSelection(
        parentIds: const [35],
        childIds: const [9999999],
        children: const [rioCity],
        childChanged: false,
      );

      expect(result.childIds, [9999999]);
    });

    test('picking a rep selects every manager they report to', () {
      const rep = FilterOption(id: 7, label: 'Ana', parentIds: [2, 3]);
      final result = cascadeSelection(
        parentIds: const [],
        childIds: const [7],
        children: const [rep],
        childChanged: true,
      );

      expect(result.parentIds..sort(), [2, 3]);
    });
  });

  group('metric parsing', () {
    test('a null percent stays null — never 0', () {
      final metric = DashboardRatioMetric.coverageFromJson({
        'covered': 0,
        'denominator': 0,
        'percent': null,
      });

      expect(metric.percent, isNull);
      expect(metric.denominator, 0);
    });

    test('numeric strings from the API decode as numbers', () {
      // Postgres `numeric` reaches the client as a string, not a JSON number.
      final metric = DashboardRatioMetric.coverageFromJson({
        'covered': 3,
        'denominator': 10,
        'percent': '0.42500000',
      });

      expect(metric.percent, closeTo(0.425, 1e-9));
    });

    test('a member with no calculable metric decodes as null, not 0', () {
      final member = TeamMember.fromJson({
        'userId': 5,
        'email': 'ana@example.com',
        'roleName': 'REP',
        'territories': [],
        'assignedClinicCount': 12,
        'metricValue': null,
      });

      expect(member.metricValue, isNull);
      expect(member.assignedClinicCount, 12);
    });
  });

  group('DashboardClinicPage position', () {
    DashboardClinicPage pageOf({required int page, required int rows}) {
      return DashboardClinicPage.fromJson({
        // Explorar's clinic payload — the breakdown returns the same rows the
        // Explorar list does, so they decode through the same DTO.
        'data': [
          for (var i = 0; i < rows; i++)
            {'id': i + 1, 'name': 'Clínica ${i + 1}', 'city': 'Niterói'},
        ],
        'total': 146,
        'page': page,
        'limit': 25,
      });
    }

    test('reports where the page sits, not how long it is', () {
      // The pager printed `data.length`, which is 25 on every full page — so
      // "25 de 146" was the label on page one, page two and page five alike.
      final first = pageOf(page: 1, rows: 25);
      final second = pageOf(page: 2, rows: 25);

      expect('${first.firstRowNumber}–${first.lastRowNumber}', '1–25');
      expect('${second.firstRowNumber}–${second.lastRowNumber}', '26–50');
    });

    test('the short last page ends on the total', () {
      final last = pageOf(page: 6, rows: 21);

      expect(last.firstRowNumber, 126);
      expect(last.lastRowNumber, 146);
      expect(last.hasMore, isFalse);
    });

    test('an empty page counts from zero rather than claiming a row', () {
      final empty = pageOf(page: 1, rows: 0);

      expect(empty.firstRowNumber, 0);
      expect(empty.lastRowNumber, 0);
    });
  });

  group('dashboardScopeArgsProvider', () {
    /// Regression: the subject used to live in a global `StateProvider` that
    /// the pushed subject screen wrote to on mount and nothing reset on pop.
    /// A manager who looked at a rep's Desempenho and went back kept seeing
    /// that rep's numbers on their own tab, under the heading "Desempenho".
    test('one viewer and one subject do not share a scope', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      container.read(dashboardSelectedVerticalIdProvider.notifier).state = 1;

      expect(
        container
            .read(dashboardScopeArgsProvider(const DashboardSubjectKey()))!
            .subjectUserId,
        isNull,
      );
      expect(
        container
            .read(
              dashboardScopeArgsProvider(
                const DashboardSubjectKey(subjectUserId: 7),
              ),
            )!
            .subjectUserId,
        7,
      );
      // Reading the subject's scope must not have changed the viewer's own.
      expect(
        container
            .read(dashboardScopeArgsProvider(const DashboardSubjectKey()))!
            .subjectUserId,
        isNull,
      );
    });

    test('the same rep through two managers is two populations', () {
      // Spec 0015 R2: an admin can reach one rep from either manager's team,
      // and each shows only that manager's share. Sharing a cache entry would
      // make the second read answer with the first manager's numbers.
      final container = ProviderContainer();
      addTearDown(container.dispose);
      container.read(dashboardSelectedVerticalIdProvider.notifier).state = 1;

      final viaOne = container.read(
        dashboardScopeArgsProvider(
          const DashboardSubjectKey(subjectUserId: 5, withinManagerId: 2),
        ),
      )!;
      final viaTwo = container.read(
        dashboardScopeArgsProvider(
          const DashboardSubjectKey(subjectUserId: 5, withinManagerId: 3),
        ),
      )!;

      expect(viaOne.withinManagerId, 2);
      expect(viaTwo.withinManagerId, 3);
      expect(viaOne == viaTwo, isFalse);
      expect(viaOne.toQuery()['withinManagerId'], '2');
    });

    test('clearing filters keeps which share of a person is on screen', () {
      // "Limpar filtros" must not widen the population. The manager context is
      // structural, not a filter chip.
      const args = DashboardScopeArgs(
        verticalId: 1,
        subjectUserId: 5,
        withinManagerId: 2,
        stateIds: [35],
      );

      final cleared = args.cleared();
      expect(cleared.withinManagerId, 2);
      expect(cleared.subjectUserId, 5);
      expect(cleared.stateIds, isEmpty);
    });

    test('no linha, no scope — a metric has no correct answer yet', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect(
        container.read(dashboardScopeArgsProvider(const DashboardSubjectKey())),
        isNull,
      );
    });
  });
}
