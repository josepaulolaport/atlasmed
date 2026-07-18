import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:equatable/equatable.dart';

/// Slim view models for assignment pickers (manager, territory, sector).
/// These intentionally don't reuse the full territories-feature models —
/// the invite / manage-assignments flows only need enough to submit an id
/// and render a name (plus geometry for map previews).
class ManagerOption extends Equatable {
  const ManagerOption({
    required this.id,
    required this.name,
    this.avatarUrl,
    this.territoryId,
    this.territoryName,
    this.territoryCentroid,
    this.territoryBoundary,
    this.sectorIds = const [],
  });

  final String id;
  final String name;

  /// Optional avatar URL — when null the picker falls back to initials.
  final String? avatarUrl;

  /// Manager-zone territory this manager owns, if any. Used to filter
  /// selectable REP patches to those nested under this zone.
  final String? territoryId;

  /// Display name of [territoryId].
  final String? territoryName;

  /// Geometry of the manager zone — used to outline the parent area when
  /// picking a REP patch inside it.
  final MapCoordinate? territoryCentroid;
  final TerritoryGeometry? territoryBoundary;

  /// Sectors this manager operates in — invite manager pickers are scoped
  /// per sector via `GET /access/users?role=MANAGER&sectorId=`.
  final List<String> sectorIds;

  factory ManagerOption.fromJson(Map<String, dynamic> json) => ManagerOption(
    id: json['id'] as String,
    name: json['name'] as String,
    avatarUrl: json['avatarUrl'] as String?,
    territoryId: json['territoryId'] as String?,
    territoryName: json['territoryName'] as String?,
    territoryCentroid: json['territoryCentroid'] == null
        ? null
        : MapCoordinate(
            longitude: (json['territoryCentroid']['longitude'] as num)
                .toDouble(),
            latitude: (json['territoryCentroid']['latitude'] as num)
                .toDouble(),
          ),
    territoryBoundary: json['territoryBoundary'] == null
        ? null
        : TerritoryGeometry.fromGeoJson(
            json['territoryBoundary'] as Map<String, dynamic>,
          ),
    sectorIds: (json['sectorIds'] as List<dynamic>?)
            ?.map((e) => e as String)
            .toList(growable: false) ??
        const [],
  );

  @override
  List<Object?> get props => [
    id,
    name,
    avatarUrl,
    territoryId,
    territoryName,
    territoryCentroid,
    territoryBoundary,
    sectorIds,
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

  final String managerId;
  final String managerName;
  final String? managerTerritoryId;
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
    this.sectorId,
    this.sectorName,
    this.centroid,
    this.boundary,
    this.isOccupied = false,
    this.assignedUserName,
    this.managerTerritoryId,
  });

  final String id;
  final String name;
  final String? sectorId;
  final String? sectorName;
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
  final String? managerTerritoryId;

  factory TerritoryOption.fromJson(Map<String, dynamic> json) =>
      TerritoryOption(
        id: json['id'] as String,
        name: json['name'] as String,
        sectorId: json['sectorId'] as String?,
        sectorName: json['sectorName'] as String?,
        centroid: json['centroid'] == null
            ? null
            : MapCoordinate(
                longitude: (json['centroid']['longitude'] as num).toDouble(),
                latitude: (json['centroid']['latitude'] as num).toDouble(),
              ),
        boundary: json['boundary'] == null
            ? null
            : TerritoryGeometry.fromGeoJson(
                json['boundary'] as Map<String, dynamic>,
              ),
        isOccupied: json['isOccupied'] as bool? ?? false,
        assignedUserName: json['assignedUserName'] as String?,
        managerTerritoryId: json['managerTerritoryId'] as String?,
      );

  @override
  List<Object?> get props => [
    id,
    name,
    sectorId,
    sectorName,
    centroid,
    boundary,
    isOccupied,
    assignedUserName,
    managerTerritoryId,
  ];
}

class SectorOption extends Equatable {
  const SectorOption({required this.id, required this.name});

  final String id;
  final String name;

  factory SectorOption.fromJson(Map<String, dynamic> json) =>
      SectorOption(id: json['id'] as String, name: json['name'] as String);

  @override
  List<Object?> get props => [id, name];
}
