/// Commercial business vertical (e.g. Ortopedia).
///
/// Mirrors the business vertical DTO from `GET /access/business-verticals`
/// (`{ id, code, name }`).
class BusinessVertical {
  final String id;
  final String slug;
  final String name;

  const BusinessVertical({
    required this.id,
    required this.slug,
    required this.name,
  });

  factory BusinessVertical.fromJson(Map<String, dynamic> json) =>
      BusinessVertical(
        id: json['id'] as String,
        slug: (json['code'] as String?) ?? (json['slug'] as String?) ?? '',
        name: json['name'] as String,
      );
}
