class FacilityPotentialItem {
  const FacilityPotentialItem({
    required this.definitionId,
    required this.key,
    required this.label,
    required this.sortOrder,
    this.potentialQuantity,
    required this.atlasmedMonthlyAvgQty,
    this.penetration,
  });

  final String definitionId;
  final String key;
  final String label;
  final int sortOrder;
  final double? potentialQuantity;
  final double atlasmedMonthlyAvgQty;

  /// Fraction 0–1+; null when potential missing.
  final double? penetration;

  factory FacilityPotentialItem.fromJson(Map<String, dynamic> json) {
    return FacilityPotentialItem(
      definitionId: json['definitionId'] as String,
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? '',
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      potentialQuantity: _numOrNull(json['potentialQuantity']),
      atlasmedMonthlyAvgQty: _numOrNull(json['atlasmedMonthlyAvgQty']) ?? 0,
      penetration: _numOrNull(json['penetration']),
    );
  }
}

class FacilityPotentialsPage {
  const FacilityPotentialsPage({
    required this.verticalId,
    required this.items,
  });

  final String verticalId;
  final List<FacilityPotentialItem> items;

  factory FacilityPotentialsPage.fromJson(Map<String, dynamic> json) {
    final list = json['items'];
    return FacilityPotentialsPage(
      verticalId: json['verticalId'] as String? ?? '',
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
