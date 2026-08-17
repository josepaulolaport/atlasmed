import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/facility_location_picker.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:flutter_test/flutter_test.dart';

/// Where the pin picker opens.
///
/// It opened on a hardcoded São Paulo whenever there was no pin yet, so
/// importing a clinic in Barra da Tijuca started the map 400km from the clinic
/// and the whole country had to be dragged past to reach it. The CNES record
/// always carries a município even when it carries no coordinates, so there was
/// always something better to open on.
///
/// Asserted on the camera rather than on pixels: a Mapbox platform view renders
/// nothing in a widget test, and the defect was never in the drawing.
const _rio = MapCoordinate(latitude: -22.9508, longitude: -43.1881);
const _saoPaulo = MapCoordinate(latitude: -23.5505, longitude: -46.6333);

void main() {
  group('pinPickerCentre', () {
    test('opens on the pin the clinic already has', () {
      expect(pinPickerCentre(initial: _rio, fallback: _saoPaulo), _rio);
    });

    test('falls back to the clinic’s own area, not a hardcoded city', () {
      // The regression in one assertion: with no pin, this used to be São Paulo
      // no matter where the clinic was.
      expect(pinPickerCentre(initial: null, fallback: _rio), _rio);
    });

    test('with nothing to go on it centres on Brazil, not on a guess', () {
      // A city centre picked at random is worse than an honest overview,
      // because it looks like an answer.
      final centre = pinPickerCentre(initial: null, fallback: null);

      expect(centre.latitude, closeTo(-14.2, 0.001));
      expect(centre.longitude, closeTo(-51.9, 0.001));
    });
  });

  group('pinPickerZoom', () {
    test('street level for a known pin', () {
      expect(pinPickerZoom(initial: _rio, fallback: null), 16);
    });

    test(
      'neighbourhood level for a fallback, which is a place not a point',
      () {
        expect(pinPickerZoom(initial: null, fallback: _rio), 13);
      },
    );

    test('country level when there is nothing to go on', () {
      // Opening at street zoom over an arbitrary point would claim a precision
      // the app does not have.
      expect(pinPickerZoom(initial: null, fallback: null), 4);
    });

    test('a pin outranks a fallback for both centre and zoom', () {
      expect(pinPickerZoom(initial: _rio, fallback: _saoPaulo), 16);
      expect(pinPickerCentre(initial: _rio, fallback: _saoPaulo), _rio);
    });
  });
}
