import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('normalizeBrazilianPhone', () {
    test('removes formatting and prefixes Brazil country code', () {
      expect(normalizeBrazilianPhone('(11) 99876-5432'), '5511998765432');
    });

    test('preserves an existing Brazil country code', () {
      expect(normalizeBrazilianPhone('+55 (11) 99876-5432'), '5511998765432');
    });

    test('returns null when the contact has no digits', () {
      expect(normalizeBrazilianPhone('   '), isNull);
    });
  });

  group('contact URLs', () {
    test('builds call and WhatsApp URLs from normalized phone data', () {
      expect(callUrl('(11) 99876-5432').toString(), 'tel:5511998765432');
      expect(
        whatsappUrl('(11) 99876-5432').toString(),
        'https://wa.me/5511998765432',
      );
    });

    test('encodes email addresses for mailto URLs', () {
      expect(
        emailUrl('ana silva@example.com').toString(),
        'mailto:ana%20silva@example.com',
      );
    });
  });

  group('whatsappUrls', () {
    test('offers the app before the web link', () {
      final urls = whatsappUrls('(11) 99876-5432');

      // Asserted as the whole string, not by parts: the OS matches the scheme
      // and authority literally, and an empty host renders `whatsapp:///send`
      // — three slashes — which registers as nothing.
      expect(urls.first.toString(), 'whatsapp://send?phone=5511998765432');
      expect(urls.last.toString(), 'https://wa.me/5511998765432');
    });

    test('a contact with no digits has nothing to open', () {
      expect(whatsappUrls('  '), isEmpty);
    });
  });

  group('mapsAppRouteUrls', () {
    const address = 'AV MARACANA, 987 — RIO DE JANEIRO — RJ';
    const lat = -22.9273106;
    const lng = -43.2388971;

    test('Waze routes to the point, and does not also search for the text', () {
      // Sending `q` alongside `ll` makes Waze search for the string and treat
      // the pin as a hint, so the rep arrives at a result screen rather than a
      // route they can accept.
      final urls = mapsAppRouteUrls(
        app: 'waze',
        latitude: lat,
        longitude: lng,
        address: address,
      );

      expect(urls, isNotEmpty);
      for (final url in urls) {
        expect(url.queryParameters['ll'], '$lat,$lng');
        expect(url.queryParameters['navigate'], 'yes');
        expect(url.queryParameters.containsKey('q'), isFalse);
      }
      // The app's own scheme, in the documented `waze://?…` form.
      expect(urls.first.toString(), startsWith('waze://?'));
    });

    test('Waze falls back to searching when there is no point', () {
      final urls = mapsAppRouteUrls(app: 'waze', address: address);

      expect(urls, isNotEmpty);
      for (final url in urls) {
        expect(url.queryParameters['q'], address);
        expect(url.queryParameters['navigate'], 'yes');
      }
    });

    test('Google Maps navigates to the coordinates when they exist', () {
      final urls = mapsAppRouteUrls(
        app: 'googleMaps',
        latitude: lat,
        longitude: lng,
        address: address,
      );

      final native = urls.firstWhere((u) => u.scheme == 'comgooglemaps');
      expect(native.queryParameters['daddr'], '$lat,$lng');
      expect(native.queryParameters['directionsmode'], 'driving');
      expect(native.toString(), startsWith('comgooglemaps://?'));

      final httpsDir = urls.firstWhere(
        (u) => u.scheme == 'https' && u.host == 'www.google.com',
      );
      expect(httpsDir.queryParameters['destination'], '$lat,$lng');

      // The address stays available behind the coordinates, in case the point
      // is wrong and the text is not.
      expect(urls.any((u) => u.queryParameters.containsValue(address)), isTrue);
    });

    test('Google Maps uses the address when there are no coordinates', () {
      final urls = mapsAppRouteUrls(app: 'googleMaps', address: address);

      final native = urls.firstWhere((u) => u.scheme == 'comgooglemaps');
      expect(native.queryParameters['daddr'], address);
    });

    test('nothing to route to yields no candidates', () {
      expect(mapsAppRouteUrls(app: 'waze'), isEmpty);
      expect(mapsAppRouteUrls(app: 'googleMaps', address: '  '), isEmpty);
    });
  });
}
