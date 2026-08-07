import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';

import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/permission_grant.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/users_filter.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/users_page.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_api_exception.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_repository.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

/// Real `/api/v1/access` implementation of [UsersRepository].
class HttpUsersRepository implements UsersRepository {
  HttpUsersRepository({String? baseUrl})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl;

  final String _baseUrl;
  final RepositoryHttpClient _client = createPlatformHttpClient(
    tokenBuilder: SessionEnvironment.instance.tokenBuilder,
  );

  Uri _accessUri(String path, [Map<String, String>? query]) =>
      Uri.parse('$_baseUrl/api/v1/access$path').replace(queryParameters: query);

  Uri _territoryUri(String path, [Map<String, String>? query]) => Uri.parse(
    '$_baseUrl/api/v1/territory$path',
  ).replace(queryParameters: query);

  Future<RepositoryHttpResponse> _get(Uri url) =>
      _client.call(request: RepositoryHttpRequest(url: url));

  Future<RepositoryHttpResponse> _send(
    Uri url, {
    required RepositoryHttpMethod method,
    Map<String, dynamic>? body,
  }) => _client.call(
    request: RepositoryHttpRequest(
      url: url,
      method: method,
      headers: const {'Content-Type': 'application/json'},
      body: body ?? const {},
    ),
  );

