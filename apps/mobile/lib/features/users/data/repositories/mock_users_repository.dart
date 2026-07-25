import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/users/data/mock/mock_assignment_options_data.dart';
import 'package:atlasmed_mobile_app/features/users/data/mock/mock_users_data.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/permission_grant.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/users_filter.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/users_page.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_repository.dart';

/// In-memory [UsersRepository] backed by the static mock dataset. Simulates
/// network latency so loading states can be exercised while the screen
/// isn't wired to the real API yet. Holds its own mutable copies of the
/// seed data so admin actions (role change, assignments, permissions,
/// lifecycle) persist for the app's session.
InviteVerticalAssignment _seededVerticalAssignment({
  required String verticalId,
  required String verticalName,
  String? managerId,
  String? managerName,
  required List<String> territoryIds,
}) {
  return InviteVerticalAssignment(
    verticalId: verticalId,
    verticalName: verticalName,
    managerId: managerId,
    managerName: managerName,
    territories: territoryIds
        .map((id) => mockTerritoryOptions.firstWhere((o) => o.id == id))
        .toList(),
  );
}

UserAssignments _seededAssignments({
  required String userId,
  required List<InviteVerticalAssignment> verticalAssignments,
}) {
  return UserAssignments(
    userId: userId,
    verticalAssignments: verticalAssignments,
    isOperationallyActive: verticalAssignments.any(
      (a) => a.territories.isNotEmpty,
    ),
  );
}

class MockUsersRepository implements UsersRepository {
  final List<User> _users = List<User>.of(mockUsers);
  final Map<String, UserAssignments> _assignments = {
    'user-bruno-castro': _seededAssignments(
      userId: 'user-bruno-castro',
      verticalAssignments: [
        _seededVerticalAssignment(
          verticalId: 'sector-oncologia',
          verticalName: 'Oncologia',
          managerId: 'user-fernanda-duarte',
          managerName: 'Fernanda Duarte',
          territoryIds: const ['territory-sul-onco-a'],
        ),
      ],
    ),
    'user-camila-rocha': _seededAssignments(
      userId: 'user-camila-rocha',
      verticalAssignments: [
        _seededVerticalAssignment(
          verticalId: 'sector-oncologia',
          verticalName: 'Oncologia',
          managerId: 'user-marcos-lima',
          managerName: 'Marcos Lima',
          territoryIds: const ['territory-norte-onco-a'],
        ),
      ],
    ),
    'user-diego-farias': _seededAssignments(
      userId: 'user-diego-farias',
      verticalAssignments: [
        _seededVerticalAssignment(
          verticalId: 'sector-cardiologia',
          verticalName: 'Cardiologia',
          managerId: 'user-fernanda-duarte',
          managerName: 'Fernanda Duarte',
          territoryIds: const ['territory-sul-cardio-b'],
        ),
      ],
    ),
    'user-juliana-pires': _seededAssignments(
      userId: 'user-juliana-pires',
      verticalAssignments: [
        _seededVerticalAssignment(
          verticalId: 'sector-cardiologia',
          verticalName: 'Cardiologia',
          managerId: 'user-otavio-barros',
          managerName: 'Otávio Barros',
          territoryIds: const ['territory-leste-cardio-b'],
        ),
      ],
    ),
    'user-patricia-gomes': _seededAssignments(
      userId: 'user-patricia-gomes',
      verticalAssignments: [
        _seededVerticalAssignment(
          verticalId: 'sector-cardiologia',
          verticalName: 'Cardiologia',
          managerId: 'user-eduardo-alves',
          managerName: 'Eduardo Alves',
          territoryIds: const ['territory-oeste-cardio-c'],
        ),
      ],
    ),
  };

  final Map<String, List<PermissionGrant>> _permissions = {
    'user-diego-farias': [
      PermissionGrant(
        id: 'grant-1',
        resource: 'FACILITY',
        action: 'read',
        grantedByName: 'Ana Beatriz',
        grantedAt: DateTime(2026, 6, 1),
      ),
    ],
  };

  int _grantSeq = 2;

