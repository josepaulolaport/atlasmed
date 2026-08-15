import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/filter_drawer.dart';
import 'package:atlasmed_mobile_app/shared/widgets/filter_sheet_footer.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// The Desempenho filter drawer.
///
/// "Limpar" used to be a text link in the header, rendered only once something
/// was selected — so the first tick inserted a button above the list and pushed
/// every row down by its height. It now sits in the shared footer beside the
/// button it undoes, which is both where Explorar puts it and where it cannot
/// move anything.

const _options = [
  FilterOption(id: 1, label: 'Acre'),
  FilterOption(id: 2, label: 'Amapá'),
  FilterOption(id: 3, label: 'Rio de Janeiro'),
];

Future<void> pumpDrawer(WidgetTester tester) async {
  await tester.pumpWidget(
    const MaterialApp(
      home: Scaffold(
        body: FilterDrawer(title: 'Estado', options: _options, selectedIds: []),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('the rows do not move when the first option is ticked', (
    tester,
  ) async {
    await pumpDrawer(tester);

    final before = tester.getTopLeft(find.text('Rio de Janeiro'));
    await tester.tap(find.text('Acre'));
    await tester.pumpAndSettle();
    final after = tester.getTopLeft(find.text('Rio de Janeiro'));

    expect(after.dy, before.dy, reason: 'nothing above the list may grow');
  });

  testWidgets('uses the same footer as Explorar rather than its own', (
    tester,
  ) async {
    // Two filter surfaces in one app should not be told apart by their buttons.
    await pumpDrawer(tester);

    expect(find.byType(FilterSheetFooter), findsOneWidget);
    expect(find.text('Limpar'), findsOneWidget);
    expect(find.text('Aplicar'), findsOneWidget);
  });

  testWidgets('the apply button counts what is selected', (tester) async {
    await pumpDrawer(tester);
    expect(find.text('Aplicar'), findsOneWidget);

    await tester.tap(find.text('Acre'));
    await tester.pumpAndSettle();
    expect(find.text('Aplicar (1)'), findsOneWidget);

    await tester.tap(find.text('Rio de Janeiro'));
    await tester.pumpAndSettle();
    expect(find.text('Aplicar (2)'), findsOneWidget);
  });

  testWidgets('Limpar drops the selection it was given', (tester) async {
    await pumpDrawer(tester);

    await tester.tap(find.text('Acre'));
    await tester.pumpAndSettle();
    expect(find.text('Aplicar (1)'), findsOneWidget);

    await tester.tap(find.text('Limpar'));
    await tester.pumpAndSettle();

    expect(find.text('Aplicar'), findsOneWidget);
  });

  testWidgets('Limpar is present but inert while nothing is chosen', (
    tester,
  ) async {
    // Present, so it holds its space; inert, so it cannot claim to have done
    // something. Greyed rather than hidden.
    await pumpDrawer(tester);

    final footer = tester.widget<FilterSheetFooter>(
      find.byType(FilterSheetFooter),
    );
    expect(footer.selectedCount, 0);
    expect(find.text('Limpar'), findsOneWidget);
  });

  testWidgets('the search narrows the list without losing the ticks', (
    tester,
  ) async {
    await pumpDrawer(tester);

    await tester.tap(find.text('Acre'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'rio');
    await tester.pumpAndSettle();

    expect(find.text('Acre'), findsNothing);
    expect(find.text('Rio de Janeiro'), findsOneWidget);
    // Filtered out of view is not deselected.
    expect(find.text('Aplicar (1)'), findsOneWidget);
  });
}
