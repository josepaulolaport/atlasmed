import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
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
        unitTypeId: 4,
        managerId: 2,
        repId: 7,
        stateId: 35,
        municipalityId: 3550308,
      );

      expect(args.toQuery(), {
        'verticalId': '1',
        'subjectUserId': '5',
        'unitTypeId': '4',
        'managerId': '2',
        'repId': '7',
        'stateId': '35',
        'municipalityId': '3550308',
      });
    });

    test('clearing filters keeps the linha and the subject', () {
      const args = DashboardScopeArgs(
        verticalId: 1,
        subjectUserId: 5,
        stateId: 35,
      );
      final cleared = args.cleared();

      expect(cleared.verticalId, 1);
      expect(cleared.subjectUserId, 5);
      expect(cleared.stateId, isNull);
      expect(cleared.hasFilters, isFalse);
    });

    test(
      'equality keys the metric providers, so a filter change refetches',
      () {
        const a = DashboardScopeArgs(verticalId: 1, stateId: 35);
        const b = DashboardScopeArgs(verticalId: 1, stateId: 35);
        const c = DashboardScopeArgs(verticalId: 1, stateId: 41);

        expect(a, b);
        expect(a.hashCode, b.hashCode);
        expect(a, isNot(c));
      },
    );
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
}