  Future<void> _delay([int ms = 300]) =>
      Future.delayed(Duration(milliseconds: ms));

  @override
  Future<UsersPage> getUsers({
    required int page,
    int limit = 20,
    String? search,
    UserRoleName? role,
    UserStatus? status,
    UsersSortBy sortBy = UsersSortBy.createdAt,
    UsersSortDir sortDir = UsersSortDir.desc,
  }) async {
    await _delay(350);

    var filtered = _users.where((user) {
      if (role != null && user.role.name != role) return false;
      if (status != null && user.status != status) return false;
      if (search != null && search.trim().isNotEmpty) {
        final needle = search.trim().toLowerCase();
        final haystack = [
          user.displayName,
          user.username,
          user.email,
        ].join(' ').toLowerCase();
        if (!haystack.contains(needle)) return false;
      }
      return true;
    }).toList();

    int compare(User a, User b) {
      final primary = switch (sortBy) {
        UsersSortBy.name => a.displayName.toLowerCase().compareTo(
          b.displayName.toLowerCase(),
        ),
        UsersSortBy.role => a.role.name.name.compareTo(b.role.name.name),
        UsersSortBy.status => a.status.name.compareTo(b.status.name),
        UsersSortBy.createdAt => a.createdAt.compareTo(b.createdAt),
      };
      if (primary != 0) {
        return sortDir == UsersSortDir.asc ? primary : -primary;
      }
      return a.displayName.toLowerCase().compareTo(b.displayName.toLowerCase());
    }

    filtered.sort(compare);

    final total = filtered.length;
    final totalPages = total == 0 ? 1 : ((total - 1) ~/ limit) + 1;
    final start = (page - 1) * limit;
    final items = start >= total
        ? const <User>[]
        : filtered.skip(start).take(limit).toList();

    return UsersPage(
      items: items,
      page: page,
      totalPages: totalPages,
      total: total,
    );
  }

  @override
  Future<User?> getUserById(String id) async {
    await _delay(150);
    for (final user in _users) {
      if (user.id == id) return user;
    }
    return null;
  }

  @override
  Future<User> updateUserProfile({
    required String userId,
    required String firstName,
    required String lastName,
    required String email,
    required String phoneNumber,
    required String username,
    DateTime? birthDate,
  }) async {
    await _delay(350);
    final index = _users.indexWhere((u) => u.id == userId);
    if (index == -1) {
      throw StateError('User not found: $userId');
    }
    final updated = _users[index].copyWith(
      firstName: firstName,
      lastName: lastName,
      email: email,
      phoneNumber: phoneNumber,
      username: username,
      birthDate: birthDate,
      clearBirthDate: birthDate == null,
      updatedAt: DateTime.now(),
    );
    _users[index] = updated;
    return updated;
  }

  @override
  Future<UserAssignments> getUserAssignments(String userId) async {
    await _delay(250);
    return _assignments[userId] ??
        UserAssignments(
          userId: userId,
          verticalAssignments: const [],
          isOperationallyActive: false,
        );
  }

  @override
  Future<void> replaceVerticalAssignments(
    String userId,
    List<InviteVerticalAssignment> verticalAssignments,
  ) async {
    await _delay(400);
    _assignments[userId] = UserAssignments(
      userId: userId,
      verticalAssignments: List<InviteVerticalAssignment>.of(
        verticalAssignments,
      ),
      isOperationallyActive: verticalAssignments.any(
        (a) => a.territories.isNotEmpty,
      ),
    );
  }

  @override
  Future<List<PermissionGrant>> getUserPermissions(String userId) async {
    await _delay(200);
    return List<PermissionGrant>.of(_permissions[userId] ?? const []);
  }

  @override
  Future<void> activateUser(String userId) async {
    await _delay();
    _updateStatus(userId, UserStatus.active);
  }

  @override
  Future<void> deactivateUser(String userId) async {
    await _delay();
    _updateStatus(userId, UserStatus.inactive);
  }

  @override
  Future<void> suspendUser(String userId, {String? reason}) async {
    await _delay();
    _updateStatus(userId, UserStatus.suspended);
  }

