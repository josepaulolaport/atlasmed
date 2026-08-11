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

    test('a null mean share stays null, beside the clinics counted', () {
      final metric = DashboardPenetrationMetric.fromJson({
        'denominator': 200,
        'metrics': [
          {
            'definitionId': 1,
            'key': 'ampolas_mes',
            'label': 'Ampolas/mês',
            'meanShare': null,
            'clinicsCounted': 0,
          },
        ],
      });

      expect(metric.denominator, 200);
      expect(metric.metrics.single.meanShare, isNull);
      expect(metric.metrics.single.clinicsCounted, 0);
    });

    test('numeric strings from the API decode as numbers', () {
      final metric = DashboardPenetrationMetric.fromJson({
        'denominator': 10,
        'metrics': [
          {
            'definitionId': 1,
            'key': 'ampolas_mes',
            'label': 'Ampolas/mês',
            'meanShare': '0.42500000',
            'clinicsCounted': 3,
          },
        ],
      });

      expect(metric.metrics.single.meanShare, closeTo(0.425, 1e-9));
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
        container.read(dashboardScopeArgsProvider(null))!.subjectUserId,
        isNull,
      );
      expect(container.read(dashboardScopeArgsProvider(7))!.subjectUserId, 7);
      // Reading the subject's scope must not have changed the viewer's own.
      expect(
        container.read(dashboardScopeArgsProvider(null))!.subjectUserId,
        isNull,
      );
    });

    test('no linha, no scope — a metric has no correct answer yet', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect(container.read(dashboardScopeArgsProvider(null)), isNull);
    });
  });
}
