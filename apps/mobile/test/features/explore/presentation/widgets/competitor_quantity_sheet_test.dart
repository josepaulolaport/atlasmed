import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/competitor_product.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/facility_potential.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_potential_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/competitor_quantity_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Removing a competitor usage (spec 0013 §6).
///
/// The product picker is locked while editing — a different product is a
/// different row — so removal is the only correction available to a rep who
/// recorded the wrong product. A quantity of 0 is not a substitute: it says the
/// clinic uses none of it, which is a claim, not the absence of one.
class _FakeCatalogRepository extends CatalogRepository {
  @override
  Future<List<CompetitorProduct>> getAllCompetitorProducts() async => [
    CompetitorProduct(
      id: 9,
      name: 'Concorrente A',
      manufacturer: 'Fabricante',
      countryOfOrigin: 'BR',
      price17: 0,
      price18: 0,
      price20: 0,
      brasindiceUpdatedAt: DateTime.utc(2026, 3, 1),
    ),
  ];
}

class _RecordingPotentialRepository extends FacilityPotentialRepository {
  _RecordingPotentialRepository() : super(facilityId: 1, verticalId: 7);

  ({int definitionId, int productId})? removed;
  Object? failure;

  static const emptyPage = FacilityPotentialsPage(verticalId: 7, items: []);

  @override
  Future<FacilityPotentialsPage> removeCompetitor({
    required int definitionId,
    required int productId,
  }) async {
    if (failure != null) throw failure!;
    removed = (definitionId: definitionId, productId: productId);
    return emptyPage;
  }
}

void main() {
  // Constructing any repository lazily builds the SessionEnvironment singleton,
  // which starts a periodic refresh timer. Same reset as the other repository-
  // backed widget tests, so the timer is not charged to whichever test happens
  // to run first.
  setUpAll(() {
    // ignore: invalid_use_of_protected_member
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

  final usage = CompetitorUsage(
    productId: 9,
    productName: 'Concorrente A',
    quantity: 12,
    metricQuantity: 12,
    updatedAt: DateTime.utc(2026, 3, 10),
  );

  /// Opens the sheet the way the section does; the returned future completes
  /// with whatever the sheet popped.
  Future<Future<FacilityPotentialsPage?>> openSheet(
    WidgetTester tester, {
    required FacilityPotentialRepository repository,
    CompetitorUsage? existing,
  }) async {
    late BuildContext hostContext;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) {
              hostContext = context;
              return const SizedBox.shrink();
            },
          ),
        ),
      ),
    );

    // The real repository starts a background hydration timer in its
    // constructor; without this the binding reports a pending timer after the
    // tree is torn down.
    addTearDown(repository.dispose);

    final popped = showModalBottomSheet<FacilityPotentialsPage>(
      context: hostContext,
      builder: (_) => CompetitorQuantitySheet(
        definitionLabel: 'Ampolas por mês',
        definitionId: 3,
        repository: repository,
        existing: existing,
        catalogRepository: _FakeCatalogRepository(),
      ),
    );
    await tester.pumpAndSettle();
    return popped;
  }

  Future<void> dismiss(WidgetTester tester, Future<void> popped) async {
    Navigator.of(tester.element(find.byType(CompetitorQuantitySheet))).pop();
    await tester.pumpAndSettle();
    await popped;
  }

  testWidgets('a new row offers no removal — there is nothing to remove', (
    tester,
  ) async {
    final repository = _RecordingPotentialRepository();
    final showing = await openSheet(tester, repository: repository);

    expect(find.byKey(const Key('competitor-quantity-remove')), findsNothing);

    await dismiss(tester, showing);
  });

  testWidgets('removing an existing row confirms, then clears the month', (
    tester,
  ) async {
    final repository = _RecordingPotentialRepository();
    final showing = await openSheet(
      tester,
      repository: repository,
      existing: usage,
    );

    await tester.tap(find.byKey(const Key('competitor-quantity-remove')));
    await tester.pumpAndSettle();

    // Destructive and irreversible for that month, so it asks first, and names
    // what survives.
    expect(find.text('Remover concorrente?'), findsOneWidget);
    expect(find.textContaining('Concorrente A'), findsWidgets);
    expect(find.textContaining('meses anteriores'), findsOneWidget);

    await tester.tap(find.widgetWithText(TextButton, 'Remover'));
    await tester.pumpAndSettle();

    expect(repository.removed, isNotNull);
    expect(repository.removed!.definitionId, 3);
    expect(repository.removed!.productId, 9);
    // The sheet hands the recomputed page back, exactly as saving does, so the
    // section refreshes from one answer rather than two.
    expect(await showing, isNotNull);
    expect(find.byType(CompetitorQuantitySheet), findsNothing);
  });

  testWidgets('declining the confirmation removes nothing', (tester) async {
    final repository = _RecordingPotentialRepository();
    final showing = await openSheet(
      tester,
      repository: repository,
      existing: usage,
    );

    await tester.tap(find.byKey(const Key('competitor-quantity-remove')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Cancelar'));
    await tester.pumpAndSettle();

    expect(repository.removed, isNull);
    expect(find.byType(CompetitorQuantitySheet), findsOneWidget);

    await dismiss(tester, showing);
  });

  testWidgets('a failed removal is stated, not swallowed', (tester) async {
    final repository = _RecordingPotentialRepository()
      ..failure = const FacilityPotentialException(
        'Falha ao remover o concorrente (500)',
      );
    final showing = await openSheet(
      tester,
      repository: repository,
      existing: usage,
    );

    await tester.tap(find.byKey(const Key('competitor-quantity-remove')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Remover'));
    await tester.pumpAndSettle();

    // Still open, with the reason on screen — a dismissed sheet would read as
    // success.
    expect(find.byType(CompetitorQuantitySheet), findsOneWidget);
    expect(find.text('Falha ao remover o concorrente (500)'), findsOneWidget);

    await dismiss(tester, showing);
  });
}
