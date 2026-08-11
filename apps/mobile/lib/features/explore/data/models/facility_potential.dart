import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

/// One competitor product's recorded quantity at this clinic.
class CompetitorUsage {
  const CompetitorUsage({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.metricQuantity,
    this.updatedAt,
  });

  final int productId;
  final String productName;

  /// Product units, as the rep entered them.
  final double quantity;

  /// quantity × the product's metric_units — comparable with our own side.
  final double metricQuantity;

  /// Drives "atualizado em <data>". A stale figure still counts as current
  /// (spec 0013 §6), so the date is the only signal that a number is old.
  final DateTime? updatedAt;

  factory CompetitorUsage.fromJson(Map<String, dynamic> json) {
    return CompetitorUsage(
      productId: readCrmId(json['productId'], 'productId'),
      productName: json['productName'] as String? ?? '',
      quantity: _numOrNull(json['quantity']) ?? 0,
      metricQuantity: _numOrNull(json['metricQuantity']) ?? 0,
      updatedAt: json['updatedAt'] is String
          ? DateTime.tryParse(json['updatedAt'] as String)
          : null,
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

  factory FacilityPotentialItem.fromJson(Map<String, dynamic> json) {
    final raw = json['competitors'];
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
