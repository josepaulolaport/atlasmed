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

  final String id;
  final String name;
  final String manufacturer;
  final String? brand;
  final String countryOfOrigin;
  final double price17;
  final double price18;
  final double price20;
  final DateTime brasindiceUpdatedAt;
}
