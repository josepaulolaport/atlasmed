import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart'
    show TerritoryGeometry;
import 'package:atlasmed_mobile_app/features/territories/data/models/assignable_manager.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/boundary_impact.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_draft.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/unassigned_facility.dart';

/// Port for the territories data source.
abstract interface class TerritoryRepository {
  Future<List<BusinessVertical>> getVerticals();

  Future<List<Territory>> getTerritories({
    required String territoryTypeSlug,
    int? verticalId,
  });

  Future<Territory?> getTerritoryById(int id);

  /// Spec 0006: clinics that need deassign accept before geometry save.
  Future<BoundaryImpactPreview> previewBoundaryImpact(
    int id,
    TerritoryGeometry geometry,
  );

  Future<void> updateTerritoryGeometry(
    int id,
    TerritoryGeometry geometry, {
    List<int>? acceptedFacilityIds,
  });

  Future<Territory> createTerritory(
    TerritoryDraft draft,
    TerritoryGeometry boundary,
    MapCoordinate centroid,
  );

  Future<void> deleteTerritory(int id);

  Future<void> assignUser(int territoryId, int? userId);

  Future<void> updateTerritoryInfo(
    int territoryId, {
    required String name,
    required bool isActive,
    int? managerTerritoryId,
  });

  Future<List<AssignableManager>> getAssignableManagers({int? verticalId});

  /// Spec 0006: clinics in manager zones without a primary consultant.
  Future<List<UnassignedFacility>> listUnassignedFacilities({
    int? managerZoneId,
    int page = 1,
    int limit = 50,
  });
}
