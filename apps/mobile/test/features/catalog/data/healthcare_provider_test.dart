import 'package:atlasmed_mobile_app/features/catalog/data/models/competitor_product.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/healthcare_provider.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('HealthcareProvider', () {
    test('maps every type the column allows', () {
      // The enum on `healthcare_providers.type` has exactly these four.
      expect(
        HealthcareProviderType.fromWire('PRIVATE'),
        HealthcareProviderType.private,
      );
      expect(
        HealthcareProviderType.fromWire('PUBLIC'),
        HealthcareProviderType.public,
      );
      expect(
        HealthcareProviderType.fromWire('MIXED'),
        HealthcareProviderType.mixed,
      );
      expect(
        HealthcareProviderType.fromWire('OTHER'),
        HealthcareProviderType.other,
      );
    });

    test('falls back to OTHER rather than throwing on an unknown type', () {
      // A new enum value shipped server-side must not take down the admin list.
      expect(
        HealthcareProviderType.fromWire('SOMETHING_NEW'),
        HealthcareProviderType.other,
      );
      expect(HealthcareProviderType.fromWire(null), HealthcareProviderType.other);
    });

    test('parses the API row', () {
      final provider = HealthcareProvider.fromJson({
        'id': 7,
        'name': 'Unimed',
        'type': 'PRIVATE',
        'isActive': false,
      });

      expect(provider.id, 7);
      expect(provider.name, 'Unimed');
      expect(provider.type.label, 'Privado');
      expect(provider.isActive, isFalse);
    });
  });

  group('CompetitorProduct.equivalenceCount', () {
    Map<String, dynamic> row([int? count]) {
      final json = <String, dynamic>{
        'id': 3,
        'name': 'SingJoint',
        'manufacturer': 'Hangzhou',
        'countryOfOrigin': 'China',
        'price17': 70,
        'price18': 71,
        'price20': 72,
        'brasindiceUpdatedAt': null,
      };
      // Absent, not null: the point of the first test is a payload that never
      // mentions the key at all.
      if (count != null) json['equivalenceCount'] = count;
      return json;
    }

    test('is null when the read does not compute it', () {
      // Not 0: "not asked" and "none" are different answers, and only one of
      // them means a rep is blocked (spec 0016 §5.3).
      expect(CompetitorProduct.fromJson(row()).equivalenceCount, isNull);
    });

    test('carries zero through, because zero is the interesting case', () {
      expect(CompetitorProduct.fromJson(row(0)).equivalenceCount, 0);
      expect(CompetitorProduct.fromJson(row(4)).equivalenceCount, 4);
    });
  });
}
