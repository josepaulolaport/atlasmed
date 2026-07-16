import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart'
    show TerritoryGeometry;
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_draft.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/mock_territory_repository.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/mock_user_repository.dart';
import 'package:flutter_test/flutter_test.dart';

TerritoryGeometry _square({double offset = 0}) {
  final ring = [
    MapCoordinate(longitude: offset, latitude: offset),
    MapCoordinate(longitude: offset + 1, latitude: offset),
    MapCoordinate(longitude: offset + 1, latitude: offset + 1),
    MapCoordinate(longitude: offset, latitude: offset + 1),
  ];
  return TerritoryGeometry.polygon([[...ring, ring.first]]);
}

void main() {
  late MockTerritoryRepository repository;

  setUp(() => repository = MockTerritoryRepository(MockUserRepository()));

  group('createTerritory', () {
    test('generates an id/slug/code and stores the new territory', () async {
      final before = await repository.getTerritories(
        territoryTypeSlug: 'manager_zone',
        sectorId: 'sector-oncologia',
      );

      final created = await repository.createTerritory(
        const TerritoryDraft(
          name: 'Zona Nova',
          kind: TerritoryKind.managerZone,
          sectorId: 'sector-oncologia',
        ),
        _square(),
        const MapCoordinate(longitude: 0.5, latitude: 0.5),
      );

      expect(created.id, isNotEmpty);
      expect(created.slug, isNotEmpty);
      expect(created.code, isNotEmpty);
      expect(created.name, 'Zona Nova');
      expect(created.kind, TerritoryKind.managerZone);
      expect(created.sectorId, 'sector-oncologia');

      final after = await repository.getTerritories(
        territoryTypeSlug: 'manager_zone',
        sectorId: 'sector-oncologia',
      );
      expect(after.length, before.length + 1);
      expect(after.any((t) => t.id == created.id), isTrue);
    });

    test(
      "bumps the parent manager zone's repPatchCount when creating a rep "
      'patch under it',
      () async {
        final zones = await repository.getTerritories(
          territoryTypeSlug: 'manager_zone',
          sectorId: 'sector-oncologia',
        );
        final zone = zones.first;
        final countBefore = zone.repPatchCount ?? 0;

        await repository.createTerritory(
          TerritoryDraft(
            name: 'Área Nova',
            kind: TerritoryKind.repPatch,
            sectorId: 'sector-oncologia',
            managerTerritoryId: zone.id,
          ),
          _square(),
          const MapCoordinate(longitude: 0.5, latitude: 0.5),
        );

        final updatedZone = await repository.getTerritoryById(zone.id);
        expect(updatedZone!.repPatchCount, countBefore + 1);
      },
    );

    test('never sets an assignee — that is always a separate step', () async {
      final created = await repository.createTerritory(
        const TerritoryDraft(
          name: 'Zona Sem Gerente',
          kind: TerritoryKind.managerZone,
          sectorId: 'sector-oncologia',
        ),
        _square(offset: 2),
        const MapCoordinate(longitude: 2.5, latitude: 2.5),
      );
      expect(created.assignedUserId, isNull);
    });
  });

  group('assignUser', () {
    test('sets the territory assignedUserId', () async {
      final zones = await repository.getTerritories(
        territoryTypeSlug: 'manager_zone',
        sectorId: 'sector-oncologia',
      );
      final zone = zones.first;

      await repository.assignUser(zone.id, 'user-fernanda-duarte');

      final updated = await repository.getTerritoryById(zone.id);
      expect(updated!.assignedUserId, 'user-fernanda-duarte');
    });

    test('clears the assignment when passed null', () async {
      final zones = await repository.getTerritories(
        territoryTypeSlug: 'manager_zone',
        sectorId: 'sector-oncologia',
      );
      final zone = zones.first;
      await repository.assignUser(zone.id, 'user-fernanda-duarte');

      await repository.assignUser(zone.id, null);

      final updated = await repository.getTerritoryById(zone.id);
      expect(updated!.assignedUserId, isNull);
    });
  });

  group('updateTerritoryInfo', () {
    test('updates name, sector, active status and manager territory', () async {
      final patches = await repository.getTerritories(
        territoryTypeSlug: 'patch',
        sectorId: 'sector-oncologia',
      );
      final patch = patches.first;
      final otherZoneId = patch.managerTerritoryId == 'territory-zone-onco-oeste'
          ? 'territory-zone-onco-sudeste'
          : 'territory-zone-onco-oeste';

      await repository.updateTerritoryInfo(
        patch.id,
        name: 'Nome Atualizado',
        sectorId: 'sector-oncologia',
        isActive: false,
        managerTerritoryId: otherZoneId,
      );

      final updated = await repository.getTerritoryById(patch.id);
      expect(updated!.name, 'Nome Atualizado');
      expect(updated.isActive, isFalse);
      expect(updated.managerTerritoryId, otherZoneId);
    });
  });

  group('getAssignableManagers', () {
    test(
      'returns only managers assigned to an active manager-zone territory '
      'in the given sector',
      () async {
        final zones = await repository.getTerritories(
          territoryTypeSlug: 'manager_zone',
          sectorId: 'sector-oncologia',
        );
        final zone = zones.first;
        await repository.assignUser(zone.id, 'user-fernanda-duarte');

        final managers = await repository.getAssignableManagers(
          'sector-oncologia',
        );

        expect(managers, isNotEmpty);
        expect(
          managers.any(
            (m) =>
                m.manager.id == 'user-fernanda-duarte' &&
                m.zoneTerritoryId == zone.id,
          ),
          isTrue,
        );
      },
    );

    test('excludes zones from a different sector', () async {
      final oncoZones = await repository.getTerritories(
        territoryTypeSlug: 'manager_zone',
        sectorId: 'sector-oncologia',
      );
      await repository.assignUser(oncoZones.first.id, 'user-fernanda-duarte');

      final cardioManagers = await repository.getAssignableManagers(
        'sector-cardiologia',
      );

      expect(
        cardioManagers.any((m) => m.manager.id == 'user-fernanda-duarte'),
        isFalse,
      );
    });

    test('excludes an inactive manager zone', () async {
      final zones = await repository.getTerritories(
        territoryTypeSlug: 'manager_zone',
        sectorId: 'sector-oncologia',
      );
      final zone = zones.first;
      await repository.assignUser(zone.id, 'user-fernanda-duarte');
      await repository.updateTerritoryInfo(
        zone.id,
        name: zone.name,
        sectorId: zone.sectorId,
        isActive: false,
      );

      final managers = await repository.getAssignableManagers(
        'sector-oncologia',
      );

      expect(
        managers.any((m) => m.zoneTerritoryId == zone.id),
        isFalse,
      );
    });
  });

  group('deleteTerritory', () {
    test('removes the territory', () async {
      final zones = await repository.getTerritories(
        territoryTypeSlug: 'manager_zone',
        sectorId: 'sector-oncologia',
      );
      final zone = zones.first;

      await repository.deleteTerritory(zone.id);

      expect(await repository.getTerritoryById(zone.id), isNull);
    });

    test(
      'orphans (rather than cascade-deletes) rep patches under a deleted '
      'manager zone',
      () async {
        final zones = await repository.getTerritories(
          territoryTypeSlug: 'manager_zone',
          sectorId: 'sector-oncologia',
        );
        final zone = zones.first;
        final patchesBefore = await repository.getTerritories(
          territoryTypeSlug: 'patch',
          sectorId: 'sector-oncologia',
        );
        final orphanedIds = patchesBefore
            .where((p) => p.managerTerritoryId == zone.id)
            .map((p) => p.id)
            .toList();
        expect(orphanedIds, isNotEmpty);

        await repository.deleteTerritory(zone.id);

        for (final id in orphanedIds) {
          final patch = await repository.getTerritoryById(id);
          expect(patch, isNotNull);
          expect(patch!.managerTerritoryId, isNull);
        }
      },
    );
  });
}
