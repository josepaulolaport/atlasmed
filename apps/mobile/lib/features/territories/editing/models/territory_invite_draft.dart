import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';

/// Validated patch geometry from the territory editor when
/// [TerritoryEditorTarget.confirmAsDraftOnly] is set — not persisted until
/// invite submit (`newPatch`).
class TerritoryInviteDraft {
  const TerritoryInviteDraft({
    required this.name,
    required this.verticalId,
    required this.managerTerritoryId,
    required this.boundary,
    required this.centroid,
  });

  final String name;
  final String verticalId;
  final String managerTerritoryId;
  final TerritoryGeometry boundary;
  final MapCoordinate centroid;

  Map<String, dynamic> toNewPatchJson() => {
    'name': name,
    'managerZoneId': managerTerritoryId,
    'boundary': boundary.toGeoJson(),
  };
}
