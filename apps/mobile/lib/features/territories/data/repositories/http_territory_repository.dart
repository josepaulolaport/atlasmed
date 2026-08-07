import 'dart:convert';
import 'dart:math';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart'
    show TerritoryGeometry;
import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/assignable_manager.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/boundary_impact.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_draft.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/unassigned_facility.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/territory_api_exception.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/territory_repository.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

class HttpTerritoryRepository implements TerritoryRepository {
  HttpTerritoryRepository({String? baseUrl})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl;

  final String _baseUrl;
  final RepositoryHttpClient _client = createPlatformHttpClient(
    tokenBuilder: SessionEnvironment.instance.tokenBuilder,
  );

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$_baseUrl$path').replace(queryParameters: query);

  Uri _territoryUri(String path, [Map<String, String>? query]) =>
      _uri('/api/v1/territory$path', query);

  Uri _accessUri(String path, [Map<String, String>? query]) =>
      _uri('/api/v1/access$path', query);

  Future<RepositoryHttpResponse> _get(Uri url) =>
      _client.call(request: RepositoryHttpRequest(url: url));

  Future<RepositoryHttpResponse> _send(
    Uri url,
    RepositoryHttpMethod method, [
    Map<String, dynamic>? body,
  ]) => _client.call(
    request: RepositoryHttpRequest(
      url: url,
      method: method,
      body: body,
      headers: const {'Content-Type': 'application/json'},
    ),
  );

