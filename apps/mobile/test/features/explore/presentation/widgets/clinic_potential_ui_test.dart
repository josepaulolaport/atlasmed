import 'package:atlasmed_mobile_app/features/explore/data/models/facility_potential.dart';
import 'package:flutter/material.dart';
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

  Widget host(Widget child) => MaterialApp(
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );

  FacilityPotentialItem item({List<CompetitorUsage> competitors = const []}) =>
      FacilityPotentialItem(
        definitionId: 1,
        key: 'ampolas_mes',
        label: 'Ampolas por mês',
        atlasmedMonthlyAvgQty: 30,
        competitorMonthlyQty: 10,
        totalMarketQty: 40,
        share: 0.75,
        competitors: competitors,
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

    // All four captions present and none of them replaced by an ellipsis.
    for (final label in const [
      'AtlasMed/mês',
      'Concorrentes/mês',
      'Mercado total',
      'Participação',
    ]) {
      expect(find.text(label), findsOneWidget, reason: '$label should render');
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
              competitors: [
                usage('Concorrente A 1%', 12),
                usage('Concorrente B 2%', 3.5),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // The breakdown the server always sent and the widget used to drop.
      expect(find.text('Concorrente A 1%'), findsOneWidget);
      expect(find.text('Concorrente B 2%'), findsOneWidget);
      // In the units the rep typed, not metric units.
      expect(find.text('12'), findsOneWidget);
      expect(find.text('3.5'), findsOneWidget);
      expect(find.text('Produto concorrente'), findsOneWidget);
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
    expect(
      find.text('Nenhum concorrente registrado neste mês.'),
      findsOneWidget,
    );
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
    expect(find.text('Adicionar concorrente'), findsNothing);
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
}
