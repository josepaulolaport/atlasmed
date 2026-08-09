import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/payer_catalog.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'builds summary from displayed payers without inventing update date',
    () {
      const payers = [
        PayerShare(id: 1, name: 'Particular', sharePercent: 35),
        PayerShare(id: 2, name: 'Unimed', sharePercent: 65),
      ];

      final summary = buildPayerMixSummary(payers);

      expect(summary?.principalSourceName, 'Unimed');
      expect(summary?.principalSourcePercent, 65);
      expect(summary?.registeredSourceCount, 2);
      expect(summary?.updatedAt, isNull);
    },
  );
}
