import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/metric_clinics_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
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

/// Explorar's payload, because that is what the breakdown now returns.
FacilityEntry clinic({
  int id = 1,
  String name = 'Clínica Santa Rita',
  int doctorCount = 3,
}) {
  return FacilityEntry(
    id: id,
    name: name,
    city: 'Niterói',
    neighborhood: 'Icaraí',
    doctorCount: doctorCount,
  );
}

final _page = DashboardClinicPage(
  data: [clinic()],
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
    // Nothing trails the row at all — Explorar's row carries no chevron, and
    // the breakdown's only trailing control is the ⋯ menu above.
    expect(tester.widget<ClinicRow>(find.byType(ClinicRow)).trailing, isNull);
  });

  testWidgets("a rep's own list can hand a clinic back", (tester) async {
    await _pump(tester, manageForUserId: 5);

    expect(find.byType(PopupMenuButton<String>), findsOneWidget);
    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();

    expect(find.text('Ver clínica'), findsOneWidget);
    expect(find.text('Desassociar de Flavio Ramalho'), findsOneWidget);
  });

  testWidgets('rows are Explorar’s row, not a copy of it', (tester) async {
    // The screen used to re-implement ClinicRow privately and drift from it:
    // same tile and title, none of the médicos count or foco clínico beside
    // them. Asserting on the widget, not on a resemblance.
    await _pump(tester);

    expect(find.byType(ClinicRow), findsOneWidget);
    expect(find.byType(ListTile), findsNothing);
    expect(find.text('Clínica Santa Rita'), findsOneWidget);
    expect(find.text('Icaraí · Niterói'), findsOneWidget);
    // Carried by the real row and absent from the copy.
    expect(find.text('3 médicos'), findsOneWidget);
  });

  group('paging', () {
    /// 25 rows a page over 60 clinics, named by their absolute position so a
    /// row identifies the page it came from.
    DashboardClinicPage pageAt(int page) {
      const limit = 25;
      final first = (page - 1) * limit + 1;
      final count = first + limit - 1 > 60 ? 60 - first + 1 : limit;
      return DashboardClinicPage(
        data: [
          for (var i = 0; i < count; i++)
            clinic(id: first + i, name: 'Clínica ${first + i}'),
        ],
        total: 60,
        page: page,
        limit: limit,
      );
    }

    Future<void> pumpPaged(WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            dashboardSelectedVerticalIdProvider.overrideWith((ref) => 1),
            metricClinicsProvider.overrideWith(
              (ref, args) => _LoadedPage(pageAt(args.page)),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const MetricClinicsScreen(
              metric: 'assigned-clinics',
              scope: DashboardScopeArgs(verticalId: 1),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('says where in the whole set this page sits', (tester) async {
      await pumpPaged(tester);
      // The pager lives below 25 rows, and the list builds lazily — it is not
      // in the tree until scrolled to.
      await tester.scrollUntilVisible(
        find.text('Próxima'),
        400,
        scrollable: find.byType(Scrollable).first,
      );

      // Not "25 de 60", which was the label on every page alike.
      expect(find.text('1–25 de 60'), findsOneWidget);
    });

    testWidgets('a new page starts at its first row, not where you were', (
      tester,
    ) async {
      await pumpPaged(tester);
      final list = find.byType(Scrollable).first;

      // Reach the pager, which lives below 25 rows.
      await tester.scrollUntilVisible(
        find.text('Próxima'),
        400,
        scrollable: list,
      );
      final offsetAtPager = tester.widget<Scrollable>(list).controller!.offset;
      expect(offsetAtPager, greaterThan(0), reason: 'the pager is off-screen');

      await tester.tap(find.text('Próxima'));
      await tester.pumpAndSettle();

      // The defect: the offset survived the page change, so the first sixteen
      // rows of every page after the first were never on screen.
      expect(tester.widget<Scrollable>(list).controller!.offset, 0);
      expect(find.text('Clínica 26'), findsOneWidget);

      await tester.scrollUntilVisible(
        find.text('Próxima'),
        400,
        scrollable: list,
      );
      expect(find.text('26–50 de 60'), findsOneWidget);
    });

    testWidgets('the last page ends on the total and offers no next', (
      tester,
    ) async {
      await pumpPaged(tester);
      final list = find.byType(Scrollable).first;

      for (final _ in [1, 2]) {
        await tester.scrollUntilVisible(
          find.text('Próxima'),
          400,
          scrollable: list,
        );
        await tester.tap(find.text('Próxima'));
        await tester.pumpAndSettle();
      }

      await tester.scrollUntilVisible(
        find.text('Próxima'),
        400,
        scrollable: list,
      );

      expect(find.text('51–60 de 60'), findsOneWidget);
      final next = tester.widget<TextButton>(
        find.ancestor(
          of: find.text('Próxima'),
          matching: find.byType(TextButton),
        ),
      );
      expect(next.onPressed, isNull);
    });
  });
}
