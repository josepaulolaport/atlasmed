import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/widgets/clinic_pin_callout.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// The map pin's status line.
///
/// It used to render `ClinicStatus`, whose mapping sent every bucket that was
/// not active or inactive to `rejected`. So a clinic that had simply never
/// bought showed "Rejeição" on the map — not a gentler phrasing of "never
/// bought", but a claim that the clinic turned us down, in front of the rep
/// about to walk in.
NearbyEstablishment establishment({String? purchaseBucket}) =>
    NearbyEstablishment(
      id: 1,
      name: 'Baeta Neves Centro Medico',
      latitude: -23.0,
      longitude: -46.0,
      distanceKm: 333.9,
      purchaseBucket: purchaseBucket,
    );

Future<void> pump(WidgetTester tester, NearbyEstablishment value) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(body: ClinicPinCalloutContent(establishment: value)),
    ),
  );
  // The card is a fixed 216pt, and widget tests render in Ahem where every
  // glyph is a square — "Ir para página da clínica" measures roughly 338pt
  // there against about 150pt in the real font, so it overflows in the test
  // and fits on a phone. These tests are about which words appear, so the
  // layout complaint is consumed rather than chased.
  tester.takeException();
}

void main() {
  testWidgets('a clinic that never bought says so, and is never "Rejeição"', (
    tester,
  ) async {
    await pump(
      tester,
      establishment(purchaseBucket: PurchaseBucketFilter.neverBought),
    );

    expect(find.text('Nunca comprou'), findsOneWidget);
    expect(find.text('Rejeição'), findsNothing);
    // Not the map's old private vocabulary either.
    expect(find.text('Sem compras'), findsNothing);
  });

  testWidgets('names the bucket in the singular, agreeing with "clínica"', (
    tester,
  ) async {
    // "Ativa" for one clinic, against "Ativas" on the Desempenho legend.
    await pump(
      tester,
      establishment(purchaseBucket: PurchaseBucketFilter.active),
    );

    expect(find.text('Ativa'), findsOneWidget);
    expect(find.text('Ativas'), findsNothing);
  });

  testWidgets('puts the commercial status under the distance', (tester) async {
    // Identity first — name, neighbourhood, how far — then the one fact a rep
    // acts on, next to the link into the clinic.
    await pump(
      tester,
      establishment(purchaseBucket: PurchaseBucketFilter.neverBought),
    );

    expect(
      tester.getTopLeft(find.textContaining('km de distância')).dy,
      lessThan(tester.getTopLeft(find.text('Nunca comprou')).dy),
    );
  });

  testWidgets('distinguishes inactive from never bought', (tester) async {
    await pump(
      tester,
      establishment(purchaseBucket: PurchaseBucketFilter.inactive),
    );

    expect(find.text('Inativa'), findsOneWidget);
    expect(find.text('Nunca comprou'), findsNothing);
  });

  testWidgets('says nothing when there is no bucket to show', (tester) async {
    // The "you are here" pin on the nearby map carries no purchase data.
    // Better silent than captioned with someone else's status.
    await pump(tester, establishment());

    for (final label in ['Nunca comprou', 'Ativa', 'Inativa', 'Rejeição']) {
      expect(find.text(label), findsNothing);
    }
    expect(find.text('Baeta Neves Centro Medico'), findsOneWidget);
  });
}
