import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

class FacilityPotentialItem {
  const FacilityPotentialItem({
    required this.definitionId,
    required this.key,
    required this.label,
    this.potentialQuantity,
    required this.atlasmedMonthlyAvgQty,
    this.penetration,
  });

  final int definitionId;
  final String key;
  final String label;
  final double? potentialQuantity;
  final double atlasmedMonthlyAvgQty;

  /// Fraction 0–1+; null when potential missing.
  final double? penetration;

  factory FacilityPotentialItem.fromJson(Map<String, dynamic> json) {
    return FacilityPotentialItem(
      definitionId: readCrmId(json['definitionId'], 'definitionId'),
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? '',
      potentialQuantity: _numOrNull(json['potentialQuantity']),
      atlasmedMonthlyAvgQty: _numOrNull(json['atlasmedMonthlyAvgQty']) ?? 0,
      penetration: _numOrNull(json['penetration']),
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
