import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:equatable/equatable.dart';

/// Slim `{id, name}` view models for assignment pickers (manager, territory,
/// sector). These intentionally don't reuse the full territories-feature
/// models (`Sector`, `Territory`) — the "manage assignments" sheet only
/// ever needs an id to submit and a name to display, so a leaner shape
/// keeps this feature decoupled from the territories feature.
///
/// [TerritoryOption] borrows [MapCoordinate]/[TerritoryGeometry] — plain
/// geometry primitives shared with the map/territories features — purely so
/// the small map preview on a user's assigned-territory card has something
/// to render. That's the one exception to "id + name only" here.
class ManagerOption extends Equatable {
  const ManagerOption({required this.id, required this.name});

  final String id;
  final String name;

  factory ManagerOption.fromJson(Map<String, dynamic> json) =>
      ManagerOption(id: json['id'] as String, name: json['name'] as String);

  @override
  List<Object?> get props => [id, name];
}

class TerritoryOption extends Equatable {
  const TerritoryOption({
    required this.id,
    required this.name,
    this.sectorId,
    this.sectorName,
    this.centroid,
    this.boundary,
  });

  final String id;
  final String name;
  final String? sectorId;
  final String? sectorName;
  final MapCoordinate? centroid;
  final TerritoryGeometry? boundary;

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
      );

  @override
  List<Object?> get props => [
    id,
    name,
    sectorId,
    sectorName,
    centroid,
    boundary,
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
