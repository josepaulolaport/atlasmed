import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_form_fields.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Closing a form must not silently discard what was typed into it.
///
/// Five screens elsewhere in the app already guard this; none of the panel's
/// five did, and the product form is the longest in the app.
void main() {
  Future<void> openForm(WidgetTester tester, {required bool hasChanges}) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    fullscreenDialog: true,
                    builder: (_) => CatalogUnsavedGuard(
                      hasChanges: hasChanges,
                      child: const Scaffold(
                        appBar: CatalogFormAppBar(title: 'Editar produto'),
                        body: Center(child: Text('form')),
                      ),
                    ),
                  ),
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('form'), findsOneWidget);
  }

  testWidgets('an untouched form closes without asking', (tester) async {
    await openForm(tester, hasChanges: false);

    await tester.tap(find.byType(CloseButton));
    await tester.pumpAndSettle();

    expect(find.text('form'), findsNothing);
  });

  testWidgets('an edited form asks before discarding', (tester) async {
    await openForm(tester, hasChanges: true);

    await tester.tap(find.byType(CloseButton));
    await tester.pumpAndSettle();

    expect(find.text('Descartar alterações?'), findsOneWidget);
    // Still open behind the dialog — nothing was lost yet.
    expect(find.text('form'), findsOneWidget);

    await tester.tap(find.text('Continuar editando'));
    await tester.pumpAndSettle();
    expect(find.text('form'), findsOneWidget);
  });

  testWidgets('discarding closes the form', (tester) async {
    await openForm(tester, hasChanges: true);

    await tester.tap(find.byType(CloseButton));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Descartar'));
    await tester.pumpAndSettle();

    expect(find.text('form'), findsNothing);
  });
}
