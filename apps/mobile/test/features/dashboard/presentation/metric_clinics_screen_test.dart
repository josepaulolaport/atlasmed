import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/metric_clinics_screen.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _LoadedPage extends Repository<DashboardClinicPage> {
  _LoadedPage(this.page)
    : super(
        name: 'FakeClinicsRepository',
        endpoint: Uri.parse('http://localhost/clinics'),
        resolveOnCreate: false,
      ) {
    emit(data: page);
  }

  final DashboardClinicPage page;

  @override
  Future<DashboardClinicPage?> currentValueOrResolve() async {
    await emit(data: page);
    return page;
  }
}

const _page = DashboardClinicPage(
  data: [
    DashboardClinicRow(
      facilityId: 1,
      name: 'Clínica Santa Rita',
      purchaseFunnelStage: 'PURCHASE_WINDOW',
      conformityStatus: 'UNREGISTERED',
      city: 'Niterói',
      state: 'RJ',
      repName: 'Flavio Ramalho',
    ),
  ],
  total: 1,
  page: 1,
  limit: 25,
);

Future<void> _pump(WidgetTester tester, {int? manageForUserId}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        dashboardSelectedVerticalIdProvider.overrideWith((ref) => 1),
        metricClinicsProvider.overrideWith((ref, args) => _LoadedPage(_page)),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: MetricClinicsScreen(
          metric: 'assigned-clinics',
          scope: const DashboardScopeArgs(verticalId: 1),
          manageForUserId: manageForUserId,
          manageForName: manageForUserId == null ? null : 'Flavio Ramalho',
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('a metric breakdown is read-only', (tester) async {
    // A breakdown of "cobertura" is a population, not somebody's caseload.
    // Desassociar there would beg the question of whom you were unassigning.
    await _pump(tester);

    expect(find.byType(PopupMenuButton<String>), findsNothing);
    expect(find.byIcon(Icons.chevron_right_rounded), findsOneWidget);
  });

  testWidgets("a rep's own list can hand a clinic back", (tester) async {
    await _pump(tester, manageForUserId: 5);

    expect(find.byType(PopupMenuButton<String>), findsOneWidget);
    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();

    expect(find.text('Ver clínica'), findsOneWidget);
    expect(find.text('Desassociar de Flavio Ramalho'), findsOneWidget);
  });

  testWidgets('rows carry the Explorar shape, not a bare ListTile', (
    tester,
  ) async {
    // Two lists of clinics in one app should not look like they came from
    // different products.
    await _pump(tester);

    expect(find.byType(ListTile), findsNothing);
    expect(find.text('Clínica Santa Rita'), findsOneWidget);
    expect(find.text('Niterói · RJ'), findsOneWidget);
    expect(find.text('Flavio Ramalho'), findsOneWidget);
  });
}
