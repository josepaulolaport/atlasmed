import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/users/data/mock/mock_assignment_options_data.dart';
import 'package:atlasmed_mobile_app/features/users/data/mock/mock_users_data.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/permission_grant.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/users_page.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_repository.dart';

/// In-memory [UsersRepository] backed by the static mock dataset. Simulates
/// network latency so loading states can be exercised while the screen
/// isn't wired to the real API yet. Holds its own mutable copies of the
/// seed data so admin actions (role change, assignments, permissions,
/// lifecycle) persist for the app's session.
/// Builds an enriched [TerritoryAssignment] by looking up the shared
/// [mockTerritoryOptions] seed, so the seeded assignments below always
/// carry the same sector/centroid/boundary as the assignment picker.
TerritoryAssignment _seededTerritoryAssignment(
  String territoryId,
  DateTime assignedAt,
) {
  final option = mockTerritoryOptions.firstWhere((o) => o.id == territoryId);
  return TerritoryAssignment(
    territoryId: option.id,
    territoryName: option.name,
    assignedAt: assignedAt,
    sectorId: option.sectorId,
    sectorName: option.sectorName,
    centroid: option.centroid,
    boundary: option.boundary,
  );
}

class MockUsersRepository implements UsersRepository {
  final List<User> _users = List<User>.of(mockUsers);
  final Map<String, UserAssignments> _assignments = {
    'user-bruno-castro': UserAssignments(
      userId: 'user-bruno-castro',
      managerId: 'user-fernanda-duarte',
      managerName: 'Fernanda Duarte',
      territories: [
        _seededTerritoryAssignment(
          'territory-zona-sul-onco',
          DateTime(2026, 3, 2),
        ),
      ],
      sectors: [
        SectorAssignment(
          sectorId: 'sector-oncologia',
          sectorName: 'Oncologia',
          assignedAt: DateTime(2026, 3, 2),
        ),
      ],
      isOperationallyActive: true,
    ),
    'user-camila-rocha': UserAssignments(
      userId: 'user-camila-rocha',
      managerId: 'user-fernanda-duarte',
      managerName: 'Fernanda Duarte',
      territories: [
        _seededTerritoryAssignment(
          'territory-zona-norte-onco',
          DateTime(2026, 4, 10),
        ),
      ],
      sectors: [
        SectorAssignment(
          sectorId: 'sector-oncologia',
          sectorName: 'Oncologia',
          assignedAt: DateTime(2026, 4, 10),
        ),
      ],
      isOperationallyActive: true,
    ),
    'user-patricia-gomes': UserAssignments(
      userId: 'user-patricia-gomes',
      managerId: 'user-renata-souza',
      managerName: 'Renata Souza',
      territories: [
        _seededTerritoryAssignment(
          'territory-zona-leste-cardio',
          DateTime(2026, 5, 1),
        ),
      ],
      sectors: [
        SectorAssignment(
          sectorId: 'sector-cardiologia',
          sectorName: 'Cardiologia',
          assignedAt: DateTime(2026, 5, 1),
        ),
      ],
      isOperationallyActive: true,
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

    filtered.sort((a, b) => a.displayName.compareTo(b.displayName));

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
  Future<UserAssignments> getUserAssignments(String userId) async {
    await _delay(250);
    return _assignments[userId] ??
        UserAssignments(
          userId: userId,
          territories: const [],
          sectors: const [],
          isOperationallyActive: false,
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
      _assignments[userId] = current.copyWith(clearManager: true);
      return;
    }
    final manager = mockManagerOptions.firstWhere(
      (m) => m.id == managerId,
      orElse: () => ManagerOption(id: managerId, name: '—'),
    );
    _assignments[userId] = current.copyWith(
      managerId: manager.id,
      managerName: manager.name,
    );
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
    final updated = [
      ...current.territories,
      TerritoryAssignment(
        territoryId: territory.id,
        territoryName: territory.name,
        assignedAt: DateTime.now(),
        sectorId: territory.sectorId,
        sectorName: territory.sectorName,
        centroid: territory.centroid,
        boundary: territory.boundary,
      ),
    ];
    _assignments[userId] = current.copyWith(
      territories: updated,
      isOperationallyActive: updated.isNotEmpty,
    );
  }

  @override
  Future<void> revokeTerritory(String userId, String territoryId) async {
    await _delay();
    final current = await getUserAssignments(userId);
    final updated = current.territories
        .where((t) => t.territoryId != territoryId)
        .toList();
    _assignments[userId] = current.copyWith(
      territories: updated,
      isOperationallyActive: updated.isNotEmpty,
    );
  }

  @override
  Future<void> assignSector(String userId, String sectorId) async {
    await _delay();
    final current = await getUserAssignments(userId);
    if (current.sectors.any((s) => s.sectorId == sectorId)) return;
    final sector = mockSectorOptions.firstWhere(
      (s) => s.id == sectorId,
      orElse: () => SectorOption(id: sectorId, name: '—'),
    );
    _assignments[userId] = current.copyWith(
      sectors: [
        ...current.sectors,
        SectorAssignment(
          sectorId: sector.id,
          sectorName: sector.name,
          assignedAt: DateTime.now(),
        ),
      ],
    );
  }

  @override
  Future<void> revokeSector(String userId, String sectorId) async {
    await _delay();
    final current = await getUserAssignments(userId);
    _assignments[userId] = current.copyWith(
      sectors: current.sectors.where((s) => s.sectorId != sectorId).toList(),
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
  Future<void> revokePermission(String userId, String grantId) async {
    await _delay();
    final grants = List<PermissionGrant>.of(_permissions[userId] ?? const []);
    grants.removeWhere((g) => g.id == grantId);
    _permissions[userId] = grants;
  }

  @override
  Future<List<UserRole>> getRoles() async {
    await _delay(150);
    return List<UserRole>.of(mockRoles);
  }

  @override
  Future<List<SectorOption>> getSectors() async {
    await _delay(150);
    return List<SectorOption>.of(mockSectorOptions);
  }

  @override
  Future<List<ManagerOption>> getManagerOptions() async {
    await _delay(150);
    return List<ManagerOption>.of(mockManagerOptions);
  }

  @override
  Future<List<TerritoryOption>> getTerritoryOptions() async {
    await _delay(150);
    return List<TerritoryOption>.of(mockTerritoryOptions);
  }

  void _updateStatus(String userId, UserStatus status) {
    final index = _users.indexWhere((u) => u.id == userId);
    if (index == -1) return;
    _users[index] = _copyWithStatus(_users[index], status);
  }

  static User _copyWithStatus(User user, UserStatus status) => User(
    id: user.id,
    email: user.email,
    username: user.username,
    phoneNumber: user.phoneNumber,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    status: status,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    emailVerifiedAt: user.emailVerifiedAt,
    phoneVerifiedAt: user.phoneVerifiedAt,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: DateTime.now(),
    lastLoginAt: user.lastLoginAt,
    birthDate: user.birthDate,
    suspendedAt: status == UserStatus.suspended ? DateTime.now() : null,
    deactivatedAt: status == UserStatus.inactive ? DateTime.now() : null,
  );

  static User _copyWithRole(User user, UserRole role) => User(
    id: user.id,
    email: user.email,
    username: user.username,
    phoneNumber: user.phoneNumber,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    status: user.status,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    emailVerifiedAt: user.emailVerifiedAt,
    phoneVerifiedAt: user.phoneVerifiedAt,
    role: role,
    createdAt: user.createdAt,
    updatedAt: DateTime.now(),
    lastLoginAt: user.lastLoginAt,
    birthDate: user.birthDate,
    suspendedAt: user.suspendedAt,
    deactivatedAt: user.deactivatedAt,
  );
}