  @override
  Future<void> unsuspendUser(String userId) async {
    await _delay();
    _updateStatus(userId, UserStatus.active);
  }

  @override
  Future<void> changeUserRole(String userId, String roleId) async {
    await _delay();
    final index = _users.indexWhere((u) => u.id == userId);
    if (index == -1) return;
    final newRole = mockRoles.firstWhere(
      (r) => r.id == roleId,
      orElse: () => _users[index].role,
    );
    _users[index] = _copyWithRole(_users[index], newRole);
  }

  @override
  Future<void> assignManager(String userId, String? managerId) async {
    await _delay();
    final user = await getUserById(userId);
    if (user != null && user.role.name != UserRoleName.rep) {
      throw StateError('Apenas representantes podem ter um gerente.');
    }
    final current = await getUserAssignments(userId);
    if (managerId == null) {
      final cleared = current.verticalAssignments
          .map((a) => a.copyWith(clearManager: true))
          .toList();
      _assignments[userId] = current.copyWith(verticalAssignments: cleared);
      return;
    }
    final manager = mockManagerOptions.firstWhere(
      (m) => m.id == managerId,
      orElse: () => ManagerOption(id: managerId, name: '—'),
    );
    var sectors = List<InviteVerticalAssignment>.of(
      current.verticalAssignments,
    );
    if (sectors.isEmpty) {
      sectors = [
        InviteVerticalAssignment(
          verticalId: 'sector-oncologia',
          verticalName: 'Oncologia',
          managerId: manager.id,
          managerName: manager.name,
        ),
      ];
    } else {
      sectors = sectors
          .map(
            (a) => a.copyWith(managerId: manager.id, managerName: manager.name),
          )
          .toList();
    }
    _assignments[userId] = current.copyWith(verticalAssignments: sectors);
  }

  @override
  Future<void> assignTerritory(String userId, String territoryId) async {
    await _delay();
    final current = await getUserAssignments(userId);
    if (current.territories.any((t) => t.territoryId == territoryId)) return;
    final territory = mockTerritoryOptions.firstWhere(
      (t) => t.id == territoryId,
      orElse: () => TerritoryOption(id: territoryId, name: '—'),
    );
    final verticalId = territory.verticalId ?? 'sector-unknown';
    final sectors = List<InviteVerticalAssignment>.of(
      current.verticalAssignments,
    );
    final index = sectors.indexWhere((a) => a.verticalId == verticalId);
    if (index == -1) {
      sectors.add(
        InviteVerticalAssignment(
          verticalId: verticalId,
          verticalName: territory.verticalName ?? '—',
          managerId: current.managerId,
          managerName: current.managerName,
          territories: [territory],
        ),
      );
    } else {
      sectors[index] = sectors[index].copyWith(
        territories: [...sectors[index].territories, territory],
      );
    }
    _assignments[userId] = current.copyWith(
      verticalAssignments: sectors,
      isOperationallyActive: true,
    );
  }

  @override
  Future<void> revokeTerritory(String userId, String territoryId) async {
    await _delay();
    final current = await getUserAssignments(userId);
    final sectors = current.verticalAssignments
        .map(
          (a) => a.copyWith(
            territories: a.territories
                .where((t) => t.id != territoryId)
                .toList(),
          ),
        )
        .toList();
    _assignments[userId] = current.copyWith(
      verticalAssignments: sectors,
      isOperationallyActive: sectors.any((a) => a.territories.isNotEmpty),
    );
  }

  @override
  Future<void> assignVertical(String userId, String verticalId) async {
    await _delay();
    final current = await getUserAssignments(userId);
    if (current.verticalAssignments.any((s) => s.verticalId == verticalId)) {
      return;
    }
    final sector = mockVerticalOptions.firstWhere(
      (s) => s.id == verticalId,
      orElse: () => VerticalOption(id: verticalId, name: '—'),
    );
    _assignments[userId] = current.copyWith(
      verticalAssignments: [
        ...current.verticalAssignments,
        InviteVerticalAssignment(
          verticalId: sector.id,
          verticalName: sector.name,
          managerId: current.managerId,
          managerName: current.managerName,
        ),
      ],
    );
  }

