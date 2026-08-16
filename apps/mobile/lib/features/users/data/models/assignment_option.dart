import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:equatable/equatable.dart';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

/// Slim view models for assignment pickers (manager, territory, sector).
/// These intentionally don't reuse the full territories-feature models —
/// the invite / manage-assignments flows only need enough to submit an id
/// and render a name (plus geometry for map previews).
class ManagerOption extends Equatable {
  const ManagerOption({
    required this.id,
    required this.name,
    this.avatarUrl,
    this.avatarBlurhash,
    this.territoryId,
    this.territoryName,
    this.territoryCentroid,
    this.territoryBoundary,
    this.verticalIds = const [],
  });

  final int id;
  final String name;

  /// Optional avatar URL — when null the picker falls back to initials.
  final String? avatarUrl;
  final String? avatarBlurhash;

  /// Manager-zone territory this manager owns, if any. Used to filter
  /// selectable REP patches to those nested under this zone.
  final int? territoryId;

  /// Display name of [territoryId].
  final String? territoryName;

  /// Geometry of the manager zone — used to outline the parent area when
  /// picking a REP patch inside it.
  final MapCoordinate? territoryCentroid;
  final TerritoryGeometry? territoryBoundary;

  /// Sectors this manager operates in — invite manager pickers are scoped
  /// per sector via `GET /access/users?role=MANAGER&verticalId=`.
  final List<int> verticalIds;

  factory ManagerOption.fromJson(Map<String, dynamic> json) => ManagerOption(
    id: readCrmId(json['id'], 'id'),
    name: json['name'] as String,
    avatarUrl: json['avatarUrl'] as String?,
    avatarBlurhash: json['avatarBlurhash'] as String?,
    territoryId: readCrmIdOrNull(json['territoryId'], 'territoryId'),
    territoryName: json['territoryName'] as String?,
    territoryCentroid: json['territoryCentroid'] == null
        ? null
        : MapCoordinate(
            longitude: (json['territoryCentroid']['longitude'] as num)
                .toDouble(),
            latitude: (json['territoryCentroid']['latitude'] as num).toDouble(),
          ),
    territoryBoundary: json['territoryBoundary'] == null
        ? null
        : TerritoryGeometry.tryFromGeoJson(
            json['territoryBoundary'] as Map<String, dynamic>,
          ),
    verticalIds: readCrmIdList(json['verticalIds'], 'verticalIds'),
  );

  @override
  List<Object?> get props => [
    id,
    name,
    avatarUrl,
    avatarBlurhash,
    territoryId,
    territoryName,
    territoryCentroid,
    territoryBoundary,
    verticalIds,
  ];
}

/// Result of `GET /territories?managerId=…` — selectable patches under a
/// manager zone, plus enough context to outline that zone on the map.
class ManagerTerritoryScope extends Equatable {
  const ManagerTerritoryScope({
    required this.managerId,
    required this.managerName,
    this.managerTerritoryId,
    this.managerTerritoryName,
    this.managerZoneCentroid,
    this.managerZoneBoundary,
    required this.territories,
  });

  final int managerId;
  final String managerName;
  final int? managerTerritoryId;
  final String? managerTerritoryName;
  final MapCoordinate? managerZoneCentroid;
  final TerritoryGeometry? managerZoneBoundary;
  final List<TerritoryOption> territories;

  @override
  List<Object?> get props => [
    managerId,
    managerName,
    managerTerritoryId,
    managerTerritoryName,
    managerZoneCentroid,
    managerZoneBoundary,
    territories,
  ];
}

class TerritoryOption extends Equatable {
  const TerritoryOption({
    required this.id,
    required this.name,
    this.verticalId,
    this.verticalName,
    this.centroid,
    this.boundary,
    this.isOccupied = false,
    this.assignedUserName,
    this.managerTerritoryId,
  });

  final int id;
  final String name;
  final int? verticalId;
  final String? verticalName;
  final MapCoordinate? centroid;
  final TerritoryGeometry? boundary;

  /// Whether another user already holds this territory.
  final bool isOccupied;

  /// Display name of the current assignee when [isOccupied] is true.
  final String? assignedUserName;

  /// Parent manager-zone id this patch sits inside. Null for manager zones
  /// themselves (or unparented territories). The API filters by this via
  /// `GET /territories?managerId=` ([ManagerTerritoryScope]); clients should
  /// not rely on local filtering of the full catalog for REP selection.
  final int? managerTerritoryId;

  factory TerritoryOption.fromJson(Map<String, dynamic> json) {
    final boundary = json['boundary'] == null
        ? null
        : TerritoryGeometry.tryFromGeoJson(
            json['boundary'] as Map<String, dynamic>,
          );
    return TerritoryOption(
      id: readCrmId(json['id'], 'id'),
      name: json['name'] as String,
      verticalId: readCrmIdOrNull(json['verticalId'], 'verticalId'),
      verticalName: json['verticalName'] as String?,
      // Falls back to the boundary's own anchor. `GET
      // /access/users/:id/assignments` sends the boundary and no centroid at
      // all, and the map card refuses to render without one — so every
      // territory minimap on the user detail screen was a grey placeholder
      // with the geometry sitting right there unused. The picker endpoints
      // already derive it the same way.
      centroid: json['centroid'] == null
          ? boundary?.labelAnchor
          : MapCoordinate(
              longitude: (json['centroid']['longitude'] as num).toDouble(),
              latitude: (json['centroid']['latitude'] as num).toDouble(),
            ),
      boundary: boundary,
      isOccupied: json['isOccupied'] as bool? ?? false,
      assignedUserName: json['assignedUserName'] as String?,
      managerTerritoryId: readCrmIdOrNull(
        json['managerTerritoryId'],
        'managerTerritoryId',
      ),
    );
  }

  @override
  List<Object?> get props => [
    id,
    name,
    verticalId,
    verticalName,
    centroid,
    boundary,
    isOccupied,
    assignedUserName,
    managerTerritoryId,
  ];
}

class VerticalOption extends Equatable {
  const VerticalOption({required this.id, required this.name});

  final int id;
  final String name;

  factory VerticalOption.fromJson(Map<String, dynamic> json) => VerticalOption(
    id: readCrmId(json['id'], 'id'),
    name: json['name'] as String,
  );

  @override
  List<Object?> get props => [id, name];
}