  void _throwIfError(RepositoryHttpResponse response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw UsersApiException.fromResponse(response);
    }
  }

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
    final response = await _get(
      _accessUri('/users', {
        'page': '$page',
        'limit': '$limit',
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        if (role != null) 'role': role.name.toUpperCase(),
        if (status != null) 'status': status.name.toUpperCase(),
        'sortBy': sortBy.apiValue,
        'sortDir': sortDir.apiValue,
      }),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final pagination = decoded['pagination'] as Map<String, dynamic>;
    final items = (decoded['data'] as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map(User.fromJson)
        .toList();
    return UsersPage(
      items: items,
      page: pagination['page'] as int? ?? page,
      totalPages: pagination['totalPages'] as int? ?? 1,
      total: pagination['total'] as int? ?? items.length,
    );
  }

  @override
  Future<User?> getUserById(String id) async {
    final response = await _get(_accessUri('/users/$id'));
    if (response.statusCode == 404) return null;
    _throwIfError(response);
    return User.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
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
    final response = await _send(
      _accessUri('/users/$userId'),
      method: RepositoryHttpMethod.patch,
      body: {
        'firstName': firstName,
        'lastName': lastName,
        'email': email,
        'phoneNumber': phoneNumber.isEmpty ? null : phoneNumber,
        'username': username,
        'birthDate': birthDate?.toIso8601String(),
      },
    );
    _throwIfError(response);
    return User.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  @override
  Future<UserAssignments> getUserAssignments(String userId) async {
    final response = await _get(_accessUri('/users/$userId/assignments'));
    _throwIfError(response);
    return UserAssignments.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  @override
  Future<void> replaceVerticalAssignments(
    String userId,
    List<InviteVerticalAssignment> verticalAssignments,
  ) async {
    final response = await _send(
      _accessUri('/users/$userId/assignments'),
      method: RepositoryHttpMethod.put,
      body: {
        'verticalAssignments': verticalAssignments
            .map(
              (s) => {
                'verticalId': s.verticalId,
                'territoryIds': s.territoryIds,
              },
            )
            .toList(),
      },
    );
    _throwIfError(response);
  }

  @override
  Future<List<PermissionGrant>> getUserPermissions(String userId) async {
    final response = await _get(_accessUri('/users/$userId/capabilities'));
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final grants = (decoded['grants'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    return grants
        .map(
          (g) => PermissionGrant(
            id: g['id'] as String,
            resource: g['resource'] as String,
            action: g['action'] as String,
            resourceId: g['resourceId'] as String?,
            grantedAt:
                DateTime.tryParse(g['grantedAt'] as String? ?? '') ??
                DateTime.now(),
            expiresAt: g['expiresAt'] != null
                ? DateTime.tryParse(g['expiresAt'] as String)
                : null,
          ),
        )
        .toList();
  }

  @override
  Future<void> activateUser(String userId) async {
    final response = await _send(
      _accessUri('/users/$userId/activate'),
      method: RepositoryHttpMethod.post,
      body: const {},
    );
    _throwIfError(response);
  }

  @override
  Future<void> deactivateUser(String userId) async {
    final response = await _send(
      _accessUri('/users/$userId/deactivate'),
      method: RepositoryHttpMethod.post,
      body: const {},
    );
    _throwIfError(response);
  }

  @override
  Future<void> suspendUser(String userId, {String? reason}) async {
    final response = await _send(
      _accessUri('/users/$userId/suspend'),
      method: RepositoryHttpMethod.post,
      body: {if (reason != null && reason.isNotEmpty) 'reason': reason},
    );
    _throwIfError(response);
  }

  @override
  Future<void> unsuspendUser(String userId) async {
    final response = await _send(
      _accessUri('/users/$userId/unsuspend'),
      method: RepositoryHttpMethod.post,
      body: const {},
    );
    _throwIfError(response);
  }

  @override
  Future<void> changeUserRole(String userId, String roleId) async {
    final response = await _send(
      _accessUri('/users/$userId/role'),
      method: RepositoryHttpMethod.patch,
      body: {'roleId': roleId},
    );
    _throwIfError(response);
  }

  @override
  Future<void> assignManager(String userId, String? managerId) async {
    // Spec 0006: manager is territory-derived — endpoint removed.
    throw UnsupportedError(
      'Atribuição de gerente removida. Use zonas/patches territoriais.',
    );
  }

  @override
  Future<void> assignTerritory(String userId, String territoryId) async {
    final response = await _send(
      _accessUri('/users/$userId/territories'),
      method: RepositoryHttpMethod.post,
      body: {'territoryId': territoryId},
    );
    _throwIfError(response);
  }

  @override
  Future<void> revokeTerritory(String userId, String territoryId) async {
    final response = await _send(
      _accessUri('/users/$userId/territories/$territoryId'),
      method: RepositoryHttpMethod.delete,
    );
    _throwIfError(response);
  }

  @override
  Future<void> assignVertical(String userId, String verticalId) async {
    final response = await _send(
      _accessUri('/users/$userId/verticals'),
      method: RepositoryHttpMethod.post,
      body: {'verticalId': verticalId},
    );
    _throwIfError(response);
  }

  @override
  Future<void> revokeVertical(String userId, String verticalId) async {
    final response = await _send(
      _accessUri('/users/$userId/verticals/$verticalId'),
      method: RepositoryHttpMethod.delete,
    );
    _throwIfError(response);
  }

  @override
  Future<void> grantPermission(
    String userId, {
    required String resource,
    required String action,
    String? resourceId,
    DateTime? expiresAt,
  }) async {
    final response = await _send(
      _accessUri('/users/$userId/permissions'),
      method: RepositoryHttpMethod.post,
      body: {
        'resource': resource,
        'action': action,
        'resourceId': ?resourceId,
        'expiresAt': ?expiresAt?.toIso8601String(),
      },
    );
    _throwIfError(response);
  }

  @override
  Future<void> revokePermission(
    String userId, {
    required String resource,
    required String action,
    String? resourceId,
  }) async {
    final response = await _send(
      _accessUri('/users/$userId/permissions'),
      method: RepositoryHttpMethod.delete,
      body: {'resource': resource, 'action': action, 'resourceId': ?resourceId},
    );
    _throwIfError(response);
  }

  @override
  Future<List<UserRole>> getRoles() async {
    final response = await _get(_accessUri('/roles'));
    _throwIfError(response);
    final decoded = jsonDecode(response.body);
    final rows = decoded is List
        ? decoded.cast<Map<String, dynamic>>()
        : ((decoded as Map<String, dynamic>)['roles'] as List<dynamic>? ??
                  const [])
              .cast<Map<String, dynamic>>();
    return rows.map(UserRole.fromJson).toList();
  }

  @override
  Future<List<VerticalOption>> getVerticals() async {
    final response = await _get(_accessUri('/business-verticals'));
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final rows = (decoded['verticals'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    return rows.map(VerticalOption.fromJson).toList();
  }

  @override
  Future<List<ManagerOption>> getManagerOptions({String? verticalId}) async {
    final response = await _get(
      _accessUri('/users', {
        'role': 'MANAGER',
        'limit': '100',
        'verticalId': ?verticalId,
      }),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final rows = (decoded['data'] as List<dynamic>)
        .cast<Map<String, dynamic>>();
    return rows.map((row) {
      final user = User.fromJson(row);
      return ManagerOption(
        id: user.id,
        name: user.displayName,
        avatarUrl: user.avatarUrl,
      );
    }).toList();
  }

  @override
  Future<List<TerritoryOption>> getTerritoryOptions({
    String? verticalId,
  }) async {
    final response = await _get(
      _territoryUri('/territories', {
        'type': 'manager_zone',
        'format': 'flat',
        'verticalId': ?verticalId,
      }),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final rows = (decoded['data'] as List<dynamic>)
        .cast<Map<String, dynamic>>();

    final options = <TerritoryOption>[];
    for (final row in rows) {
      final id = row['id'] as String;
      final boundaryResponse = await _get(
        _territoryUri('/territories/$id/boundary'),
      );
      TerritoryGeometry? boundary;
      if (boundaryResponse.statusCode == 200 &&
          boundaryResponse.body.isNotEmpty) {
        boundary = TerritoryGeometry.tryFromGeoJson(
          jsonDecode(boundaryResponse.body) as Map<String, dynamic>,
        );
      }
      final assignedCount = (row['assignedUserCount'] as num?)?.toInt() ?? 0;
      final isOccupied = assignedCount > 0;
      final assigneeName = isOccupied
          ? await getTerritoryAssigneeName(id)
          : null;
      options.add(
        TerritoryOption(
          id: id,
          name: row['name'] as String,
          verticalId: row['verticalId'] as String? ?? verticalId,
          centroid: boundary?.labelAnchor,
          boundary: boundary,
          isOccupied: isOccupied,
          assignedUserName: assigneeName,
        ),
      );
    }
    return options;
  }

  @override
  Future<String?> getTerritoryAssigneeName(String territoryId) async {
    final response = await _get(
      _accessUri('/territories/$territoryId/assignments'),
    );
    if (response.statusCode != 200 || response.body.isEmpty) return null;
    final entries = jsonDecode(response.body) as List<dynamic>;
    if (entries.isEmpty) return null;
    final entry = entries.first as Map<String, dynamic>;
    final firstName = (entry['firstName'] as String?)?.trim() ?? '';
    final lastName = (entry['lastName'] as String?)?.trim() ?? '';
    final combined = '$firstName $lastName'.trim();
    if (combined.isNotEmpty) return combined;
    final username = (entry['username'] as String?)?.trim();
    if (username != null && username.isNotEmpty) return username;
    final email = (entry['email'] as String?)?.trim();
    return (email != null && email.isNotEmpty) ? email : null;
  }

  @override
  Future<List<TerritoryOption>> getPatchesForZone({
    required String managerZoneId,
    String? verticalId,
  }) async {
    final response = await _get(
      _territoryUri('/territories', {
        'type': 'patch',
        'format': 'flat',
        'managerTerritoryId': managerZoneId,
        'verticalId': ?verticalId,
      }),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final rows = (decoded['data'] as List<dynamic>)
        .cast<Map<String, dynamic>>();

    final options = <TerritoryOption>[];
    for (final row in rows) {
      final id = row['id'] as String;
      final boundaryResponse = await _get(
        _territoryUri('/territories/$id/boundary'),
      );
      TerritoryGeometry? boundary;
      if (boundaryResponse.statusCode == 200 &&
          boundaryResponse.body.isNotEmpty) {
        boundary = TerritoryGeometry.tryFromGeoJson(
          jsonDecode(boundaryResponse.body) as Map<String, dynamic>,
        );
      }
      final assignedCount = (row['assignedUserCount'] as num?)?.toInt() ?? 0;
      options.add(
        TerritoryOption(
          id: id,
          name: row['name'] as String,
          verticalId: row['verticalId'] as String? ?? verticalId,
          centroid: boundary?.labelAnchor,
          boundary: boundary,
          isOccupied: assignedCount > 0,
        ),
      );
    }
    return options;
  }

  @override
  Future<ManagerTerritoryScope> getTerritoriesForManager(
    String managerId, {
    String? verticalId,
  }) async {
    if (verticalId == null || verticalId.isEmpty) {
      return ManagerTerritoryScope(
        managerId: managerId,
        managerName: '',
        territories: const [],
      );
    }

    final response = await _get(
      _accessUri('/managers/$managerId/assignable-territories', {
        'verticalId': verticalId,
      }),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final territories = (decoded['territories'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>()
        .map(TerritoryOption.fromJson)
        .toList();
    final zones = (decoded['managerZones'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    final firstZone = zones.isEmpty ? null : zones.first;

    TerritoryGeometry? zoneBoundary;
    if (firstZone?['boundary'] != null) {
      zoneBoundary = TerritoryGeometry.tryFromGeoJson(
        firstZone!['boundary'] as Map<String, dynamic>,
      );
    }

    String managerName = '';
    final manager = await getUserById(managerId);
    managerName = manager?.displayName ?? '';

    return ManagerTerritoryScope(
      managerId: managerId,
      managerName: managerName,
      managerTerritoryId: firstZone?['id'] as String?,
      managerTerritoryName: firstZone?['name'] as String?,
      managerZoneCentroid: zoneBoundary?.labelAnchor,
      managerZoneBoundary: zoneBoundary,
      territories: territories,
    );
  }
}
