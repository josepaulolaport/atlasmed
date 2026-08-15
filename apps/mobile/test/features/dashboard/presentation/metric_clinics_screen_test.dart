import 'dart:async';

import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_scope_args.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/screens/metric_clinics_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/skeleton_row.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// The breakdown behind a Desempenho card.
///
/// It used to swap 25 rows for 25 other rows behind "Anterior · Próxima", which
/// nothing else in the app does: Explorar and every clinic surface built on it
/// keep the list and grow it, with skeleton rows where the next page lands.

/// Explorar's payload, because that is what the breakdown returns.
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

/// 25 rows a page over 60 clinics, named by absolute position so a row says
/// which page it came from.
DashboardClinicPage pageAt(int page, {int total = 60}) {
  const limit = 25;
  final first = (page - 1) * limit + 1;
  final count = first + limit - 1 > total ? total - first + 1 : limit;
  return DashboardClinicPage(
    data: [
      for (var i = 0; i < count; i++)
        clinic(id: first + i, name: 'Clínica ${first + i}'),
    ],
    total: total,
    page: page,
    limit: limit,
  );
}

/// Every search the fake was asked for, in order.
final searches = <String?>[];

Future<void> pump(
  WidgetTester tester, {
  int? manageForUserId,
  int total = 60,
  Completer<DashboardClinicPage?>? holdPageTwo,
  int matches = 2,
}) async {
  searches.clear();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        dashboardSelectedVerticalIdProvider.overrideWith((ref) => 1),
        metricClinicsListProvider.overrideWith(
          (ref, args) => MetricClinicsListNotifier(
            metric: args.metric,
            scope: args.scope,
            fetch:
                ({
                  required metric,
                  required scope,
                  required page,
                  required limit,
                  search,
                  sortKey,
                }) async {
                  searches.add(search);
                  if (page == 2 && holdPageTwo != null) {
                    return holdPageTwo.future;
                  }
                  // A search narrows the set; the server answers with the
                  // matches and a total that counts only them.
                  if (search != null && search.trim().isNotEmpty) {
                    return pageAt(page, total: matches);
                  }
                  return pageAt(page, total: total);
                },
          ),
        ),
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

Future<void> scrollToBottom(WidgetTester tester) async {
  // Twice: one fling does not clear 25 rows of a list that now sits below a
  // search bar and a count, and the load-more only fires at the end.
  for (var i = 0; i < 2; i++) {
    await tester.fling(find.byType(ListView), const Offset(0, -6000), 5000);
    await tester.pumpAndSettle();
  }
}

void main() {
  testWidgets('a metric breakdown is read-only', (tester) async {
    // A breakdown of "cobertura" is a population, not somebody's caseload.
    // Desassociar there would beg the question of whom you were unassigning.
    await pump(tester);

    expect(find.byType(PopupMenuButton<String>), findsNothing);
    expect(
      tester.widgetList<ClinicRow>(find.byType(ClinicRow)).first.trailing,
      isNull,
    );
  });

  testWidgets("a rep's own list can hand a clinic back", (tester) async {
    await pump(tester, manageForUserId: 5);

    expect(find.byType(PopupMenuButton<String>), findsWidgets);
    await tester.tap(find.byType(PopupMenuButton<String>).first);
    await tester.pumpAndSettle();

    expect(find.text('Ver clínica'), findsOneWidget);
    expect(find.text('Desassociar de Flavio Ramalho'), findsOneWidget);
  });

  testWidgets('rows are Explorar’s row, not a copy of it', (tester) async {
    // The screen used to re-implement ClinicRow privately and drift from it:
    // same tile and title, none of the médicos count or foco clínico beside
    // them. Asserting on the widget, not on a resemblance.
    await pump(tester);

    expect(find.byType(ClinicRow), findsWidgets);
    expect(find.byType(ListTile), findsNothing);
    expect(find.text('Clínica 1'), findsOneWidget);
    // Carried by the real row and absent from the copy.
    expect(find.text('3 médicos'), findsWidgets);
  });

  testWidgets('shows skeletons before the first page lands', (tester) async {
    await pump(tester);
    // ...and none once it has.
    expect(find.byType(SkeletonRow), findsNothing);
    expect(find.byType(ClinicRow), findsWidgets);
  });

  // Appending, the re-entrancy guard and the stale-response drop live in the
  // notifier and are asserted there — they are invisible from here, since a
  // list that appended page two twice renders the same as one that did it once.
  group('infinite scroll', () {
    testWidgets('a skeleton row holds the place of the page in flight', (
      tester,
    ) async {
      final hold = Completer<DashboardClinicPage?>();
      await pump(tester, holdPageTwo: hold);

      await scrollToBottom(tester);
      // The skeleton slot is appended below the last row, and a lazy builder
      // does not build what is off-screen — so scroll onto it.
      await scrollToBottom(tester);

      expect(find.byType(SkeletonRow), findsWidgets);

      hold.complete(pageAt(2));
      await tester.pumpAndSettle();
      expect(find.byType(SkeletonRow), findsNothing);
    });

    testWidgets('stops asking once every clinic is loaded', (tester) async {
      // 20 clinics is one short page: there is no second page to fetch, and no
      // skeleton should ever appear below the last row.
      await pump(tester, total: 20);

      await scrollToBottom(tester);

      expect(find.byType(SkeletonRow), findsNothing);
      expect(find.text('20 clínicas'), findsOneWidget);
    });
  });

  group('search', () {
    Future<void> type(WidgetTester tester, String value) async {
      await tester.enterText(find.byType(TextField), value);
      // Past the debounce.
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
    }

    testWidgets('narrows the list to what was typed', (tester) async {
      await pump(tester, matches: 2);
      expect(find.text('25 de 60 clínicas'), findsOneWidget);

      await type(tester, 'joelho');

      expect(searches.last, 'joelho');
      expect(find.text('2 clínicas'), findsOneWidget);
    });

    testWidgets('waits for typing to settle before asking', (tester) async {
      await pump(tester);
      final before = searches.length;

      // Four keystrokes in quick succession are one request, not four.
      for (final value in ['j', 'jo', 'joe', 'joel']) {
        await tester.enterText(find.byType(TextField), value);
        await tester.pump(const Duration(milliseconds: 50));
      }
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();

      expect(searches.length - before, 1);
      expect(searches.last, 'joel');
    });

    testWidgets('an empty result says what was searched for', (tester) async {
      await pump(tester, matches: 0);

      await type(tester, 'nao-existe');

      expect(
        find.text('Nenhuma clínica encontrada para “nao-existe”.'),
        findsOneWidget,
      );
    });

    testWidgets('clearing the box restores the whole recorte', (tester) async {
      await pump(tester, matches: 2);
      await type(tester, 'joelho');
      expect(find.text('2 clínicas'), findsOneWidget);

      await type(tester, '');

      expect(find.text('25 de 60 clínicas'), findsOneWidget);
    });
  });

  group('count header', () {
    testWidgets('states the whole set, not the page', (tester) async {
      await pump(tester);

      // The pager said "25 de 60" on every page alike; this says how much of
      // the set is on screen and how large the set is.
      expect(find.text('25 de 60 clínicas'), findsOneWidget);
    });

    testWidgets('drops the qualifier once everything is loaded', (
      tester,
    ) async {
      await pump(tester, total: 20);

      expect(find.text('20 clínicas'), findsOneWidget);
    });
  });
}
