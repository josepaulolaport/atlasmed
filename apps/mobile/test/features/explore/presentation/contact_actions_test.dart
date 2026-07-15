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
}
