import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/filter_drawer.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// The filter drawer's layout while a selection is being built.
///
/// "Limpar" used to be rendered only once something was selected, so the first
/// tick inserted a button into the header and pushed every row below it down by
/// that button's height. The option under the finger moved, and a second quick
/// tap landed on its neighbour.

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

    expect(
      after.dy,
      before.dy,
      reason: 'the header must not grow on selection',
    );
  });

  testWidgets('Limpar holds its space but does nothing while empty', (
    tester,
  ) async {
    await pumpDrawer(tester);

    // Present in the tree from the start — that is what keeps the layout still.
    expect(find.text('Limpar'), findsOneWidget);

    // ...and invisible until there is something to clear.
    final visibility = tester.widget<Visibility>(
      find.ancestor(of: find.text('Limpar'), matching: find.byType(Visibility)),
    );
    expect(visibility.visible, isFalse);
    expect(visibility.maintainSize, isTrue);
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
