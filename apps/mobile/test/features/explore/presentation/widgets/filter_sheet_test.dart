import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/filter_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('applies single commercial status filter', (tester) async {
    Map<String, List<String>>? appliedFilters;
    double? appliedRadius;

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: FilterSheet(
              kind: 'clinic',
              filters: const {},
              radiusKm: null,
              onApply: (filters, radiusKm) {
                appliedFilters = filters;
                appliedRadius = radiusKm;
              },
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();
    await tester.tap(find.text('Operante'));
    await tester.pump();
    await tester.tap(find.text('Aplicar (1)'));
    await tester.pump();

    expect(appliedFilters, {
      'status': ['REGISTERED'],
    });
    expect(appliedRadius, isNull);
  });

  testWidgets('hides status and funnel when drill-down flags set', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: FilterSheet(
              kind: 'clinic',
              filters: const {},
              radiusKm: null,
              hideCommercialStatus: true,
              hidePurchaseFunnel: true,
              onApply: (_, _) {},
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('STATUS'), findsNothing);
    expect(find.text('RECORRÊNCIA DE COMPRAS'), findsNothing);
    expect(find.text('PERFIL DE COMPRA'), findsOneWidget);
    expect(find.text('Automático'), findsOneWidget);
  });

  testWidgets('radius chip is clearable on second tap before apply', (
    tester,
  ) async {
    double? appliedRadius = -1;

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: FilterSheet(
              kind: 'clinic',
              filters: const {},
              radiusKm: null,
              onApply: (filters, radiusKm) {
                appliedRadius = radiusKm;
              },
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();
    await tester.tap(find.text('25 km'));
    await tester.pump();
    await tester.tap(find.text('25 km'));
    await tester.pump();
    await tester.tap(find.text('Aplicar'));
    await tester.pump();

    expect(appliedRadius, isNull);
  });
}
