import 'package:atlasmed_mobile_app/features/territories/data/mock/mock_territories_data.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/sector.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/territory_repository.dart';

/// In-memory [TerritoryRepository] backed by the static mock dataset.
///
/// Simulates network latency so loading states can be exercised while the
/// screen isn't wired to the real API yet.
class MockTerritoryRepository implements TerritoryRepository {
  @override
  Future<List<Sector>> getSectors() async {
    await Future.delayed(const Duration(milliseconds: 250));
    return mockSectors;
  }

  @override
  Future<List<Territory>> getTerritories({
    required String territoryTypeSlug,
    required String sectorId,
  }) async {
    await Future.delayed(const Duration(milliseconds: 350));
    return mockTerritories
        .where(
          (territory) =>
              territory.territoryType.slug == territoryTypeSlug &&
              territory.sectorId == sectorId,
        )
        .toList();
  }

  @override
  Future<Territory?> getTerritoryById(String id) async {
    await Future.delayed(const Duration(milliseconds: 100));
    for (final territory in mockTerritories) {
      if (territory.id == id) return territory;
    }
    return null;
  }
}
