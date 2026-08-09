import 'package:flutter_test/flutter_test.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/payer_display.dart';

void main() {
  group('buildPayerDisplaySlices', () {
    test('shows all when 6 or fewer non-OTHER shares', () {
      final payers = List.generate(
        6,
        (i) => PayerShare(
          id: i + 1,
          name: 'P$i',
          sharePercent: (20 - i).toDouble(),
        ),
      );
      // renormalize not required for slice count
      final slices = buildPayerDisplaySlices(payers);
      expect(slices, hasLength(6));
      expect(slices.every((s) => !s.isBucket), isTrue);
    });

    test('buckets beyond top 5 when 7+ non-OTHER', () {
      final payers = List.generate(
        7,
        (i) => PayerShare(
          id: i + 1,
          name: 'P$i',
          sharePercent: (30 - i).toDouble(),
          isPackage: i == 6,
        ),
      );
      final slices = buildPayerDisplaySlices(payers);
      expect(slices, hasLength(6));
      expect(slices.last.isBucket, isTrue);
      expect(slices.last.name, 'Outros');
      expect(slices.last.members, hasLength(2));
      expect(slices.last.hasPackage, isTrue);
    });

    test('forces OTHER into Outros even if large share', () {
      final payers = [
        const PayerShare(
          id: 99,
          name: 'Outros',
          sharePercent: 40,
          type: 'OTHER',
          isPackage: true,
        ),
        const PayerShare(id: 1, name: 'Unimed', sharePercent: 35),
        const PayerShare(id: 2, name: 'Amil', sharePercent: 25),
      ];
      final slices = buildPayerDisplaySlices(payers);
      expect(slices, hasLength(3));
      expect(slices.where((s) => s.isBucket), hasLength(1));
      final bucket = slices.firstWhere((s) => s.isBucket);
      expect(bucket.sharePercent, 40);
      expect(bucket.hasPackage, isTrue);
      expect(bucket.members.single.id, 99);
    });
  });

  group('packageMixPercents', () {
    test('sums package vs non-package', () {
      final mix = packageMixPercents(const [
        PayerShare(id: 1, name: 'A', sharePercent: 30, isPackage: true),
        PayerShare(id: 2, name: 'B', sharePercent: 70, isPackage: false),
      ]);
      expect(mix.packagePercent, 30);
      expect(mix.nonPackagePercent, 70);
    });
  });
}
