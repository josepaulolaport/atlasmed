import 'dart:async';

import 'package:atlasmed_mobile_app/features/explore/data/models/facility_potential.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_linha_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_potential_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_potential_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Stands in for the real loader so the second load can be held open.
class _StubPotentials extends FacilityPotentials {
  _StubPotentials(this.loads, this.second);

  final List<int> loads;
  final Completer<FacilityPotentialsPage> second;

  @override
  Future<FacilityPotentialsPage> build(FacilityPotentialArgs arg) async {
    loads.add(loads.length + 1);
    if (loads.length == 1) return _page(10);
    return second.future;
  }
}

FacilityPotentialsPage _page(double theirs) => FacilityPotentialsPage(
  verticalId: 7,
  items: [
    FacilityPotentialItem(
      definitionId: 3,
      key: 'ampolas',
      label: 'Ampolas por mês',
      atlasmedMonthlyAvgQty: 30,
      competitorMonthlyQty: theirs,
      totalMarketQty: 30 + theirs,
      share: 30 / (30 + theirs),
      competitors: const [],
      ourProducts: const [],
      noOtherBrands: false,
    ),
  ],
);

/// What the rep sees between saving an edit and the list updating.
///
/// Every write in this section refetches: the sheet pops, the provider is
/// invalidated, and the page is loaded again. That is one extra round trip, and
/// the question this file settles is whether the card the rep is reading
/// survives it or is replaced by a spinner. A card that blinks on every edit is
/// the difference between "saved" and "did something break?".
void main() {
  const args = (facilityId: 1, verticalId: 7);

  testWidgets('the card stays on screen while a save refetches', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    // The second load is held open, which is the window the rep would be
    // staring at over a slow connection.
    final loads = <int>[];
    final second = Completer<FacilityPotentialsPage>();

    final container = ProviderScope(
      overrides: [
        clinicDetailActiveLinhaIdProvider(1).overrideWith((ref) => 7),
        facilityPotentialsProvider.overrideWith(
          () => _StubPotentials(loads, second),
        ),
      ],
      child: const MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: ClinicPotentialSection(facilityId: 1, canEdit: true),
          ),
        ),
      ),
    );

    await tester.pumpWidget(container);
    await tester.pumpAndSettle();
    expect(find.text('Ampolas por mês'), findsOneWidget);

    // Exactly what a save does once the sheet pops.
    final element = tester.element(find.byType(ClinicPotentialSection));
    ProviderScope.containerOf(
      element,
    ).invalidate(facilityPotentialsProvider(args));
    await tester.pump();
    await tester.pump();

    // The refetch is in flight. The rep must still be reading their clinic,
    // not a spinner where the card was.
    expect(loads.length, 2);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('Ampolas por mês'), findsOneWidget);

    second.complete(_page(20));
    await tester.pumpAndSettle();
    expect(find.text('Ampolas por mês'), findsOneWidget);
  });

  testWidgets('a saved page is adopted without a second request', (
    tester,
  ) async {
    // The write already returns the recomputed page. Re-fetching it would ask
    // the same question twice, and leave the rep reading the figure they just
    // replaced for however long the round trip takes.
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final loads = <int>[];
    final never = Completer<FacilityPotentialsPage>();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          clinicDetailActiveLinhaIdProvider(1).overrideWith((ref) => 7),
          facilityPotentialsProvider.overrideWith(
            () => _StubPotentials(loads, never),
          ),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ClinicPotentialSection(facilityId: 1, canEdit: true),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('10'), findsOneWidget);

    // Exactly what a save does with the page the server returned.
    final container = ProviderScope.containerOf(
      tester.element(find.byType(ClinicPotentialSection)),
    );
    container
        .read(
          facilityPotentialsProvider((facilityId: 1, verticalId: 7)).notifier,
        )
        .applyServerPage(_page(20));
    await tester.pumpAndSettle();

    expect(find.text('20'), findsOneWidget);
    // One load, ever. The second completer was never needed.
    expect(loads.length, 1);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });
}