  @override
  Future<void> revokeVertical(String userId, String verticalId) async {
    await _delay();
    final current = await getUserAssignments(userId);
    _assignments[userId] = current.copyWith(
      verticalAssignments: current.verticalAssignments
          .where((s) => s.verticalId != verticalId)
          .toList(),
    );
  }

  @override
  Future<void> grantPermission(
    String userId, {
    required String resource,
    required String action,
    String? resourceId,
    DateTime? expiresAt,
  }) async {
    await _delay();
    final grants = List<PermissionGrant>.of(_permissions[userId] ?? const []);
    grants.add(
      PermissionGrant(
        id: 'grant-${_grantSeq++}',
        resource: resource,
        action: action,
        resourceId: resourceId,
        grantedByName: 'Você',
        grantedAt: DateTime.now(),
        expiresAt: expiresAt,
      ),
    );
    _permissions[userId] = grants;
  }

  @override
  Future<void> revokePermission(
    String userId, {
    required String resource,
    required String action,
    String? resourceId,
  }) async {
    await _delay();
    final grants = List<PermissionGrant>.of(_permissions[userId] ?? const []);
    grants.removeWhere(
      (g) =>
          g.resource == resource &&
          g.action == action &&
          g.resourceId == resourceId,
    );
    _permissions[userId] = grants;
  }

  @override
  Future<List<UserRole>> getRoles() async {
    await _delay(150);
    return List<UserRole>.of(mockRoles);
  }

  @override
  Future<List<VerticalOption>> getVerticals() async {
    await _delay(150);
    return List<VerticalOption>.of(mockVerticalOptions);
  }

  @override
  Future<List<ManagerOption>> getManagerOptions({String? verticalId}) async {
    await _delay(150);
    final all = List<ManagerOption>.of(mockManagerOptions);
    if (verticalId == null) return all;
    return all
        .where((m) => m.verticalIds.contains(verticalId))
        .toList(growable: false);
  }

  @override
  Future<List<TerritoryOption>> getTerritoryOptions({
    String? verticalId,
  }) async {
    await _delay(150);
    final all = List<TerritoryOption>.of(mockTerritoryOptions);
    if (verticalId == null) return all;
    return all.where((t) => t.verticalId == verticalId).toList(growable: false);
  }

  @override
  Future<ManagerTerritoryScope> getTerritoriesForManager(
    String managerId, {
    String? verticalId,
  }) async {
    await _delay(280);
    final manager = mockManagerOptions.firstWhere(
      (m) => m.id == managerId,
      orElse: () => ManagerOption(id: managerId, name: '—'),
    );
    final zoneId = manager.territoryId;
    final territories = zoneId == null
        ? const <TerritoryOption>[]
        : mockTerritoryOptions
              .where((t) {
                if (t.managerTerritoryId != zoneId) return false;
                if (verticalId != null && t.verticalId != verticalId) {
                  return false;
                }
                return true;
              })
              .toList(growable: false);
    return ManagerTerritoryScope(
      managerId: manager.id,
      managerName: manager.name,
      managerTerritoryId: manager.territoryId,
      managerTerritoryName: manager.territoryName,
      managerZoneCentroid: manager.territoryCentroid,
      managerZoneBoundary: manager.territoryBoundary,
      territories: territories,
    );
  }

  void _updateStatus(String userId, UserStatus status) {
    final index = _users.indexWhere((u) => u.id == userId);
    if (index == -1) return;
    _users[index] = _users[index].copyWith(
      status: status,
      updatedAt: DateTime.now(),
      suspendedAt: status == UserStatus.suspended ? DateTime.now() : null,
      deactivatedAt: status == UserStatus.inactive ? DateTime.now() : null,
      clearSuspendedAt: status != UserStatus.suspended,
      clearDeactivatedAt: status != UserStatus.inactive,
    );
  }

  static User _copyWithRole(User user, UserRole role) =>
      user.copyWith(role: role, updatedAt: DateTime.now());
}
