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

/// Mirrors `TerritoryType` from `apps/web/types/territory.ts`.
class TerritoryType {
  final String id;
  final String slug;
  final String name;
  final bool assignsClinics;
  final bool assignableToManagers;

  const TerritoryType({
    required this.id,
    required this.slug,
    required this.name,
    required this.assignsClinics,
    required this.assignableToManagers,
  });

  factory TerritoryType.fromJson(Map<String, dynamic> json) => TerritoryType(
    id: json['id'] as String,
    slug: json['slug'] as String,
    name: json['name'] as String,
    assignsClinics: json['assignsClinics'] as bool? ?? false,
    assignableToManagers: json['assignableToManagers'] as bool? ?? false,
  );

  TerritoryKind get kind => slug == 'manager_zone'
      ? TerritoryKind.managerZone
      : TerritoryKind.repPatch;
}
