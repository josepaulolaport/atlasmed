import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

/// Commercial business vertical (e.g. Ortopédica).
///
/// Mirrors the business vertical DTO from `GET /access/business-verticals`
/// (`{ id, code, name }`).
class BusinessVertical {
  final int id;
  final String slug;
  final String name;

  const BusinessVertical({
    required this.id,
    required this.slug,
    required this.name,
  });

  factory BusinessVertical.fromJson(Map<String, dynamic> json) =>
      BusinessVertical(
        id: readCrmId(json['id'], 'id'),
        slug: (json['code'] as String?) ?? (json['slug'] as String?) ?? '',
        name: json['name'] as String,
      );
}
