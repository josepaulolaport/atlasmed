import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

/// One competitor product's recorded quantity at this clinic.
class CompetitorUsage {
  const CompetitorUsage({
    required this.productId,
    required this.productName,
    required this.quantity,
    this.updatedAt,
  });

  final int productId;
  final String productName;

  /// Per month, in the product's own units, as the rep entered them.
  ///
  /// No conversion: `metric_units` is an information field since spec 0013
  /// §4.6, so both sides of the market are counted the same way.
  final double quantity;

  /// Drives "atualizado em <data>". A stale figure still counts as current
  /// (spec 0013 §6), so the date is the only signal that a number is old.
  final DateTime? updatedAt;

  factory CompetitorUsage.fromJson(Map<String, dynamic> json) {
    return CompetitorUsage(
      productId: readCrmId(json['productId'], 'productId'),
      productName: json['productName'] as String? ?? '',
      quantity: _numOrNull(json['quantity']) ?? 0,
      updatedAt: json['updatedAt'] is String
          ? DateTime.tryParse(json['updatedAt'] as String)
          : null,
    );
  }
}

/// One of our own products and what this clinic buys of it.
///
/// Derived from orders over the same window as [FacilityPotentialItem.
/// atlasmedMonthlyAvgQty], so these rows add up to it. Nothing here is
/// editable — there is no rep-entered figure behind it.
class OurProductUsage {
  const OurProductUsage({
    required this.productId,
    required this.productName,
    required this.quantity,
  });

  final int productId;
  final String productName;

  /// Per month, normalised from the 90-day window.
  final double quantity;

  factory OurProductUsage.fromJson(Map<String, dynamic> json) {
    return OurProductUsage(
      productId: readCrmId(json['productId'], 'productId'),
      productName: json['productName'] as String? ?? '',
      quantity: _numOrNull(json['quantity']) ?? 0,
    );
  }
}

class FacilityPotentialItem {
  const FacilityPotentialItem({
    required this.definitionId,
    required this.key,
    required this.label,
    required this.atlasmedMonthlyAvgQty,
    required this.competitorMonthlyQty,
    required this.totalMarketQty,
    this.share,
    this.competitors = const [],
    this.ourProducts = const [],
    this.noOtherBrands = false,
    this.noOtherBrandsSetAt,
  });

  final int definitionId;
  final String key;
  final String label;

  /// Ours, from orders.
  final double atlasmedMonthlyAvgQty;

  /// Theirs, summed from what the rep recorded.
  final double competitorMonthlyQty;

  /// The observed market: ours + theirs.
  final double totalMarketQty;

  /// Our share of it, 0–1. **Null, never 0, when nothing is known** — "we sell
  /// nothing here" and "we have no information" must stay distinguishable.
  final double? share;

  final List<CompetitorUsage> competitors;

  /// Ours, per product, over the same window as [atlasmedMonthlyAvgQty].
  final List<OurProductUsage> ourProducts;

  /// The rep's standing claim that no other brand is sold here.
  ///
  /// The only thing that makes a 100% share legitimate (spec 0013 §4.6):
  /// without it an empty competitor list means the market is *unknown*, not
  /// that we own it.
  final bool noOtherBrands;

  /// When the claim was made. A stale claim still counts, so the date is the
  /// only signal that it is old (§6).
  final DateTime? noOtherBrandsSetAt;

  factory FacilityPotentialItem.fromJson(Map<String, dynamic> json) {
    final raw = json['competitors'];
    final rawOurs = json['ourProducts'];
    return FacilityPotentialItem(
      definitionId: readCrmId(json['definitionId'], 'definitionId'),
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? '',
      atlasmedMonthlyAvgQty: _numOrNull(json['atlasmedMonthlyAvgQty']) ?? 0,
      competitorMonthlyQty: _numOrNull(json['competitorMonthlyQty']) ?? 0,
      totalMarketQty: _numOrNull(json['totalMarketQty']) ?? 0,
      share: _numOrNull(json['share']),
      competitors: raw is List
          ? raw
                .whereType<Map>()
                .map(
                  (row) =>
                      CompetitorUsage.fromJson(Map<String, dynamic>.from(row)),
                )
                .toList(growable: false)
          : const [],
      ourProducts: rawOurs is List
          ? rawOurs
                .whereType<Map>()
                .map(
                  (row) =>
                      OurProductUsage.fromJson(Map<String, dynamic>.from(row)),
                )
                .toList(growable: false)
          : const [],
      noOtherBrands: json['noOtherBrands'] as bool? ?? false,
      noOtherBrandsSetAt: json['noOtherBrandsSetAt'] is String
          ? DateTime.tryParse(json['noOtherBrandsSetAt'] as String)
          : null,
    );
  }
}

class FacilityPotentialsPage {
  const FacilityPotentialsPage({required this.verticalId, required this.items});

  final int verticalId;
  final List<FacilityPotentialItem> items;

  factory FacilityPotentialsPage.fromJson(Map<String, dynamic> json) {
    final list = json['items'];
    return FacilityPotentialsPage(
      verticalId: readCrmId(json['verticalId'], 'verticalId'),
      items: list is List
          ? list
                .whereType<Map>()
                .map(
                  (row) => FacilityPotentialItem.fromJson(
                    Map<String, dynamic>.from(row),
                  ),
                )
                .toList(growable: false)
          : const [],
    );
  }
}

double? _numOrNull(Object? value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}
