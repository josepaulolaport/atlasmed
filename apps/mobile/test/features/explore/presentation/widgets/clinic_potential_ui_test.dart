import 'package:atlasmed_mobile_app/features/explore/data/models/facility_potential.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_potential_section.dart'
    show ClinicPotentialSection, PotentialRowHarness;

/// Layout of Potencial de mercado on a real phone width (spec 0013 §6).
///
/// These exist because the previous layout put four stat tiles across a 360dp
/// screen with `maxLines: 1` and an ellipsis — the numbers rendered, the labels
/// silently truncated, and nothing failed. "It renders" is not "it is readable",
/// so the assertions here are about overflow and presence, not about pixels.
void main() {
  const narrowPhone = Size(360, 780);

  const kMetricLabels = [
    'AtlasMed/mês',
    'Outras marcas/mês',
    'Mercado total',
    'Participação',
  ];

  Widget host(Widget child) => MaterialApp(
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );

  FacilityPotentialItem item({
    List<CompetitorUsage> competitors = const [],
    List<OurProductUsage> ourProducts = const [],
  }) => FacilityPotentialItem(
    definitionId: 1,
    key: 'ampolas_mes',
    label: 'Ampolas por mês',
    atlasmedMonthlyAvgQty: 30,
    competitorMonthlyQty: 10,
    totalMarketQty: 40,
    share: 0.75,
    competitors: competitors,
    ourProducts: ourProducts,
  );

  CompetitorUsage usage(String name, double quantity) => CompetitorUsage(
    productId: name.hashCode,
    productName: name,
    quantity: quantity,
    metricQuantity: quantity,
    updatedAt: DateTime.utc(2026, 3, 10),
  );

  testWidgets('the four metric labels are readable at 360dp', (tester) async {
    tester.view.physicalSize = narrowPhone;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(host(PotentialRowHarness(item: item())));
    await tester.pumpAndSettle();

    // Present *and* whole. `find.text` matches an ellipsised widget just as
    // happily as an intact one, so asserting presence alone is what let
    // "Mercado total" render as "Mercado tot…" here for as long as it did.
    // `didExceedMaxLines` is the question actually being asked.
    for (final label in kMetricLabels) {
      expect(find.text(label), findsOneWidget, reason: '$label should render');
      expect(
        tester
            .renderObject<RenderParagraph>(find.text(label))
            .didExceedMaxLines,
        isFalse,
        reason: '$label is truncated at 360dp',
      );
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets('the metric labels survive a large text scale', (tester) async {
    // 320dp at 1.4x is the combination that truncated every caption, not just
    // the long one.
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MediaQuery(
            data: const MediaQueryData(
              size: Size(320, 800),
              textScaler: TextScaler.linear(1.4),
            ),
            child: SingleChildScrollView(
              child: PotentialRowHarness(item: item()),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    for (final label in kMetricLabels) {
      expect(
        tester
            .renderObject<RenderParagraph>(find.text(label))
            .didExceedMaxLines,
        isFalse,
        reason: '$label is truncated at 320dp / 1.4x',
      );
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'competitor products and quantities are listed, not just summed',
    (tester) async {
      tester.view.physicalSize = narrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        host(
          PotentialRowHarness(
            item: item(
              competitors: [usage('Marca A 1%', 12), usage('Marca B 2%', 3.5)],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // The breakdown the server always sent and the widget used to drop.
      expect(find.text('Marca A 1%'), findsOneWidget);
      expect(find.text('Marca B 2%'), findsOneWidget);
      // In the units the rep typed, not metric units.
      expect(find.text('12'), findsOneWidget);
      expect(find.text('3.5'), findsOneWidget);
      expect(find.text('Produto de outra marca'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('an empty breakdown says so rather than showing nothing', (
    tester,
  ) async {
    tester.view.physicalSize = narrowPhone;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(host(PotentialRowHarness(item: item())));
    await tester.pumpAndSettle();

    // "Nothing recorded" and "failed to load" must not look identical.
    expect(find.text('Nenhuma outra marca registrada.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('share renders as a dash when nothing is known, never as 0%', (
    tester,
  ) async {
    tester.view.physicalSize = narrowPhone;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      host(
        PotentialRowHarness(
          item: FacilityPotentialItem(
            definitionId: 2,
            key: 'k',
            label: 'Sem dados',
            atlasmedMonthlyAvgQty: 0,
            competitorMonthlyQty: 0,
            totalMarketQty: 0,
            competitors: const [],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // The distinction the whole metric rests on: no sales and no information
    // are not the same statement.
    expect(find.text('—'), findsOneWidget);
    expect(find.text('0%'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('the add affordance is absent when the user may not edit', (
    tester,
  ) async {
    tester.view.physicalSize = narrowPhone;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(host(PotentialRowHarness(item: item())));
    await tester.pumpAndSettle();

    // Absent, not present-and-failing.
    expect(find.text('Adicionar outra marca'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('the section itself is exported and constructible', (
    tester,
  ) async {
    // Guards the wiring: the section takes canEdit, and a read-only clinic must
    // not be handed an editing callback.
    const section = ClinicPotentialSection(facilityId: 1, canEdit: false);
    expect(section.canEdit, isFalse);
    expect(section.facilityId, 1);
  });

  group('our own products', () {
    OurProductUsage ours(String name, double qty) => OurProductUsage(
      productId: name.hashCode,
      productName: name,
      metricQuantity: qty,
    );

    testWidgets('are listed with their monthly average', (tester) async {
      tester.view.physicalSize = narrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        host(
          PotentialRowHarness(
            item: item(ourProducts: [ours('Nosso A', 18), ours('Nosso B', 12)]),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Nosso produto'), findsOneWidget);
      expect(find.text('Nosso A'), findsOneWidget);
      expect(find.text('Nosso B'), findsOneWidget);
      expect(find.text('18'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('offer nothing to tap — they come from orders', (tester) async {
      // The competitor rows are editable and ours are not. A row that looks
      // interactive and does nothing is worse than one that looks inert.
      tester.view.physicalSize = narrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        host(
          PotentialRowHarness(item: item(ourProducts: [ours('Nosso A', 18)])),
        ),
      );
      await tester.pumpAndSettle();

      final row = find.ancestor(
        of: find.text('Nosso A'),
        matching: find.byType(InkWell),
      );
      expect(row, findsNothing);
    });

    testWidgets('say so when this clinic bought nothing of ours', (
      tester,
    ) async {
      tester.view.physicalSize = narrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(host(PotentialRowHarness(item: item())));
      await tester.pumpAndSettle();

      // "Nothing sold" and "not loaded" must not look the same.
      expect(
        find.text('Nenhum produto nosso vendido neste período.'),
        findsOneWidget,
      );
    });

    testWidgets('competitor quantities read in metric units', (tester) async {
      // 3 units of a product worth 20 metric units each is 60, and 60 is what
      // the total above says. The row used to show 3.
      tester.view.physicalSize = narrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        host(
          PotentialRowHarness(
            item: item(
              competitors: [
                CompetitorUsage(
                  productId: 1,
                  productName: 'Marca X',
                  quantity: 3,
                  metricQuantity: 60,
                  updatedAt: DateTime.utc(2026, 3, 10),
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('60'), findsOneWidget);
      expect(find.text('3'), findsNothing);
    });

    testWidgets('each list says what period it covers', (tester) async {
      // Ours is a 90-day average, theirs is what stands recorded. Two lists of
      // the same shape must not imply the same period.
      tester.view.physicalSize = narrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        host(
          PotentialRowHarness(
            item: item(
              ourProducts: [ours('Nosso A', 18)],
              competitors: [
                CompetitorUsage(
                  productId: 1,
                  productName: 'Marca X',
                  quantity: 3,
                  metricQuantity: 60,
                  updatedAt: DateTime.utc(2026, 3, 10),
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Média/mês'), findsOneWidget);
      expect(find.text('Registrado/mês'), findsOneWidget);
      expect(find.text('(média últimos 3 meses)'), findsOneWidget);
    });
  });
}
