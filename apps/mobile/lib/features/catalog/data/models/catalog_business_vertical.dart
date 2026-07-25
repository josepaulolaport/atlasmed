/// Commercial vertical a product can belong to (mirrors the catalog module's
/// business vertical DTO — `{ id, code, name }`).
/// Only used to populate the admin product form's vertical picker.
class CatalogBusinessVertical {
  const CatalogBusinessVertical({
    required this.id,
    required this.slug,
    required this.name,
  });

  final String id;
  final String slug;
  final String name;

  factory CatalogBusinessVertical.fromJson(Map<String, dynamic> json) =>
      CatalogBusinessVertical(
        id: json['id'] as String,
        slug: (json['code'] as String?) ?? (json['slug'] as String?) ?? '',
        name: json['name'] as String,
      );
}
