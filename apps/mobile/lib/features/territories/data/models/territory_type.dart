import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

/// Whether a territory is a manager's flat assignment zone or an
/// operational rep patch where clinics get assigned.
///
/// Derived from `TerritoryType.slug` on the real API (`manager_zone` vs
/// `patch`).
enum TerritoryKind {
  managerZone,
  repPatch;

  /// The `type` query param slug used by `GET /territories?type=...`.
  String get slug =>
      this == TerritoryKind.managerZone ? 'manager_zone' : 'patch';

  String get label => this == TerritoryKind.managerZone
      ? 'Zonas de Gerente'
      : 'Áreas de Representante';
}

/// Mirrors territory type DTO (`id` / `slug` / `name` only after flag drop).
class TerritoryType {
  final int id;
  final String slug;
  final String name;

  const TerritoryType({
    required this.id,
    required this.slug,
    required this.name,
  });

  factory TerritoryType.fromJson(Map<String, dynamic> json) => TerritoryType(
    id: readCrmId(json['id'], 'id'),
    slug: json['slug'] as String,
    name: json['name'] as String,
  );

  TerritoryKind get kind => slug == 'manager_zone'
      ? TerritoryKind.managerZone
      : TerritoryKind.repPatch;
}
