import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/users_filter.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/mock_users_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late MockUsersRepository repository;

  setUp(() => repository = MockUsersRepository());

  group('getUsers', () {
    test('paginates results', () async {
      final page1 = await repository.getUsers(page: 1, limit: 5);
      expect(page1.items.length, 5);
      expect(page1.page, 1);
      expect(page1.hasMore, isTrue);

      final page2 = await repository.getUsers(page: 2, limit: 5);
      expect(page2.items.length, 5);
      expect(
        page1.items.map((u) => u.id).toSet(),
        isNot(containsAll(page2.items.map((u) => u.id))),
      );
    });

    test('filters by role', () async {
      final result = await repository.getUsers(
        page: 1,
        limit: 50,
        role: UserRoleName.manager,
      );
      expect(result.items, isNotEmpty);
      expect(
        result.items.every((u) => u.role.name == UserRoleName.manager),
        isTrue,
      );
    });

    test('filters by status', () async {
      final result = await repository.getUsers(
        page: 1,
        limit: 50,
        status: UserStatus.suspended,
      );
      expect(result.items, isNotEmpty);
      expect(
        result.items.every((u) => u.status == UserStatus.suspended),
        isTrue,
      );
    });

    test('filters by a case-insensitive search term', () async {
      final result = await repository.getUsers(
        page: 1,
        limit: 50,
        search: 'camila',
      );
      expect(result.items.length, 1);
      expect(result.items.first.username, 'camila.rocha');
    });

    test('sorts by name ascending', () async {
      final result = await repository.getUsers(
        page: 1,
        limit: 50,
        sortBy: UsersSortBy.name,
        sortDir: UsersSortDir.asc,
      );
      final names = result.items
          .map((u) => u.displayName.toLowerCase())
          .toList();
      final sorted = [...names]..sort();
      expect(names, sorted);
    });

    test('sorts by status ascending', () async {
      final result = await repository.getUsers(
        page: 1,
        limit: 50,
        sortBy: UsersSortBy.status,
        sortDir: UsersSortDir.asc,
      );
      final statuses = result.items.map((u) => u.status.name).toList();
      final sorted = [...statuses]..sort();
      expect(statuses, sorted);
    });
  });

  group('getUserById', () {
    test('returns the matching user', () async {
      final user = await repository.getUserById('user-fernanda-duarte');
      expect(user, isNotNull);
      expect(user!.firstName, 'Fernanda');
    });

    test('returns null for an unknown id', () async {
      final user = await repository.getUserById('user-does-not-exist');
      expect(user, isNull);
    });
  });

  group('lifecycle actions', () {
    test('activateUser sets status to active', () async {
      await repository.activateUser('user-juliana-pires');
      final user = await repository.getUserById('user-juliana-pires');
      expect(user!.status, UserStatus.active);
    });

    test('deactivateUser sets status to inactive', () async {
      await repository.deactivateUser('user-bruno-castro');
      final user = await repository.getUserById('user-bruno-castro');
      expect(user!.status, UserStatus.inactive);
    });

    test('suspendUser then unsuspendUser round-trips through active', () async {
      await repository.suspendUser('user-bruno-castro');
      expect(
        (await repository.getUserById('user-bruno-castro'))!.status,
        UserStatus.suspended,
      );

      await repository.unsuspendUser('user-bruno-castro');
      expect(
        (await repository.getUserById('user-bruno-castro'))!.status,
        UserStatus.active,
      );
    });
  });

  test('changeUserRole updates the user role', () async {
    await repository.changeUserRole('user-diego-farias', 'role-manager');
    final user = await repository.getUserById('user-diego-farias');
    expect(user!.role.name, UserRoleName.manager);
  });

  group('assignments', () {
    test('getUserAssignments returns a seeded assignment', () async {
      final assignments = await repository.getUserAssignments(
        'user-bruno-castro',
      );
      expect(assignments.managerName, 'Fernanda Duarte');
      expect(assignments.territories, isNotEmpty);
      expect(assignments.isOperationallyActive, isTrue);
    });

    test('getUserAssignments defaults to empty for an unseeded user', () async {
      final assignments = await repository.getUserAssignments(
        'user-igor-santana',
      );
      expect(assignments.managers, isEmpty);
      expect(assignments.managerName, isNull);
      expect(assignments.territories, isEmpty);
      expect(assignments.isOperationallyActive, isFalse);
    });

    test(
      'assignTerritory adds a territory and revokeTerritory removes it',
      () async {
        const userId = 'user-igor-santana';
        await repository.assignTerritory(userId, 'territory-centro-onco-d');
        var assignments = await repository.getUserAssignments(userId);
        expect(
          assignments.territories.map((t) => t.territoryId),
          contains('territory-centro-onco-d'),
        );
        expect(assignments.isOperationallyActive, isTrue);

        await repository.revokeTerritory(userId, 'territory-centro-onco-d');
        assignments = await repository.getUserAssignments(userId);
        expect(assignments.territories, isEmpty);
        expect(assignments.isOperationallyActive, isFalse);
      },
    );

    test(
      'assignManager is a no-op (manager link is territory-derived)',
      () async {
        const userId = 'user-igor-santana';
        await repository.assignManager(userId, 'user-marcos-lima');
        final assignments = await repository.getUserAssignments(userId);
        expect(assignments.managers, isEmpty);
        expect(assignments.managerName, isNull);
      },
    );

    test(
      'getUserAssignments seeds carry sector and map geometry for the map cards',
      () async {
        final assignments = await repository.getUserAssignments(
          'user-bruno-castro',
        );
        final territory = assignments.territories.single;
        expect(territory.verticalName, 'Oncologia');
        expect(territory.centroid, isNotNull);
        expect(territory.boundary, isNotNull);
      },
    );

    test(
      'assignTerritory carries sector and map geometry from the option',
      () async {
        const userId = 'user-igor-santana';
        await repository.assignTerritory(userId, 'territory-centro-onco-d');
        final assignments = await repository.getUserAssignments(userId);
        final territory = assignments.territories.single;
        expect(territory.verticalName, 'Oncologia');
        expect(territory.centroid, isNotNull);
        expect(territory.boundary, isNotNull);
      },
    );

    test(
      'getTerritoriesForManager returns only patches under that manager zone',
      () async {
        final scope = await repository.getTerritoriesForManager(
          'user-fernanda-duarte',
        );
        expect(scope.managerName, 'Fernanda Duarte');
        expect(scope.managerTerritoryName, 'Zona Sul');
        expect(scope.managerZoneBoundary, isNotNull);
        expect(scope.territories, isNotEmpty);
        expect(
          scope.territories.every(
            (t) => t.managerTerritoryId == scope.managerTerritoryId,
          ),
          isTrue,
        );

        final allZones = await repository.getTerritoryOptions();
        expect(allZones, isNotEmpty);
        expect(allZones.every((z) => z.managerTerritoryId == null), isTrue);
        expect(scope.territories, isNotEmpty);
      },
    );

    test(
      'getTerritoriesForManager filters by sector when verticalId is set',
      () async {
        final scope = await repository.getTerritoriesForManager(
          'user-fernanda-duarte',
          verticalId: 'sector-oncologia',
        );
        expect(scope.territories, isNotEmpty);
        expect(
          scope.territories.every((t) => t.verticalId == 'sector-oncologia'),
          isTrue,
        );
      },
    );

    test(
      'getManagerOptions filters by sector when verticalId is set',
      () async {
        final managers = await repository.getManagerOptions(
          verticalId: 'sector-cardiologia',
        );
        expect(managers, isNotEmpty);
        expect(
          managers.every((m) => m.verticalIds.contains('sector-cardiologia')),
          isTrue,
        );
        expect(managers.any((m) => m.id == 'user-eduardo-alves'), isTrue);
        expect(managers.any((m) => m.id == 'user-renata-souza'), isFalse);
      },
    );

    test(
      'replaceVerticalAssignments replaces the full invite-shaped payload',
      () async {
        await repository.replaceVerticalAssignments('user-bruno-castro', const [
          InviteVerticalAssignment(
            verticalId: 'sector-oncologia',
            verticalName: 'Oncologia',
            managerDisplayName: 'Fernanda Duarte',
            managers: [
              AssignmentManagerRef(
                id: 'user-fernanda-duarte',
                name: 'Fernanda Duarte',
              ),
            ],
            territories: [],
          ),
          InviteVerticalAssignment(
            verticalId: 'sector-cardiologia',
            verticalName: 'Cardiologia',
            managerDisplayName: 'Fernanda Duarte',
            managers: [
              AssignmentManagerRef(
                id: 'user-fernanda-duarte',
                name: 'Fernanda Duarte',
              ),
            ],
            territories: [],
          ),
        ]);
        final assignments = await repository.getUserAssignments(
          'user-bruno-castro',
        );
        expect(assignments.verticalAssignments, hasLength(2));
        expect(assignments.isOperationallyActive, isFalse);
      },
    );
  });

  test('updateUserProfile updates identity fields', () async {
    final updated = await repository.updateUserProfile(
      userId: 'user-bruno-castro',
      firstName: 'Bruno',
      lastName: 'Atualizado',
      email: 'bruno.atualizado@atlasmed.com.br',
      phoneNumber: '+55 11 90000-0000',
      username: 'bruno.atualizado',
      birthDate: DateTime(1994, 9, 18),
    );
    expect(updated.lastName, 'Atualizado');
    expect(updated.email, 'bruno.atualizado@atlasmed.com.br');
    expect(updated.username, 'bruno.atualizado');

    final fetched = await repository.getUserById('user-bruno-castro');
    expect(fetched!.lastName, 'Atualizado');
  });

  group('permissions', () {
    test('getUserPermissions returns seeded grants', () async {
      final grants = await repository.getUserPermissions('user-diego-farias');
      expect(grants, isNotEmpty);
      expect(grants.first.resource, 'FACILITY');
    });

    test(
      'grantPermission adds a grant and revokePermission removes it',
      () async {
        const userId = 'user-igor-santana';
        await repository.grantPermission(
          userId,
          resource: 'TERRITORY',
          action: 'read',
        );
        var grants = await repository.getUserPermissions(userId);
        expect(grants, hasLength(1));

        await repository.revokePermission(
          userId,
          resource: grants.first.resource,
          action: grants.first.action,
          resourceId: grants.first.resourceId,
        );
        grants = await repository.getUserPermissions(userId);
        expect(grants, isEmpty);
      },
    );
  });
}
