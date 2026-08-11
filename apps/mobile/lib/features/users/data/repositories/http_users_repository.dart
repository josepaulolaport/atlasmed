import 'dart:convert';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';

import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_vertical_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/users_filter.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/users_page.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_api_exception.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_repository.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

/// Real `/api/v1/access` implementation of [UsersRepository].
class HttpUsersRepository implements UsersRepository {
  /// [client] is injectable so the request shape can be driven in tests without
  /// a network, matching the other HTTP repositories.
  HttpUsersRepository({String? baseUrl, RepositoryHttpClient? client})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
      _client =
          client ??
          createPlatformHttpClient(
            tokenBuilder: SessionEnvironment.instance.tokenBuilder,
          );

  final String _baseUrl;
  final RepositoryHttpClient _client;

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
  Future<User?> getUserById(int id) async {
    final response = await _get(_accessUri('/users/$id'));
    if (response.statusCode == 404) return null;
    _throwIfError(response);
    return User.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  @override
  Future<User> updateUserProfile({
    required int userId,
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
  Future<UserAssignments> getUserAssignments(int userId) async {
    final response = await _get(_accessUri('/users/$userId/assignments'));
    _throwIfError(response);
    return UserAssignments.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  @override
  Future<void> replaceVerticalAssignments(
    int userId,
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
  Future<void> activateUser(int userId) async {
    final response = await _send(
      _accessUri('/users/$userId/activate'),
      method: RepositoryHttpMethod.post,
      body: const {},
    );
    _throwIfError(response);
  }

  @override
  Future<void> deactivateUser(int userId) async {
    final response = await _send(
      _accessUri('/users/$userId/deactivate'),
      method: RepositoryHttpMethod.post,
      body: const {},
    );
    _throwIfError(response);
  }

  @override
  Future<void> suspendUser(int userId, {String? reason}) async {
    final response = await _send(
      _accessUri('/users/$userId/suspend'),
      method: RepositoryHttpMethod.post,
      body: {if (reason != null && reason.isNotEmpty) 'reason': reason},
    );
    _throwIfError(response);
  }

  @override
  Future<void> unsuspendUser(int userId) async {
    final response = await _send(
      _accessUri('/users/$userId/unsuspend'),
      method: RepositoryHttpMethod.post,
      body: const {},
    );
    _throwIfError(response);
  }

  @override
  Future<void> changeUserRole(int userId, int roleId) async {
    final response = await _send(
      _accessUri('/users/$userId/role'),
      method: RepositoryHttpMethod.patch,
      body: {'roleId': roleId},
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
  Future<List<ManagerOption>> getManagerOptions({int? verticalId}) async {
    final response = await _get(
      _accessUri('/users', {
        'role': 'MANAGER',
        'limit': '100',
        if (verticalId != null) 'verticalId': verticalId.toString(),
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
  Future<List<TerritoryOption>> getTerritoryOptions({int? verticalId}) async {
    final response = await _get(
      _territoryUri('/territories', {
        'type': 'manager_zone',
        'format': 'flat',
        'include': 'boundary',
        if (verticalId != null) 'verticalId': verticalId.toString(),
      }),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final rows = (decoded['data'] as List<dynamic>)
        .cast<Map<String, dynamic>>();

    // Only occupied zones need a name, and those lookups are independent of
    // each other — awaiting them one at a time made the picker's first paint
    // scale with the number of occupied zones.
    return Future.wait(
      rows.map((row) async {
        final id = readCrmId(row['id'], 'id');
        final assignedCount = (row['assignedUserCount'] as num?)?.toInt() ?? 0;
        final isOccupied = assignedCount > 0;
        final boundary = _boundaryFromRow(row);
        return TerritoryOption(
          id: id,
          name: row['name'] as String,
          verticalId:
              readCrmIdOrNull(row['verticalId'], 'verticalId') ?? verticalId,
          centroid: boundary?.labelAnchor,
          boundary: boundary,
          isOccupied: isOccupied,
          assignedUserName: isOccupied
              ? await getTerritoryAssigneeName(id)
              : null,
        );
      }),
    );
  }

  /// Geometry embedded by `include=boundary`. Null is a real answer — a
  /// territory type may declare `canHaveBoundary: false` — so the option is
  /// still returned, simply without an area to draw.
  TerritoryGeometry? _boundaryFromRow(Map<String, dynamic> row) {
    final raw = row['boundary'] as Map<String, dynamic>?;
    if (raw == null) return null;
    return TerritoryGeometry.tryFromGeoJson(raw);
  }

  @override
  Future<String?> getTerritoryAssigneeName(int territoryId) async {
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
    required int managerZoneId,
    int? verticalId,
  }) async {
    final response = await _get(
      _territoryUri('/territories', {
        'type': 'patch',
        'format': 'flat',
        'include': 'boundary',
        'managerTerritoryId': managerZoneId.toString(),
        if (verticalId != null) 'verticalId': verticalId.toString(),
      }),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final rows = (decoded['data'] as List<dynamic>)
        .cast<Map<String, dynamic>>();

    final options = <TerritoryOption>[];
    for (final row in rows) {
      final boundary = _boundaryFromRow(row);
      final assignedCount = (row['assignedUserCount'] as num?)?.toInt() ?? 0;
      options.add(
        TerritoryOption(
          id: readCrmId(row['id'], 'id'),
          name: row['name'] as String,
          verticalId:
              readCrmIdOrNull(row['verticalId'], 'verticalId') ?? verticalId,
          centroid: boundary?.labelAnchor,
          boundary: boundary,
          isOccupied: assignedCount > 0,
        ),
      );
    }
    return options;
  }
}
