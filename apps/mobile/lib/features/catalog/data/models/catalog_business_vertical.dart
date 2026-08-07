import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
/// Commercial vertical a product can belong to (mirrors the catalog module's
/// business vertical DTO — `{ id, code, name }`).
/// Only used to populate the admin product form's vertical picker.
class CatalogBusinessVertical {
  const CatalogBusinessVertical({
    required this.id,
    required this.slug,
    required this.name,
  });

  final int id;
  final String slug;
  final String name;

  factory CatalogBusinessVertical.fromJson(Map<String, dynamic> json) =>
      CatalogBusinessVertical(
        id: readCrmId(json['id'], 'id'),
        slug: (json['code'] as String?) ?? (json['slug'] as String?) ?? '',
        name: json['name'] as String,
      );
}
