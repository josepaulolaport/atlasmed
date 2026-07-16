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
}
