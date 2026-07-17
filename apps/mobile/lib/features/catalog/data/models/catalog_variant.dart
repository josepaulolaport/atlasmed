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
  });

  final String id;
  final String code;
  final String name;
  final String familyName;

  /// e.g. "20MG / 2ML" — concentration/volume shown alongside the name.
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

  /// Full label used inside comparison tables, e.g. "REVISCON 1.0% - 20MG / 2ML".
  String get comparisonLabel =>
      presentation.isEmpty ? name : '$name - $presentation';
}
