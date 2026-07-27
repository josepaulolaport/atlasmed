import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/commercial_status.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/purchase_recurrence_form.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/filter_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/sort_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/purchase_recurrence_save.dart';
import 'package:atlasmed_mobile_app/repository/domain/exceptions/unexpected_status_code_exception.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
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
              clinic: FacilityEntry(
                id: '1',
                name: 'Clínica com nome muito comprido para tela estreita',
                city: 'São Paulo',
                neighborhood: 'Centro',
                distanceKm: 1,
                commercialStatus: CommercialStatusFilter.active,
                doctorCount: 2,
                purchaseRecurrence: const PurchaseRecurrenceSnapshot(
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
              radiusKm: null,
              onApply: (value, _) => applied = value,
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Churn'));
    await tester.tap(find.text('Período de compra'));
    await tester.tap(find.text('Mensal'));
    await tester.tap(find.textContaining('Aplicar'));
    expect(applied?['purchaseFunnelStage'], ['CHURN', 'PURCHASE_WINDOW']);
    expect(applied?['purchaseProfile'], ['MONTHLY']);
  });

  testWidgets('sort sheet hides relevance and distance when unavailable', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () {
                showModalBottomSheet<void>(
                  context: context,
                  backgroundColor: Colors.transparent,
                  builder: (ctx) => SortSheet(
                    kind: 'clinic',
                    sort: 'name-asc',
                    hasSearchQuery: false,
                    hasLocation: false,
                    onApply: (_) {},
                  ),
                );
              },
              child: const Text('Open sort'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open sort'));
    await tester.pumpAndSettle();

    expect(find.text('Relevância'), findsNothing);
    expect(find.text('Mais próximos'), findsNothing);
  });

  testWidgets('sort sheet exposes purchase fields and direction', (
    tester,
  ) async {
    String? applied;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () {
                showModalBottomSheet<void>(
                  context: context,
                  backgroundColor: Colors.transparent,
                  builder: (ctx) => SortSheet(
                    kind: 'clinic',
                    sort: 'name-asc',
                    hasSearchQuery: true,
                    hasLocation: true,
                    onApply: (value) => applied = value,
                  ),
                );
              },
              child: const Text('Open sort'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open sort'));
    await tester.pumpAndSettle();
    expect(find.text('Etapa do funil'), findsOneWidget);
    expect(find.text('Intervalo de compras'), findsOneWidget);
    await tester.tap(find.text('Intervalo de compras'));
    expect(applied, 'purchase-interval-asc');
  });

  testWidgets('unknown profile requires an explicit choice before save', (
    tester,
  ) async {
    var saves = 0;
    const unknown = PurchaseRecurrenceSnapshot(
      intervalDays: 45,
      sampleSize: 2,
      rawProfile: 'FUTURE_PROFILE',
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PurchaseRecurrenceForm(
            initialValue: unknown,
            onSave: (_) async => saves++,
          ),
        ),
      ),
    );

    expect(find.textContaining('não é reconhecido'), findsOneWidget);
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
    expect(saves, 0);
  });

  testWidgets(
    'successful save closes once and reports refresh failure as warning',
    (tester) async {
      var patchCalls = 0;
      var closeCalls = 0;
      var refreshCalls = 0;
      final warnings = <String>[];
      final updated = Object();

      Future<void> save(PurchaseRecurrenceCommand command) async {
        await savePurchaseRecurrence(
          command: command,
          update: (_) async {
            patchCalls++;
            return updated;
          },
          close: () => closeCalls++,
          refreshDetail: () {},
          refreshExplore: (_) async {
            refreshCalls++;
            throw StateError('offline');
          },
          showSynchronizationWarning: warnings.add,
        );
      }

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: PurchaseRecurrenceForm(onSave: save)),
        ),
      );
      await tester.tap(find.text('Salvar'));
      await tester.pumpAndSettle();

      expect(patchCalls, 1);
      expect(closeCalls, 1);
      expect(refreshCalls, 1);
      expect(warnings, [purchaseRecurrenceSynchronizationWarning]);
      expect(
        find.text('Não foi possível salvar. Tente novamente.'),
        findsNothing,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('purchase form maps typed 403 to permission message', (
    tester,
  ) async {
    Future<void> save(PurchaseRecurrenceCommand command) async {
      throw UnexpectedStatusCodeException(
        sent: RepositoryHttpRequest(url: Uri.parse('https://example.test')),
        received: const RepositoryHttpResponse(
          statusCode: 403,
          headers: {},
          body: '{}',
        ),
      );
    }

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: PurchaseRecurrenceForm(onSave: save)),
      ),
    );
    await tester.tap(find.text('Salvar'));
    await tester.pumpAndSettle();

    expect(
      find.text('Você não tem permissão para editar este perfil.'),
      findsOneWidget,
    );
    expect(
      find.text('Não foi possível salvar. Tente novamente.'),
      findsNothing,
    );
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
