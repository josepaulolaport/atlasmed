import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_empty_state.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_list_row.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// The rules the Administração panel's list rows encode.
///
/// Each of these was a real inconsistency across the panel's six lists before
/// they shared one row, so they are asserted rather than left to review.
void main() {
  Widget host(Widget child) => MaterialApp(
    home: Scaffold(body: ListView(children: [child])),
  );

  group('CatalogListRow', () {
    testWidgets('draws a chevron when it can be tapped', (tester) async {
      await tester.pumpWidget(
        host(CatalogListRow(title: 'Unimed', onTap: () {})),
      );

      expect(find.byIcon(Icons.chevron_right_rounded), findsOneWidget);
    });

    testWidgets('drops the chevron when it cannot', (tester) async {
      // A row that looks tappable and is not is worse than one that looks flat.
      await tester.pumpWidget(host(const CatalogListRow(title: 'Unimed')));

      expect(find.byIcon(Icons.chevron_right_rounded), findsNothing);
    });

    testWidgets('keeps the chevron on an inactive row', (tester) async {
      // Catálogos used to swap the chevron for the badge, which left exactly
      // the rows an admin most wants to reactivate looking untappable.
      await tester.pumpWidget(
        host(CatalogListRow(title: 'Unimed', isActive: false, onTap: () {})),
      );

      expect(find.byType(InactiveBadge), findsOneWidget);
      expect(find.byIcon(Icons.chevron_right_rounded), findsOneWidget);
    });

    testWidgets('shows a warning and a note as different things', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(
          CatalogListRow(
            title: 'BIOVISC',
            warning: 'Sem produto equivalente',
            note: 'Pede validade',
            onTap: () {},
          ),
        ),
      );

      final warning = tester.widget<Text>(find.text('Sem produto equivalente'));
      final note = tester.widget<Text>(find.text('Pede validade'));
      // One means something is missing, the other is informational; they must
      // not arrive in the same colour.
      expect(warning.style!.color, isNot(note.style!.color));
    });
  });

  group('CatalogEmptyState', () {
    testWidgets(
      'the no-results variant echoes the query and offers a way out',
      (tester) async {
        var cleared = false;
        await tester.pumpWidget(
          host(
            CatalogEmptyState.noResults(
              query: 'cardio',
              onClear: () => cleared = true,
            ),
          ),
        );

        expect(find.textContaining('cardio'), findsOneWidget);
        await tester.tap(find.text('Limpar busca'));
        expect(cleared, isTrue);
      },
    );

    testWidgets('the nothing-yet variant has no clear action', (tester) async {
      await tester.pumpWidget(
        host(
          const CatalogEmptyState(
            icon: Icons.list_alt_rounded,
            title: 'Nenhum registro ainda',
            subtitle: 'Toque em “Nova especialidade”.',
          ),
        ),
      );

      // Nothing to clear when nothing was searched — offering it implies the
      // list is filtered when it is simply empty.
      expect(find.byType(TextButton), findsNothing);
      expect(find.text('Nenhum registro ainda'), findsOneWidget);
    });
  });
}
