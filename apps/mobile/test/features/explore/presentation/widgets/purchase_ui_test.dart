import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/commercial_status.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/purchase_recurrence_form.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/purchase_recurrence_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/filter_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/sort_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/purchase_recurrence_save.dart';
import 'package:atlasmed_mobile_app/repository/domain/exceptions/unexpected_status_code_exception.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

ThemeData _testTheme() => ThemeData(
  splashFactory: NoSplash.splashFactory,
  highlightColor: Colors.transparent,
);

void main() {
  testWidgets(
    'purchase section renders the recurrence cycle without narrow-screen overflow',
    (tester) async {
      tester.view.physicalSize = const Size(360, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      var openedHistory = false;
      final today = DateUtils.dateOnly(DateTime.now());

      await tester.pumpWidget(
        MaterialApp(
          theme: _testTheme(),
          home: Scaffold(
            body: SingleChildScrollView(
              child: PurchaseRecurrenceSection(
                value: PurchaseRecurrenceSnapshot(
                  intervalDays: 30,
                  observedIntervalDays: 31,
                  sampleSize: 6,
                  source: PurchaseRecurrenceSource.calculated,
                  funnelStage: PurchaseFunnelStage.purchaseWindow,
                  lastPurchaseDate: today.subtract(const Duration(days: 24)),
                ),
                onViewHistory: () => openedHistory = true,
              ),
            ),
          ),
        ),
      );

      expect(find.text('Ciclo de recompra'), findsNothing);
      expect(find.text('Janela de compra'), findsOneWidget);
      expect(find.text('Última compra'), findsOneWidget);
      expect(find.text('Hoje'), findsOneWidget);
      expect(find.text('Próxima compra'), findsOneWidget);
      expect(find.text('30 dias'), findsOneWidget);
      expect(find.text('Em 6 dias'), findsOneWidget);
      expect(find.text('6 intervalos'), findsOneWidget);
      expect(find.text('Ver histórico de compras'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('Ver histórico de compras'));
      expect(openedHistory, isTrue);
    },
  );

  testWidgets('purchase section orders an overdue prediction before today', (
    tester,
  ) async {
    final today = DateUtils.dateOnly(DateTime.now());
    await tester.pumpWidget(
      MaterialApp(
        theme: _testTheme(),
        home: Scaffold(
          body: PurchaseRecurrenceSection(
            value: PurchaseRecurrenceSnapshot(
              intervalDays: 30,
              observedIntervalDays: 30,
              sampleSize: 4,
              source: PurchaseRecurrenceSource.calculated,
              funnelStage: PurchaseFunnelStage.purchaseWindow,
              lastPurchaseDate: today.subtract(const Duration(days: 40)),
            ),
            onViewHistory: () {},
          ),
        ),
      ),
    );

    expect(find.text('Recompra atrasada'), findsOneWidget);
    expect(find.text('Atraso'), findsOneWidget);
    expect(find.text('10 dias'), findsOneWidget);
    expect(find.text('Compra prevista'), findsOneWidget);
    expect(
      tester.getCenter(find.text('Compra prevista')).dx,
      lessThan(tester.getCenter(find.text('Hoje')).dx),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('never-purchased section keeps the timeline and guides a visit', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      MaterialApp(
        theme: _testTheme(),
        home: Scaffold(
          body: SingleChildScrollView(
            child: PurchaseRecurrenceSection(
              value: const PurchaseRecurrenceSnapshot(
                intervalDays: 30,
                sampleSize: 0,
                source: PurchaseRecurrenceSource.defaultValue,
                funnelStage: PurchaseFunnelStage.neverPurchased,
              ),
              onViewHistory: () {},
            ),
          ),
        ),
      ),
    );

    expect(find.text('Nunca'), findsOneWidget);
    expect(find.text('Agendar visita'), findsNWidgets(2));
    expect(find.text('Sem histórico'), findsOneWidget);
    expect(find.text('Compras registradas'), findsOneWidget);
    expect(find.text('Após a primeira compra'), findsOneWidget);
    expect(find.text('30 dias'), findsNothing);
    expect(find.text('0 intervalos'), findsNothing);
    expect(find.text('Nunca comprou'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('purchase section preserves the unavailable state', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: _testTheme(),
        home: const Scaffold(body: PurchaseRecurrenceSection(value: null)),
      ),
    );

    expect(find.text('Perfil de compras não disponível'), findsOneWidget);
    expect(find.text('Ciclo de recompra'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'clinic row shows stage, interval and never-purchased copy without overflow',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      await tester.pumpWidget(
        MaterialApp(
          theme: _testTheme(),
          home: Scaffold(
            body: ClinicRow(
              clinic: FacilityEntry(
                id: '1',
                name: 'Clínica com nome muito comprido para tela estreita',
                city: 'São Paulo',
                neighborhood: 'Centro',
                distanceKm: 1,
                commercialStatus: CommercialStatusFilter.registered,
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
      // Buy-frequency line intentionally omitted from explore ClinicRow.
      expect(find.text('A cada 30 dias'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('filter sheet applies multiple stages and one profile', (
    tester,
  ) async {
    Map<String, List<String>>? applied;
    await tester.pumpWidget(
      MaterialApp(
        theme: _testTheme(),
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
        theme: _testTheme(),
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
        theme: _testTheme(),
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
        theme: _testTheme(),
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
          theme: _testTheme(),
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
        theme: _testTheme(),
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
          theme: _testTheme(),
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
