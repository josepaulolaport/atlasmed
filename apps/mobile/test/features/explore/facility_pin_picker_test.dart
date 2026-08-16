import 'package:atlasmed_mobile_app/features/explore/data/repositories/cnes_facility_candidates_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/facility_location_picker.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// A clinic's pin decides which manager zone and rep patch it lands in, so a
/// coordinate with no address answers that question with something nobody can
/// act on. The picker will not confirm one.
///
/// The map itself is a platform view that does not run under the test binding,
/// so these drive the screen through the state it reaches after a lookup rather
/// than through map gestures.
void main() {
  const ipanema = MapCoordinate(longitude: -43.2014, latitude: -22.9841);

  const found = ReverseGeocodedAddress(
    fullAddress: 'Rua Visconde de Pirajá 550, Ipanema',
    streetAddress: 'Rua Visconde de Pirajá',
    streetNumber: '550',
    neighborhood: 'Ipanema',
    postalCode: '22410-002',
  );

  Future<void> pump(
    WidgetTester tester,
    Future<ReverseGeocodedAddress?> Function(double, double) resolve,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: FacilityPinPickerScreen(
          initial: ipanema,
          title: 'Clinica Teste',
          resolve: resolve,
        ),
      ),
    );
    // Past the settle debounce and the lookup.
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump();
  }

  FilledButton confirmButton(WidgetTester tester) => tester
      .widget<FilledButton>(find.byKey(const Key('facility-pin-confirm')));

  testWidgets('a point with an address can be confirmed, and shows it', (
    tester,
  ) async {
    await pump(tester, (_, _) async => found);

    expect(find.textContaining('Rua Visconde de Pirajá 550'), findsOneWidget);
    expect(confirmButton(tester).onPressed, isNotNull);
    expect(find.text('Confirmar local'), findsOneWidget);
  });

  testWidgets('open water cannot be confirmed, and says why', (tester) async {
    await pump(tester, (_, _) async => null);

    expect(confirmButton(tester).onPressed, isNull);
    expect(find.text('Sem endereço aqui'), findsOneWidget);
    expect(find.textContaining('Não há endereço neste ponto'), findsOneWidget);
    // The reason matters: it is about territory, not about the map.
    expect(find.textContaining('território'), findsOneWidget);
  });

  testWidgets('an address with nothing usable in it counts as nowhere', (
    tester,
  ) async {
    await pump(
      tester,
      (_, _) async => const ReverseGeocodedAddress(fullAddress: 'Oceano'),
    );

    expect(confirmButton(tester).onPressed, isNull);
  });

  testWidgets('a failed lookup is not reported as open water', (tester) async {
    await pump(tester, (_, _) async => throw Exception('offline'));

    expect(confirmButton(tester).onPressed, isNull);
    expect(find.textContaining('Não há endereço'), findsNothing);
    expect(find.textContaining('Não foi possível verificar'), findsOneWidget);
  });

  testWidgets('while the lookup is in flight nothing can be confirmed', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: FacilityPinPickerScreen(
          initial: ipanema,
          title: 'Clinica Teste',
          resolve: (_, _) async {
            await Future<void>.delayed(const Duration(seconds: 5));
            return found;
          },
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 600));

    expect(confirmButton(tester).onPressed, isNull);
    expect(find.text('Verificando…'), findsOneWidget);

    await tester.pump(const Duration(seconds: 6));
  });
}
