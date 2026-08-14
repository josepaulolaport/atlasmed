import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';

/// Groups all [CatalogVariant]s that share the same `productGroup` (e.g. all
/// three REVISCON concentrations) under a single browsable family.
class CatalogFamily {
  const CatalogFamily({
    required this.id,
    required this.name,
    required this.manufacturer,
    required this.countryOfOrigin,
    required this.variants,
    required this.brasindicePublishedAt,
    required this.simproPublishedAt,
  });

  final int id;
  final String name;
  final String manufacturer;
  final String countryOfOrigin;
  final List<CatalogVariant> variants;

  /// Null when no variant in the family has a Brasíndice/Simpro record.
  final DateTime? brasindicePublishedAt;
  final DateTime? simproPublishedAt;

  double get minPrice =>
      variants.map((v) => v.price).reduce((a, b) => a < b ? a : b);

  double get maxPrice =>
      variants.map((v) => v.price).reduce((a, b) => a > b ? a : b);
}
