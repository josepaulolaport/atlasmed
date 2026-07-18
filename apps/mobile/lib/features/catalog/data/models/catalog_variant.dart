/// A single sellable presentation of an AtlasMed product (mirrors a row of
/// the `products` table: code, simpro/brasindice/tiss coding, ICMS pricing).
///
/// Several variants sharing the same [familyName] (`productGroup` in the DB)
/// are grouped into a [CatalogFamily] for display.
class CatalogVariant {
  const CatalogVariant({
    required this.id,
    required this.code,
    required this.name,
    required this.familyName,
    required this.presentation,
    required this.manufacturer,
    required this.countryOfOrigin,
    required this.simproCode,
    required this.brasindiceCode,
    required this.tissCode,
    required this.price,
    required this.price17,
    required this.price18,
    required this.price20,
    required this.brasindiceUpdatedAt,
    this.isActive = true,
    this.sectorIds = const [],
  });

  final String id;
  final String code;
  final String name;
  final String familyName;

  /// e.g. "20MG / 2ML" — concentration/volume shown alongside the name.
  /// The real API has no dedicated column for this — it only ever comes
  /// back combined into [name] (see [comparisonLabel]) — so this is only
  /// ever non-empty for a variant still being edited locally in
  /// [VariantFormScreen], before it round-trips through the backend.
  final String presentation;
  final String manufacturer;
  final String countryOfOrigin;
  final String simproCode;
  final String brasindiceCode;
  final String tissCode;
  final double price;
  final double price17;
  final double price18;
  final double price20;
  final DateTime brasindiceUpdatedAt;
  final bool isActive;

  /// Commercial sectors this product belongs to (`sectorIds` on the
  /// `products` table) — required, non-empty when creating a product on
  /// the real API.
  final List<String> sectorIds;

  /// Full label used inside comparison tables, e.g. "REVISCON 1.0% - 20MG / 2ML".
  String get comparisonLabel =>
      presentation.isEmpty ? name : '$name - $presentation';

  factory CatalogVariant.fromJson(Map<String, dynamic> json) {
    double readPrice(Object? value) => switch (value) {
      num v => v.toDouble(),
      String v => double.tryParse(v) ?? 0,
      _ => 0,
    };

    final productGroup = json['productGroup'] as String?;
    final name = json['name'] as String;

    return CatalogVariant(
      id: json['id'] as String,
      code: json['code'] as String,
      name: name,
      familyName: (productGroup?.trim().isNotEmpty ?? false)
          ? productGroup!.trim()
          : name,
      // Never populated separately by the real API — see [presentation].
      presentation: '',
      manufacturer: json['manufacturer'] as String,
      countryOfOrigin: json['countryOfOrigin'] as String,
      simproCode: json['simproCode'] as String,
      brasindiceCode: json['brasindiceCode'] as String,
      tissCode: json['tissCode'] as String,
      price: readPrice(json['price']),
      price17: readPrice(json['price17']),
      price18: readPrice(json['price18']),
      price20: readPrice(json['price20']),
      brasindiceUpdatedAt: DateTime.parse(
        json['brasindiceUpdatedAt'] as String,
      ),
      isActive: json['isActive'] as bool? ?? true,
      sectorIds:
          (json['sectorIds'] as List<dynamic>?)?.cast<String>() ?? const [],
    );
  }

  CatalogVariant copyWith({
    String? id,
    String? code,
    String? name,
    String? familyName,
    String? presentation,
    String? manufacturer,
    String? countryOfOrigin,
    String? simproCode,
    String? brasindiceCode,
    String? tissCode,
    double? price,
    double? price17,
    double? price18,
    double? price20,
    DateTime? brasindiceUpdatedAt,
    bool? isActive,
    List<String>? sectorIds,
  }) {
    return CatalogVariant(
      id: id ?? this.id,
      code: code ?? this.code,
      name: name ?? this.name,
      familyName: familyName ?? this.familyName,
      presentation: presentation ?? this.presentation,
      manufacturer: manufacturer ?? this.manufacturer,
      countryOfOrigin: countryOfOrigin ?? this.countryOfOrigin,
      simproCode: simproCode ?? this.simproCode,
      brasindiceCode: brasindiceCode ?? this.brasindiceCode,
      tissCode: tissCode ?? this.tissCode,
      price: price ?? this.price,
      price17: price17 ?? this.price17,
      price18: price18 ?? this.price18,
      price20: price20 ?? this.price20,
      brasindiceUpdatedAt: brasindiceUpdatedAt ?? this.brasindiceUpdatedAt,
      isActive: isActive ?? this.isActive,
      sectorIds: sectorIds ?? this.sectorIds,
    );
  }
}
