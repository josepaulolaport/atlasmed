import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart'
    show TerritoryGeometry;
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';

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

  /// Name of the manager/rep currently assigned to this territory, if any.
  /// `null` means unassigned.
  final String? assignedUserName;

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
    this.assignedUserName,
  });

  TerritoryKind get kind => territoryType.kind;
}
