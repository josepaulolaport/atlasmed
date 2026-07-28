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

  group('mapsAppRouteUrls', () {
    test('Waze includes address q even when coords are present', () {
      final urls = mapsAppRouteUrls(
        app: 'waze',
        latitude: -22.9273106,
        longitude: -43.2388971,
        address: 'AV MARACANA, 987 — RIO DE JANEIRO — RJ',
      );

      expect(urls, isNotEmpty);
      for (final url in urls) {
        expect(url.queryParameters['ll'], '-22.9273106,-43.2388971');
        expect(
          url.queryParameters['q'],
          'AV MARACANA, 987 — RIO DE JANEIRO — RJ',
        );
        expect(url.queryParameters['navigate'], 'yes');
      }
    });

    test('Google Maps prefers address as destination over raw coords', () {
      final urls = mapsAppRouteUrls(
        app: 'googleMaps',
        latitude: -22.9273106,
        longitude: -43.2388971,
        address: 'AV MARACANA, 987 — RIO DE JANEIRO — RJ',
      );

      final httpsDir = urls.firstWhere(
        (u) => u.scheme == 'https' && u.host == 'www.google.com',
      );
      expect(
        httpsDir.queryParameters['destination'],
        'AV MARACANA, 987 — RIO DE JANEIRO — RJ',
      );

      final native = urls.firstWhere((u) => u.scheme == 'comgooglemaps');
      expect(
        native.queryParameters['daddr'],
        'AV MARACANA, 987 — RIO DE JANEIRO — RJ',
      );
    });
  });
}
