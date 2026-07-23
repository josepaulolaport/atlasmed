import 'package:atlasmed_mobile_app/features/explore/data/models/clinic.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/purchase_recurrence_form.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/filter_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/sort_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'clinic row shows stage, interval and never-purchased copy without overflow',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ClinicRow(
              clinic: const Clinic(
                id: '1',
                name: 'Clínica com nome muito comprido para tela estreita',
                city: 'São Paulo',
                neighborhood: 'Centro',
                distanceKm: 1,
                status: ClinicStatus.active,
                lastVisitDays: null,
                doctorCount: 2,
                isPriority: false,
                products: [],
                purchaseRecurrence: PurchaseRecurrenceSnapshot(
                  intervalDays: 30,
                  sampleSize: 0,
                  funnelStage: PurchaseFunnelStage.neverPurchased,
                ),
              ),
              onTap: () {},
            ),
          ),
        ),
      );
      expect(find.text('Nunca comprou'), findsOneWidget);
      expect(find.text('A cada 30 dias'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('filter sheet applies multiple stages and one profile', (
    tester,
  ) async {
    Map<String, List<String>>? applied;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: FilterSheet(
              kind: 'clinic',
              filters: const {},
              proximityEnabled: false,
              requestingProximity: false,
              onProximityToggle: () {},
              onApply: (value) => applied = value,
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Churn'));
    await tester.tap(find.text('Janela de compra'));
    await tester.tap(find.text('Mensal'));
    await tester.tap(find.textContaining('Aplicar'));
    expect(applied?['purchaseFunnelStage'], ['CHURN', 'PURCHASE_WINDOW']);
    expect(applied?['purchaseProfile'], ['MONTHLY']);
  });

  testWidgets('sort sheet exposes purchase fields and direction', (
    tester,
  ) async {
    String? applied;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SortSheet(
            open: true,
            onClose: () {},
            kind: 'clinic',
            sort: 'name-asc',
            onApply: (value) => applied = value,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Etapa do funil'), findsOneWidget);
    expect(find.text('Intervalo de compras'), findsOneWidget);
    await tester.tap(find.text('Intervalo de compras'));
    expect(applied, 'purchase-interval-asc');
  });

  testWidgets(
    'purchase form validates custom value and preserves it after error',
    (tester) async {
      Future<void> save(PurchaseRecurrenceCommand command) async =>
          throw Exception('offline');
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: PurchaseRecurrenceForm(onSave: save)),
        ),
      );
      await tester.tap(find.text('Personalizado'));
      await tester.pump();
      await tester.enterText(find.byType(TextFormField), '0');
      await tester.tap(find.text('Salvar'));
      await tester.pump();
      expect(find.text('Informe de 1 a 3650 dias'), findsOneWidget);
      await tester.enterText(find.byType(TextFormField), '45');
      await tester.tap(find.text('Salvar'));
      await tester.pumpAndSettle();
      expect(
        find.text('Não foi possível salvar. Tente novamente.'),
        findsOneWidget,
      );
      expect(find.text('45'), findsOneWidget);
    },
  );
}
