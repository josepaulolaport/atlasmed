import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

/// A competitor's equivalent product (mirrors `competitor_products`), used
/// only inside comparison tables against an AtlasMed [CatalogVariant].
class CompetitorProduct {
  const CompetitorProduct({
    required this.id,
    required this.name,
    required this.manufacturer,
    this.brand,
    required this.countryOfOrigin,
    required this.price17,
    required this.price18,
    required this.price20,
    required this.brasindiceUpdatedAt,
    this.isActive = true,
    this.equivalenceCount,
  });

  final int id;
  final String name;
  final String manufacturer;
  final String? brand;
  final String countryOfOrigin;
  final double price17;
  final double price18;
  final double price20;

  /// Null when the competitor has no Brasíndice record — every competitor
  /// row in production ships without one, so this must never be a hard parse.
  final DateTime? brasindiceUpdatedAt;

  /// Retired brands are kept, not deleted (spec 0016 §6.2), and the admin list
  /// shows them alongside active ones (§4).
  final bool isActive;

  /// How many of our products this brand is equivalent to (spec 0016 §5.3).
  ///
  /// Null on reads that do not compute it — the comparison table and the picker
  /// have no use for it — so "not asked" stays distinguishable from "none". A
  /// brand at **zero** is one a rep cannot record quantities for (spec 0013 §7),
  /// which is exactly what the list needs to make visible.
  final int? equivalenceCount;

  factory CompetitorProduct.fromJson(Map<String, dynamic> json) {
    double readPrice(Object? value) => switch (value) {
      num v => v.toDouble(),
      String v => double.tryParse(v) ?? 0,
      _ => 0,
    };

    return CompetitorProduct(
      id: readCrmId(json['id'], 'id'),
      name: json['name'] as String,
      manufacturer: json['manufacturer'] as String? ?? '',
      brand: json['brand'] as String?,
      countryOfOrigin: json['countryOfOrigin'] as String? ?? '',
      price17: readPrice(json['price17']),
      price18: readPrice(json['price18']),
      price20: readPrice(json['price20']),
      brasindiceUpdatedAt: DateTime.tryParse(
        json['brasindiceUpdatedAt'] as String? ?? '',
      ),
      isActive: json['isActive'] as bool? ?? true,
      equivalenceCount: switch (json['equivalenceCount']) {
        final num value => value.toInt(),
        _ => null,
      },
    );
  }

  CompetitorProduct copyWith({
    int? id,
    String? name,
    String? manufacturer,
    String? brand,
    String? countryOfOrigin,
    double? price17,
    double? price18,
    double? price20,
    DateTime? brasindiceUpdatedAt,
    bool? isActive,
  }) {
    return CompetitorProduct(
      id: id ?? this.id,
      name: name ?? this.name,
      manufacturer: manufacturer ?? this.manufacturer,
      brand: brand ?? this.brand,
      countryOfOrigin: countryOfOrigin ?? this.countryOfOrigin,
      price17: price17 ?? this.price17,
      price18: price18 ?? this.price18,
      price20: price20 ?? this.price20,
      brasindiceUpdatedAt: brasindiceUpdatedAt ?? this.brasindiceUpdatedAt,
      isActive: isActive ?? this.isActive,
      equivalenceCount: equivalenceCount,
    );
  }
}
