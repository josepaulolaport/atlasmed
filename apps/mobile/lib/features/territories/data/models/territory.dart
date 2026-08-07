import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart'
    show TerritoryGeometry;
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
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
  final int id;
  final String name;
  final String slug;
  final String code;
  final int verticalId;
  final TerritoryType territoryType;
  final int? managerTerritoryId;
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
  final int? assignedUserId;

  const Territory({
    required this.id,
    required this.name,
    required this.slug,
    required this.code,
    required this.verticalId,
    required this.territoryType,
    this.managerTerritoryId,
    this.isActive = true,
    this.clinicCount = 0,
    this.assignedUserCount = 0,
    this.repPatchCount,
    required this.boundary,
    required this.centroid,
    this.assignedUserId,
  });

  factory Territory.fromApiRow(
    Map<String, dynamic> json, {
    required TerritoryGeometry boundary,
    required MapCoordinate centroid,
    int? assignedUserId,
  }) {
    return Territory(
      id: readCrmId(json['id'], 'id'),
      name: json['name'] as String,
      slug: json['slug'] as String,
      code: json['code'] as String,
      verticalId: readCrmId(json['verticalId'], 'verticalId'),
      territoryType: TerritoryType.fromJson(
        json['territoryType'] as Map<String, dynamic>,
      ),
      managerTerritoryId: readCrmIdOrNull(json['managerTerritoryId'], 'managerTerritoryId'),
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
    int? verticalId,
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
      verticalId: verticalId ?? this.verticalId,
      territoryType: territoryType,
      managerTerritoryId: identical(managerTerritoryId, _unset)
          ? this.managerTerritoryId
          : managerTerritoryId as int?,
      isActive: isActive ?? this.isActive,
      clinicCount: clinicCount,
      assignedUserCount: assignedUserCount,
      repPatchCount: repPatchCount ?? this.repPatchCount,
      boundary: boundary ?? this.boundary,
      centroid: centroid ?? this.centroid,
      assignedUserId: identical(assignedUserId, _unset)
          ? this.assignedUserId
          : assignedUserId as int?,
    );
  }
}
