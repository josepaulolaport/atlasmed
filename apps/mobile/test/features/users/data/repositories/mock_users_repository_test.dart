import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
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
      expect(assignments.managerId, isNull);
      expect(assignments.territories, isEmpty);
      expect(assignments.isOperationallyActive, isFalse);
    });

    test(
      'assignTerritory adds a territory and revokeTerritory removes it',
      () async {
        const userId = 'user-igor-santana';
        await repository.assignTerritory(userId, 'territory-centro-onco');
        var assignments = await repository.getUserAssignments(userId);
        expect(
          assignments.territories.map((t) => t.territoryId),
          contains('territory-centro-onco'),
        );
        expect(assignments.isOperationallyActive, isTrue);

        await repository.revokeTerritory(userId, 'territory-centro-onco');
        assignments = await repository.getUserAssignments(userId);
        expect(assignments.territories, isEmpty);
        expect(assignments.isOperationallyActive, isFalse);
      },
    );

    test(
      'assignManager sets manager and assignManager(null) clears it',
      () async {
        const userId = 'user-igor-santana';
        await repository.assignManager(userId, 'user-marcos-lima');
        var assignments = await repository.getUserAssignments(userId);
        expect(assignments.managerName, 'Marcos Lima');

        await repository.assignManager(userId, null);
        assignments = await repository.getUserAssignments(userId);
        expect(assignments.managerId, isNull);
      },
    );

    test('assignManager rejects a non-rep target', () async {
      // user-fernanda-duarte is a manager — only reps can have a manager.
      expect(
        () => repository.assignManager(
          'user-fernanda-duarte',
          'user-marcos-lima',
        ),
        throwsStateError,
      );
    });

    test(
      'getUserAssignments seeds carry sector and map geometry for the map cards',
      () async {
        final assignments = await repository.getUserAssignments(
          'user-bruno-castro',
        );
        final territory = assignments.territories.single;
        expect(territory.sectorName, 'Oncologia');
        expect(territory.centroid, isNotNull);
        expect(territory.boundary, isNotNull);
      },
    );

    test(
      'assignTerritory carries sector and map geometry from the option',
      () async {
        const userId = 'user-igor-santana';
        await repository.assignTerritory(userId, 'territory-centro-onco');
        final assignments = await repository.getUserAssignments(userId);
        final territory = assignments.territories.single;
        expect(territory.sectorName, 'Oncologia');
        expect(territory.centroid, isNotNull);
        expect(territory.boundary, isNotNull);
      },
    );
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

        await repository.revokePermission(userId, grants.first.id);
        grants = await repository.getUserPermissions(userId);
        expect(grants, isEmpty);
      },
    );
  });
}