  void _throwIfError(RepositoryHttpResponse response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw TerritoryApiException.fromResponse(response);
    }
  }

  @override
  Future<List<BusinessVertical>> getVerticals() async {
    final response = await _get(_accessUri('/business-verticals'));
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final rows = (decoded['verticals'] as List<dynamic>)
        .cast<Map<String, dynamic>>();
    return rows.map(BusinessVertical.fromJson).toList();
  }

  @override
  Future<List<Territory>> getTerritories({
    required String territoryTypeSlug,
    int? verticalId,
  }) async {
    final response = await _get(
      _territoryUri('/territories', {
        'type': territoryTypeSlug,
        'format': 'flat',
        if (verticalId != null) 'verticalId': verticalId.toString(),
      }),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final rows = (decoded['data'] as List<dynamic>)
        .cast<Map<String, dynamic>>();

    final hydrated = await Future.wait(rows.map(_hydrateTerritory));
    return hydrated.whereType<Territory>().toList();
  }

  @override
  Future<Territory?> getTerritoryById(int id) async {
    final response = await _get(_territoryUri('/territories/$id'));
    if (response.statusCode == 404) return null;
    _throwIfError(response);
    return _hydrateTerritory(jsonDecode(response.body) as Map<String, dynamic>);
  }

  Future<Territory?> _hydrateTerritory(Map<String, dynamic> row) async {
    final id = readCrmId(row['id'], 'id');
    final results = await Future.wait([
      _get(_territoryUri('/territories/$id/boundary')),
      (row['assignedUserCount'] as num? ?? 0) > 0
          ? _get(_accessUri('/territories/$id/assignments'))
          : Future.value(null),
    ]);

    final boundaryResponse = results[0]!;
    if (boundaryResponse.statusCode == 204 || boundaryResponse.body.isEmpty) {
      return null;
    }
    _throwIfError(boundaryResponse);
    final boundary = TerritoryGeometry.tryFromGeoJson(
      jsonDecode(boundaryResponse.body) as Map<String, dynamic>,
    );
    if (boundary == null) return null;

    int? assignedUserId;
    final assignmentsResponse = results[1];
    if (assignmentsResponse != null && assignmentsResponse.statusCode == 200) {
      final entries = jsonDecode(assignmentsResponse.body) as List<dynamic>;
      if (entries.isNotEmpty) {
        assignedUserId = readCrmIdOrNull(
          (entries.first as Map<String, dynamic>)['userId'],
          'userId',
        );
      }
    }

    return Territory.fromApiRow(
      row,
      boundary: boundary,
      centroid:
          boundary.labelAnchor ??
          const MapCoordinate(longitude: 0, latitude: 0),
      assignedUserId: assignedUserId,
    );
  }

  @override
  Future<BoundaryImpactPreview> previewBoundaryImpact(
    int id,
    TerritoryGeometry geometry,
  ) async {
    final response = await _send(
      _territoryUri('/territories/$id/boundary/impact'),
      RepositoryHttpMethod.post,
      geometry.toGeoJson(),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return BoundaryImpactPreview.fromJson(decoded);
  }

  @override
  Future<void> updateTerritoryGeometry(
    int id,
    TerritoryGeometry geometry, {
    List<int>? acceptedFacilityIds,
  }) async {
    final body = <String, dynamic>{
      ...Map<String, dynamic>.from(geometry.toGeoJson()),
      if (acceptedFacilityIds != null) 'acceptedFacilityIds': acceptedFacilityIds,
    };
    final response = await _send(
      _territoryUri('/territories/$id/boundary'),
      RepositoryHttpMethod.put,
      body,
    );
    _throwIfError(response);
  }

  @override
  Future<Territory> createTerritory(
    TerritoryDraft draft,
    TerritoryGeometry boundary,
    MapCoordinate centroid,
  ) async {
    final response =
        await _send(_territoryUri('/territories'), RepositoryHttpMethod.post, {
          'name': draft.name,
          'slug': _generateSlug(draft.name),
          'verticalId': draft.verticalId,
          'typeSlug': draft.kind.slug,
          'boundary': boundary.toGeoJson(),
        });
    _throwIfError(response);
    final row = jsonDecode(response.body) as Map<String, dynamic>;
    return Territory.fromApiRow(row, boundary: boundary, centroid: centroid);
  }

  @override
  Future<void> deleteTerritory(int id) async {
    final response = await _send(
      _territoryUri('/territories/$id'),
      RepositoryHttpMethod.delete,
    );
    _throwIfError(response);
  }

  @override
  Future<void> assignUser(int territoryId, int? userId) async {
    final assignmentsResponse = await _get(
      _accessUri('/territories/$territoryId/assignments'),
    );
    _throwIfError(assignmentsResponse);
    final currentEntries =
        jsonDecode(assignmentsResponse.body) as List<dynamic>;

    for (final entry in currentEntries) {
      final currentUserId = readCrmId(
        (entry as Map<String, dynamic>)['userId'],
        'userId',
      );
      if (currentUserId == userId) continue;
      final revokeResponse = await _send(
        _accessUri('/users/$currentUserId/territories/$territoryId'),
        RepositoryHttpMethod.delete,
      );
      _throwIfError(revokeResponse);
    }

    if (userId != null &&
        !currentEntries.any(
          (entry) =>
              readCrmId((entry as Map<String, dynamic>)['userId'], 'userId') ==
              userId,
        )) {
      final assignResponse = await _send(
        _accessUri('/users/$userId/territories'),
        RepositoryHttpMethod.post,
        {'territoryId': territoryId},
      );
      _throwIfError(assignResponse);
    }
  }

  @override
  Future<void> updateTerritoryInfo(
    int territoryId, {
    required String name,
    required bool isActive,
    int? managerTerritoryId,
  }) async {
    final response = await _send(
      _territoryUri('/territories/$territoryId'),
      RepositoryHttpMethod.patch,
      {'name': name, 'isActive': isActive},
    );
    _throwIfError(response);
  }

  @override
  Future<List<AssignableManager>> getAssignableManagers({
    int? verticalId,
  }) async {
    final zonesResponse = await _get(
      _territoryUri('/territories', {
        'type': 'manager_zone',
        'format': 'flat',
        if (verticalId != null) 'verticalId': verticalId.toString(),
      }),
    );
    _throwIfError(zonesResponse);
    final decoded = jsonDecode(zonesResponse.body) as Map<String, dynamic>;
    final zones = (decoded['data'] as List<dynamic>)
        .cast<Map<String, dynamic>>();

    final candidates = await Future.wait(zones.map(_assignableManagerForZone));
    return candidates.whereType<AssignableManager>().toList();
  }

  @override
  Future<List<UnassignedFacility>> listUnassignedFacilities({
    int? managerZoneId,
    int page = 1,
    int limit = 50,
  }) async {
    final response = await _get(
      _territoryUri('/territories/unassigned-facilities', {
        'page': '$page',
        'limit': '$limit',
        if (managerZoneId != null) 'managerZoneId': managerZoneId.toString(),
      }),
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final rows = (decoded['data'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    return rows.map(UnassignedFacility.fromJson).toList();
  }

  Future<AssignableManager?> _assignableManagerForZone(
    Map<String, dynamic> zone,
  ) async {
    if ((zone['assignedUserCount'] as num? ?? 0) <= 0) return null;
    final zoneId = readCrmId(zone['id'], 'id');
    final response = await _get(_accessUri('/territories/$zoneId/assignments'));
    if (response.statusCode != 200) return null;
    final entries = jsonDecode(response.body) as List<dynamic>;
    if (entries.isEmpty) return null;
    final entry = entries.first as Map<String, dynamic>;

    final firstName = entry['firstName'] as String?;
    final lastName = entry['lastName'] as String?;
    final combinedName = [
      firstName,
      lastName,
    ].whereType<String>().where((part) => part.trim().isNotEmpty).join(' ');
    final username = entry['username'] as String?;

    return AssignableManager(
      manager: AppUser(
        id: readCrmId(entry['userId'], 'userId'),
        name: combinedName.isNotEmpty
            ? combinedName
            : (username?.isNotEmpty ?? false)
            ? username!
            : (entry['email'] as String? ?? ''),
        role: UserRole.manager,
      ),
      zoneTerritoryId: zoneId,
      zoneName: zone['name'] as String,
    );
  }

  static String _generateSlug(String name) {
    final base = name
        .trim()
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9\s-]'), '')
        .replaceAll(RegExp(r'\s+'), '-')
        .replaceAll(RegExp(r'-+'), '-');
    final suffix = Random().nextInt(0xFFFFFF).toRadixString(36);
    final trimmedBase = base.isEmpty ? 'territorio' : base;
    return '$trimmedBase-$suffix';
  }
}
