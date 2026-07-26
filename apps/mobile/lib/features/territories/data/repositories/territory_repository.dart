import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart'
    show TerritoryGeometry;
import 'package:atlasmed_mobile_app/features/territories/data/models/assignable_manager.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_draft.dart';

/// Port for the territories data source.
abstract interface class TerritoryRepository {
  Future<List<BusinessVertical>> getVerticals();

  Future<List<Territory>> getTerritories({
    required String territoryTypeSlug,
    String? verticalId,
  });

  Future<Territory?> getTerritoryById(String id);

  Future<void> updateTerritoryGeometry(String id, TerritoryGeometry geometry);

  Future<Territory> createTerritory(
    TerritoryDraft draft,
    TerritoryGeometry boundary,
    MapCoordinate centroid,
  );

  Future<void> deleteTerritory(String id);

  Future<void> assignUser(String territoryId, String? userId);

  Future<void> updateTerritoryInfo(
    String territoryId, {
    required String name,
    required bool isActive,
    String? managerTerritoryId,
  });

  Future<List<AssignableManager>> getAssignableManagers({String? verticalId});
}
