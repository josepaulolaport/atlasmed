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
  });

  final int id;
  final String name;
  final String manufacturer;
  final String? brand;
  final String countryOfOrigin;
  final double price17;
  final double price18;
  final double price20;
  final DateTime brasindiceUpdatedAt;

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
      brasindiceUpdatedAt: DateTime.parse(
        json['brasindiceUpdatedAt'] as String,
      ),
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
    );
  }
}
