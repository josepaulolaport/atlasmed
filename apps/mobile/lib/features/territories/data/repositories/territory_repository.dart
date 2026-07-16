import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart'
    show TerritoryGeometry;
import 'package:atlasmed_mobile_app/features/territories/data/models/sector.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';

/// Port for the territories data source.
///
/// Method signatures mirror the real endpoints (`GET /sectors`,
/// `GET /territories?type=&sectorId=`) so a future HTTP-backed
/// implementation is a drop-in replacement for [MockTerritoryRepository].
abstract interface class TerritoryRepository {
  Future<List<Sector>> getSectors();

  Future<List<Territory>> getTerritories({
    required String territoryTypeSlug,
    required String sectorId,
  });

  /// Used by the detail sheet to resolve a rep patch's parent manager zone
  /// name (`Territory.managerTerritoryId`).
  Future<Territory?> getTerritoryById(String id);

  /// Persists an edited boundary from the territory geometry editor. On the
  /// real API this will be `PUT /territories/:id/boundary`; the mock
  /// implementation mutates its in-memory copy instead.
  Future<void> updateTerritoryGeometry(String id, TerritoryGeometry geometry);
}
