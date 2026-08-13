import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/potential_definitions_repository.dart';
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
/// The picker offers the brands that count toward this metric, not the whole
/// catalogue: a product outside that set is filtered out of every read, so
/// offering one would be offering a figure that disappears.
class _FakeDefinitionsRepository extends PotentialDefinitionsRepository {
  _FakeDefinitionsRepository({this.products});

  final List<LinkedPotentialProduct>? products;

  @override
  Future<List<LinkedPotentialProduct>> listCompetitorProducts(
    int definitionId,
  ) async =>
      products ??
      const [
        LinkedPotentialProduct(
          productId: 9,
          definitionId: 3,
          name: 'Marca A',
          code: 'MA-1',
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
    productName: 'Marca A',
    quantity: 12,
    updatedAt: DateTime.utc(2026, 3, 10),
  );

  /// Opens the sheet the way the section does; the returned future completes
  /// with whatever the sheet popped.
  Future<Future<FacilityPotentialsPage?>> openSheet(
    WidgetTester tester, {
    required FacilityPotentialRepository repository,
    CompetitorUsage? existing,
    PotentialDefinitionsRepository? definitionsRepository,
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
        definitionsRepository:
            definitionsRepository ?? _FakeDefinitionsRepository(),
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

  testWidgets('offers the brands that count toward this metric', (
    tester,
  ) async {
    // The bug this replaces: the picker listed every competitor product in the
    // catalogue. A competitor counts toward a metric only when it is the
    // equivalent of one of our products linked to it, and the read derives it
    // that way — so picking any other brand wrote a row that was filtered
    // straight back out. The rep added a brand and the screen redrew unchanged.
    final repository = _RecordingPotentialRepository();
    final showing = await openSheet(tester, repository: repository);

    await tester.tap(find.byKey(const Key('competitor-product-picker')));
    await tester.pumpAndSettle();

    expect(find.text('Marca A'), findsWidgets);

    await tester.tap(find.text('Marca A').last);
    await tester.pumpAndSettle();
    await dismiss(tester, showing);
  });

  testWidgets('says so when no other brand counts toward the metric', (
    tester,
  ) async {
    // An empty picker with no caption reads as a failed load. It is neither —
    // nothing is catalogued yet, and only an admin can change that.
    final repository = _RecordingPotentialRepository();
    final showing = await openSheet(
      tester,
      repository: repository,
      definitionsRepository: _FakeDefinitionsRepository(products: const []),
    );

    expect(find.textContaining('Nenhuma outra marca'), findsOneWidget);

    await dismiss(tester, showing);
  });

  testWidgets('a new row offers no removal — there is nothing to remove', (
    tester,
  ) async {
    final repository = _RecordingPotentialRepository();
    final showing = await openSheet(tester, repository: repository);

    expect(find.byKey(const Key('competitor-quantity-remove')), findsNothing);

    await dismiss(tester, showing);
  });

  testWidgets('removing an existing row confirms, then clears the product', (
    tester,
  ) async {
    final repository = _RecordingPotentialRepository();
    final showing = await openSheet(
      tester,
      repository: repository,
      existing: usage,
    );

    await tester.ensureVisible(
      find.byKey(const Key('competitor-quantity-remove')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('competitor-quantity-remove')));
    await tester.pumpAndSettle();

    // Destructive, so it asks first, names the product, and points at the edit
    // path for the case the rep actually means "they use less now".
    expect(find.text('Remover outra marca?'), findsOneWidget);
    expect(find.textContaining('Marca A'), findsWidgets);
    expect(find.textContaining('edite a quantidade'), findsOneWidget);

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

    await tester.ensureVisible(
      find.byKey(const Key('competitor-quantity-remove')),
    );
    await tester.pumpAndSettle();
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
        'Falha ao remover a marca (500)',
      );
    final showing = await openSheet(
      tester,
      repository: repository,
      existing: usage,
    );

    await tester.ensureVisible(
      find.byKey(const Key('competitor-quantity-remove')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('competitor-quantity-remove')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Remover'));
    await tester.pumpAndSettle();

    // Still open, with the reason on screen — a dismissed sheet would read as
    // success.
    expect(find.byType(CompetitorQuantitySheet), findsOneWidget);
    expect(find.text('Falha ao remover a marca (500)'), findsOneWidget);

    await dismiss(tester, showing);
  });
}
