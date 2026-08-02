import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';

/// Synthetic id for the chart "Outros" bucket (not a catalog provider id).
const payerOutrosBucketId = '__payer_outros_bucket__';

/// One donut/legend slice after top-5 + OTHER bucketing.
class PayerDisplaySlice {
  const PayerDisplaySlice({
    required this.id,
    required this.name,
    required this.sharePercent,
    this.isPackage = false,
    this.hasPackage = false,
    this.isBucket = false,
    this.members = const [],
  });

  final String id;
  final String name;
  final double sharePercent;

  /// Named slice: whether that provider is pacote.
  final bool isPackage;

  /// Bucket: true when any member is pacote ("tem pacote").
  final bool hasPackage;

  final bool isBucket;
  final List<PayerShare> members;
}

/// Builds pie/legend slices:
/// - `type == OTHER` always lands in the Outros bucket
/// - remaining: top 5 by %; rest → bucket
/// - if no OTHER and only 1 leftover (≤6 total) → show all named (no 1-item bucket)
List<PayerDisplaySlice> buildPayerDisplaySlices(List<PayerShare> payers) {
  if (payers.isEmpty) return const [];

  final forced = <PayerShare>[];
  final rest = <PayerShare>[];
  for (final p in payers) {
    if (p.isOtherType) {
      forced.add(p);
    } else {
      rest.add(p);
    }
  }
  rest.sort((a, b) => b.sharePercent.compareTo(a.sharePercent));

  if (forced.isEmpty) {
    if (rest.length <= 6) {
      return rest.map(_namedSlice).toList(growable: false);
    }
    final named = rest.take(5).map(_namedSlice).toList();
    final bucketMembers = rest.skip(5).toList(growable: false);
    named.add(_bucketSlice(bucketMembers));
    return named;
  }

  final named = rest.take(5).map(_namedSlice).toList();
  final bucketMembers = [...forced, ...rest.skip(5)];
  named.add(_bucketSlice(bucketMembers));
  return named;
}

/// Package vs non-package mix across all raw shares (not display slices).
({double packagePercent, double nonPackagePercent}) packageMixPercents(
  List<PayerShare> payers,
) {
  var packageSum = 0.0;
  var nonPackageSum = 0.0;
  for (final p in payers) {
    if (p.isPackage) {
      packageSum += p.sharePercent;
    } else {
      nonPackageSum += p.sharePercent;
    }
  }
  return (packagePercent: packageSum, nonPackagePercent: nonPackageSum);
}

PayerDisplaySlice _namedSlice(PayerShare p) {
  return PayerDisplaySlice(
    id: p.id,
    name: p.name,
    sharePercent: p.sharePercent,
    isPackage: p.isPackage,
    hasPackage: p.isPackage,
    members: [p],
  );
}

PayerDisplaySlice _bucketSlice(List<PayerShare> members) {
  final sum = members.fold<double>(0, (s, p) => s + p.sharePercent);
  final hasPackage = members.any((p) => p.isPackage);
  return PayerDisplaySlice(
    id: payerOutrosBucketId,
    name: 'Outros',
    sharePercent: sum,
    hasPackage: hasPackage,
    isBucket: true,
    members: List<PayerShare>.unmodifiable(members),
  );
}
