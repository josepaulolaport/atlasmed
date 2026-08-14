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

  testWidgets('picks unit types through the drawer, like especialidades', (
    tester,
  ) async {
    // Chips before: twelve CNES names such as "Unidade De Apoio Diagnose E
    // Terapia (sadt Isolado)" wrapped into a wall that pushed the rest of the
    // sheet off screen. It is a drawer now, the same one Especialidade opens.
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

    // The sheet shows a row, not the catalogue.
    expect(find.text('Escolher tipos de unidade'), findsOneWidget);
    expect(find.text('Hospital Geral'), findsNothing);

    await tapOption(tester, 'Escolher tipos de unidade');
    await tester.pumpAndSettle();

    // Drawer chrome speaks about unit types, not specialties.
    expect(find.text('Tipo de unidade'), findsOneWidget);
    await tester.tap(find.text('Clinica/Centro De Especialidade'));
    await tester.pump();
    await tester.tap(find.text('Hospital Geral'));
    await tester.pump();
    await tester.tap(find.text('Aplicar (2)'));
    await tester.pumpAndSettle();

    // Back on the sheet, the row counts what was chosen.
    expect(find.text('2 selecionados'), findsOneWidget);

    await tapOption(tester, 'Pessoa jurídica (CNPJ)');
    await tester.tap(find.text('Aplicar (3)'));
    await tester.pump();

    expect(applied?['unitTypeIds'], ['3', '7']);
    expect(applied?['legalDocumentType'], ['CNPJ']);
  });

  testWidgets('the drawer can search a long catalogue', (tester) async {
    // The reason for the drawer: finding one of twelve long names.
    await tester.pumpWidget(
      ProviderScope(
        overrides: stubUnitTypesOverrides(),
        child: MaterialApp(
          home: Scaffold(
            body: FilterSheet(
              kind: 'clinic',
              filters: const {},
              radiusKm: null,
              onApply: (_, _) {},
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tapOption(tester, 'Escolher tipos de unidade');
    await tester.pumpAndSettle();

    // By hint, not `.first`: the sheet's own "Mínimo"/"Máximo" interval fields
    // come earlier in the tree, and typing into one of those would filter
    // nothing and still pass a laxer assertion.
    final search = find.byWidgetPredicate(
      (w) =>
          w is TextField && w.decoration?.hintText == 'Buscar tipo de unidade…',
    );
    expect(search, findsOneWidget);
    await tester.enterText(search, 'hospital');
    await tester.pumpAndSettle();

    expect(find.text('Hospital Geral'), findsOneWidget);
    expect(find.text('Clinica/Centro De Especialidade'), findsNothing);
  });

  testWidgets('the purchase buckets use the compact chip', (tester) async {
    /**
     * Font-independent, deliberately.
     *
     * The obvious test — "all three chips share a dy" — cannot work: widget
     * tests render in Ahem, where every glyph is a square, so "Nunca
     * compraram" measures 184pt against roughly 90pt in the real font. That
     * test failed while the real layout was fine, and satisfying it would have
     * meant shrinking the UI to fit a font nobody sees.
     *
     * So this pins the styling that makes one line possible, and whether it
     * actually fits is a question for a screenshot.
     */
    await tester.pumpWidget(
      ProviderScope(
        overrides: stubUnitTypesOverrides(),
        child: MaterialApp(
          home: Scaffold(
            body: FilterSheet(
              kind: 'clinic',
              filters: const {},
              radiusKm: null,
              onApply: (_, _) {},
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    double fontOf(String label) =>
        tester.widget<Text>(find.text(label)).style!.fontSize!;

    // Compact, against the 13pt used by Situação cadastral beneath it.
    expect(fontOf('Nunca compraram'), 12);
    expect(fontOf('Operante'), 13);
  });

  testWidgets('Situação cadastral comes after Status de compras', (
    tester,
  ) async {
    // Order matters to the rep: the buckets they filter by most often are at
    // the top, and Natureza jurídica sits directly under them.
    await tester.pumpWidget(
      ProviderScope(
        overrides: stubUnitTypesOverrides(),
        child: MaterialApp(
          home: Scaffold(
            body: FilterSheet(
              kind: 'clinic',
              filters: const {},
              radiusKm: null,
              onApply: (_, _) {},
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    double top(String label) => tester.getTopLeft(find.text(label)).dy;

    // Renamed from the bare "STATUS", which said nothing about which status.
    expect(find.text('SITUAÇÃO CADASTRAL'), findsOneWidget);
    expect(find.text('STATUS'), findsNothing);

    expect(top('STATUS DE COMPRAS'), lessThan(top('NATUREZA JURÍDICA')));
    expect(top('NATUREZA JURÍDICA'), lessThan(top('ESPECIALIDADE')));
    expect(top('ESPECIALIDADE'), lessThan(top('SITUAÇÃO CADASTRAL')));
    expect(top('SITUAÇÃO CADASTRAL'), lessThan(top('PERFIL DE COMPRA')));
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
