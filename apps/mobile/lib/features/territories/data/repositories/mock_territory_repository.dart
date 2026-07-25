import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart'
    show TerritoryGeometry;
import 'package:atlasmed_mobile_app/features/territories/data/mock/mock_territories_data.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/assignable_manager.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_draft.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/territory_repository.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/user_repository.dart';

class MockTerritoryRepository implements TerritoryRepository {
  MockTerritoryRepository(this._userRepository);

  final UserRepository _userRepository;
  final List<Territory> _territories = List<Territory>.of(mockTerritories);

  @override
  Future<List<BusinessVertical>> getVerticals() async {
    await Future.delayed(const Duration(milliseconds: 250));
    return mockSectors;
  }

  @override
  Future<List<Territory>> getTerritories({
    required String territoryTypeSlug,
  }) async {
    await Future.delayed(const Duration(milliseconds: 350));
    return _territories
        .where((territory) => territory.territoryType.slug == territoryTypeSlug)
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

  @override
  Future<Territory> createTerritory(
    TerritoryDraft draft,
    TerritoryGeometry boundary,
    MapCoordinate centroid,
  ) async {
    await Future.delayed(const Duration(milliseconds: 300));

    final territoryType = draft.kind == TerritoryKind.managerZone
        ? managerZoneType
        : repPatchType;
    final suffix = DateTime.now().microsecondsSinceEpoch.toRadixString(36);
    final slug = '${_slugify(draft.name)}-$suffix';
    final prefix = draft.kind == TerritoryKind.managerZone ? 'zone' : 'patch';
    final id = 'territory-$prefix-$slug';

    final territory = Territory(
      id: id,
      name: draft.name,
      slug: slug,
      code: id.toUpperCase(),
      territoryType: territoryType,
      managerTerritoryId: draft.managerTerritoryId,
      repPatchCount: draft.kind == TerritoryKind.managerZone ? 0 : null,
      boundary: boundary,
      centroid: centroid,
    );

    _territories.add(territory);

    final managerId = draft.managerTerritoryId;
    if (managerId != null) {
      final zoneIndex = _territories.indexWhere((t) => t.id == managerId);
      if (zoneIndex != -1) {
        final zone = _territories[zoneIndex];
        _territories[zoneIndex] = zone.copyWith(
          repPatchCount: (zone.repPatchCount ?? 0) + 1,
        );
      }
    }

    return territory;
  }

  @override
  Future<void> deleteTerritory(String id) async {
    await Future.delayed(const Duration(milliseconds: 250));

    for (var i = 0; i < _territories.length; i++) {
      final territory = _territories[i];
      if (territory.managerTerritoryId == id) {
        _territories[i] = territory.copyWith(managerTerritoryId: null);
      }
    }

    _territories.removeWhere((territory) => territory.id == id);
  }

  @override
  Future<void> assignUser(String territoryId, String? userId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    final index = _territories.indexWhere((t) => t.id == territoryId);
    if (index == -1) return;
    _territories[index] = _territories[index].copyWith(assignedUserId: userId);
  }

  @override
  Future<void> updateTerritoryInfo(
    String territoryId, {
    required String name,
    required bool isActive,
    String? managerTerritoryId,
  }) async {
    await Future.delayed(const Duration(milliseconds: 250));
    final index = _territories.indexWhere((t) => t.id == territoryId);
    if (index == -1) return;
    _territories[index] = _territories[index].copyWith(
      name: name,
      isActive: isActive,
      managerTerritoryId: managerTerritoryId,
    );
  }

  @override
  Future<List<AssignableManager>> getAssignableManagers() async {
    await Future.delayed(const Duration(milliseconds: 200));
    final zones = _territories.where(
      (t) =>
          t.kind == TerritoryKind.managerZone &&
          t.isActive &&
          t.assignedUserId != null,
    );

    final result = <AssignableManager>[];
    for (final zone in zones) {
      final manager = await _userRepository.getUserById(zone.assignedUserId!);
      if (manager == null) continue;
      result.add(
        AssignableManager(
          manager: manager,
          zoneTerritoryId: zone.id,
          zoneName: zone.name,
        ),
      );
    }
    return result;
  }

  static String _slugify(String name) {
    final slug = name
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
        .replaceAll(RegExp(r'^-+|-+$'), '');
    return slug.isEmpty ? 'territorio' : slug;
  }
}
