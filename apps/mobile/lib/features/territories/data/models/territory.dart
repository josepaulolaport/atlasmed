import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart'
    show TerritoryGeometry;
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';

/// Sentinel used by [Territory.copyWith] so nullable fields can be
/// explicitly reset to `null` (vs. "leave unchanged", the default).
class _Unset {
  const _Unset();
}

const _unset = _Unset();

/// Mirrors the `Territory` DTO from `apps/web/types/territory.ts`, with an
/// added `boundary`/`centroid` pair — on the real API those are fetched
/// separately via `GET /territories/:id/boundary`, but for this map-first
/// screen we keep the geometry alongside the rest of the fields.
class Territory {
  final String id;
  final String name;
  final String slug;
  final String code;
  final TerritoryType territoryType;
  final String sectorId;
  final String? managerTerritoryId;
  final bool isActive;
  final int clinicCount;
  final int assignedUserCount;
  final int? repPatchCount;
  final TerritoryGeometry boundary;
  final MapCoordinate centroid;

  /// Id of the manager/rep currently assigned to this territory, if any —
  /// resolve via `UserRepository.getUserById` (or `userByIdProvider`) to
  /// display a name/avatar. `null` means unassigned. On the real API this
  /// is a many-to-many join table; the mock model simplifies it to one
  /// assignee per territory.
  final String? assignedUserId;

  const Territory({
    required this.id,
    required this.name,
    required this.slug,
    required this.code,
    required this.territoryType,
    required this.sectorId,
    this.managerTerritoryId,
    this.isActive = true,
    this.clinicCount = 0,
    this.assignedUserCount = 0,
    this.repPatchCount,
    required this.boundary,
    required this.centroid,
    this.assignedUserId,
  });

  /// Builds a [Territory] from a `territory-crud.use-cases.ts`
  /// `serializeTerritory` row (as returned by
  /// `GET/POST/PATCH /territory/territories[...]`) plus the boundary/
  /// centroid/assignee, each fetched separately on the real API — see
  /// `HttpTerritoryRepository`.
  factory Territory.fromApiRow(
    Map<String, dynamic> json, {
    required TerritoryGeometry boundary,
    required MapCoordinate centroid,
    String? assignedUserId,
  }) {
    return Territory(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      code: json['code'] as String,
      territoryType: TerritoryType.fromJson(
        json['territoryType'] as Map<String, dynamic>,
      ),
      sectorId: json['sectorId'] as String? ?? '',
      managerTerritoryId: json['managerTerritoryId'] as String?,
      isActive: json['isActive'] as bool? ?? true,
      clinicCount: (json['clinicCount'] as num?)?.toInt() ?? 0,
      assignedUserCount: (json['assignedUserCount'] as num?)?.toInt() ?? 0,
      repPatchCount: (json['repPatchCount'] as num?)?.toInt(),
      boundary: boundary,
      centroid: centroid,
      assignedUserId: assignedUserId,
    );
  }

  TerritoryKind get kind => territoryType.kind;

  Territory copyWith({
    String? name,
    String? sectorId,
    bool? isActive,
    TerritoryGeometry? boundary,
    MapCoordinate? centroid,
    Object? managerTerritoryId = _unset,
    Object? assignedUserId = _unset,
    int? repPatchCount,
  }) {
    return Territory(
      id: id,
      name: name ?? this.name,
      slug: slug,
      code: code,
      territoryType: territoryType,
      sectorId: sectorId ?? this.sectorId,
      managerTerritoryId: identical(managerTerritoryId, _unset)
          ? this.managerTerritoryId
          : managerTerritoryId as String?,
      isActive: isActive ?? this.isActive,
      clinicCount: clinicCount,
      assignedUserCount: assignedUserCount,
      repPatchCount: repPatchCount ?? this.repPatchCount,
      boundary: boundary ?? this.boundary,
      centroid: centroid ?? this.centroid,
      assignedUserId: identical(assignedUserId, _unset)
          ? this.assignedUserId
          : assignedUserId as String?,
    );
  }
}
