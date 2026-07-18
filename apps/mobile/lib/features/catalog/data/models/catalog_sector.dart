/// Commercial sector a product can belong to (mirrors the catalog module's
/// `Sector` DTO — `{ id, slug, name }`, same shape as
/// `features/territories/data/models/sector.dart` but fetched from the
/// catalog module's own `/sectors` endpoint rather than `/access/sectors`).
/// Only used to populate the admin product form's sector picker.
class CatalogSector {
  const CatalogSector({
    required this.id,
    required this.slug,
    required this.name,
  });

  final String id;
  final String slug;
  final String name;

  factory CatalogSector.fromJson(Map<String, dynamic> json) => CatalogSector(
    id: json['id'] as String,
    slug: json['slug'] as String,
    name: json['name'] as String,
  );
}
