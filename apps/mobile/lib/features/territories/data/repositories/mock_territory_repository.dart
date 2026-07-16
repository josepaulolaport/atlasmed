import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart'
    show TerritoryGeometry;
import 'package:atlasmed_mobile_app/features/territories/data/mock/mock_territories_data.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/sector.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/territory_repository.dart';

/// In-memory [TerritoryRepository] backed by the static mock dataset.
///
/// Simulates network latency so loading states can be exercised while the
/// screen isn't wired to the real API yet. Holds its own mutable copy of
/// the seed data so edits made in the territory editor persist for the
/// app's session (the repository is a `Provider`, so one instance lives
/// as long as the app does) without touching the real backend yet.
class MockTerritoryRepository implements TerritoryRepository {
  final List<Territory> _territories = List<Territory>.of(mockTerritories);

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
    return _territories
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
    for (final territory in _territories) {
      if (territory.id == id) return territory;
    }
    return null;
  }

  @override
  Future<void> updateTerritoryGeometry(
    String id,
    TerritoryGeometry geometry,
  ) async {
    await Future.delayed(const Duration(milliseconds: 300));
    final index = _territories.indexWhere((territory) => territory.id == id);
    if (index == -1) return;
    final centroid = geometry.labelAnchor ?? _territories[index].centroid;
    _territories[index] = _territories[index].copyWith(
      boundary: geometry,
      centroid: centroid,
    );
  }
}
