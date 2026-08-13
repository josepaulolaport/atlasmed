import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/filter_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/stub_unit_types_repository.dart';

/// The sheet is taller than the 800x600 test surface, so options below the
/// fold must be scrolled to before they can be tapped.
Future<void> tapOption(WidgetTester tester, String label) async {
  final finder = find.text(label);
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pump();
}

void main() {
  setUpAll(() {
    // The unit types repository reaches SessionEnvironment, whose 8-minute
    // periodic timer would otherwise keep pumpAndSettle from ever settling.
    // ignore: invalid_use_of_protected_member — test-only timer reset.
    SessionEnvironment.instance.timer?.cancel();
    // ignore: invalid_use_of_protected_member
    SessionEnvironment.instance.timer = null;
  });

  tearDown(() {
    // ignore: invalid_use_of_protected_member
    SessionEnvironment.instance.timer?.cancel();
    // ignore: invalid_use_of_protected_member
    SessionEnvironment.instance.timer = null;
  });

  testWidgets('applies single commercial status filter', (tester) async {
    Map<String, List<String>>? appliedFilters;
    double? appliedRadius;

    await tester.pumpWidget(
      ProviderScope(
        overrides: stubUnitTypesOverrides(),
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
    await tapOption(tester, 'Operante');
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
        overrides: stubUnitTypesOverrides(),
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

  testWidgets('selects several unit types and one legal document type', (
    tester,
  ) async {
    Map<String, List<String>>? applied;

    await tester.pumpWidget(
      ProviderScope(
        overrides: stubUnitTypesOverrides(),
        child: MaterialApp(
          home: Scaffold(
            body: FilterSheet(
              kind: 'clinic',
              filters: const {},
              radiusKm: null,
              onApply: (filters, _) => applied = filters,
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    // Names arrive from CNES in caps; the sheet title-cases them.
    await tapOption(tester, 'Clinica/Centro De Especialidade');
    await tapOption(tester, 'Hospital Geral');
    await tapOption(tester, 'Pessoa jurídica (CNPJ)');

    await tester.tap(find.text('Aplicar (3)'));
    await tester.pump();

    // Unit type is multi-select; legal type is single.
    expect(applied?['unitTypeIds'], ['3', '7']);
    expect(applied?['legalDocumentType'], ['CNPJ']);
  });

  testWidgets('a second legal document type replaces the first', (
    tester,
  ) async {
    Map<String, List<String>>? applied;

    await tester.pumpWidget(
      ProviderScope(
        overrides: stubUnitTypesOverrides(),
        child: MaterialApp(
          home: Scaffold(
            body: FilterSheet(
              kind: 'clinic',
              filters: const {
                'legalDocumentType': ['CNPJ'],
              },
              radiusKm: null,
              onApply: (filters, _) => applied = filters,
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();
    await tapOption(tester, 'Pessoa física (CPF)');
    await tester.tap(find.text('Aplicar (1)'));
    await tester.pump();

    // The API takes one value, so selecting a second must not append.
    expect(applied?['legalDocumentType'], ['CPF']);
  });

  testWidgets('radius chip is clearable on second tap before apply', (
    tester,
  ) async {
    double? appliedRadius = -1;

    await tester.pumpWidget(
      ProviderScope(
        overrides: stubUnitTypesOverrides(),
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
    await tapOption(tester, '25 km');
    await tapOption(tester, '25 km');
    await tester.tap(find.text('Aplicar'));
    await tester.pump();

    expect(appliedRadius, isNull);
  });
}
