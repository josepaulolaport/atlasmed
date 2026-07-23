import 'dart:convert';
import 'dart:math';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart'
    show TerritoryGeometry;
import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/assignable_manager.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/sector.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_draft.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/territory_api_exception.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/territory_repository.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

/// Real API-backed [TerritoryRepository]. Each `Territory` the map screen
/// needs is assembled from three separate real endpoints — the metadata
/// row (`GET /territory/territories`), its boundary
/// (`GET /territory/territories/:id/boundary`), and its single assignee
/// (`GET /access/territories/:id/assignments`) — since that's how the
/// real API models them; [MockTerritoryRepository] simplifies all three
/// into one flat model for the mock-data stage of this feature.
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
      // Without this, `http` defaults to `text/plain` for a String body
      // and Elysia silently parses it as an empty object — every field
      // then fails validation as "undefined" even though the JSON was
      // sent correctly.
      headers: const {'Content-Type': 'application/json'},
    ),
  );

  void _throwIfError(RepositoryHttpResponse response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw TerritoryApiException.fromResponse(response);
    }
  }

  @override
  Future<List<Sector>> getSectors() async {
    // `/access/sectors` — the same flat, unpaginated "active sectors for a
    // picker" endpoint the web admin's user-assignment dialog already
    // uses — not the catalog module's paginated `/sectors` CRUD endpoint,
    // which is a heavier admin surface this map-first screen doesn't need.
    final response = await _get(_accessUri('/sectors'));
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final rows = (decoded['sectors'] as List<dynamic>)
        .cast<Map<String, dynamic>>();
    return rows
        .map(
          (row) => Sector(
            id: row['id'] as String,
            slug: row['slug'] as String,
            name: row['name'] as String,
          ),
        )
        .toList();
  }

  @override
  Future<List<Territory>> getTerritories({
    required String territoryTypeSlug,
    required String sectorId,
  }) async {
    final response = await _get(
      _territoryUri('/territories', {
        'type': territoryTypeSlug,
        'sectorId': sectorId,
        'format': 'flat',
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
  Future<Territory?> getTerritoryById(String id) async {
    final response = await _get(_territoryUri('/territories/$id'));
    if (response.statusCode == 404) return null;
    _throwIfError(response);
    return _hydrateTerritory(jsonDecode(response.body) as Map<String, dynamic>);
  }

  /// Fetches the boundary + current assignee for a territory metadata
  /// [row] and assembles the full [Territory]. Returns `null` if the
  /// territory has no boundary yet — this map-first screen has nothing
  /// to draw for it.
  Future<Territory?> _hydrateTerritory(Map<String, dynamic> row) async {
    final id = row['id'] as String;
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
    final boundary = TerritoryGeometry.fromGeoJson(
      jsonDecode(boundaryResponse.body) as Map<String, dynamic>,
    );

    String? assignedUserId;
    final assignmentsResponse = results[1];
    if (assignmentsResponse != null && assignmentsResponse.statusCode == 200) {
      final entries = jsonDecode(assignmentsResponse.body) as List<dynamic>;
      if (entries.isNotEmpty) {
        assignedUserId =
            (entries.first as Map<String, dynamic>)['userId'] as String?;
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
  Future<void> updateTerritoryGeometry(
    String id,
    TerritoryGeometry geometry,
  ) async {
    final response = await _send(
      _territoryUri('/territories/$id/boundary'),
      RepositoryHttpMethod.put,
      geometry.toGeoJson(),
    );
    _throwIfError(response);
  }

  @override
  Future<Territory> createTerritory(
    TerritoryDraft draft,
    TerritoryGeometry boundary,
    MapCoordinate centroid,
  ) async {
    final territoryTypeId = await _resolveTerritoryTypeId(draft.kind.slug);
    final response =
        await _send(_territoryUri('/territories'), RepositoryHttpMethod.post, {
          'name': draft.name,
          'slug': _generateSlug(draft.name),
          'territoryTypeId': territoryTypeId,
          'typeSlug': draft.kind.slug,
          'sectorId': draft.sectorId,
          if (draft.managerTerritoryId != null)
            'managerTerritoryId': draft.managerTerritoryId,
          'boundary': boundary.toGeoJson(),
        });
    _throwIfError(response);
    final row = jsonDecode(response.body) as Map<String, dynamic>;
    return Territory.fromApiRow(row, boundary: boundary, centroid: centroid);
  }

  /// Resolves `manager_zone` / `patch` to a real type id so create doesn't
  /// depend solely on slug lookup (clearer failure if the API DB is wrong).
  Future<String> _resolveTerritoryTypeId(String typeSlug) async {
    final response = await _get(_territoryUri('/territory-types'));
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final rows = (decoded['data'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    Map<String, dynamic>? match;
    for (final row in rows) {
      if (row['slug'] == typeSlug && (row['isActive'] as bool? ?? true)) {
        match = row;
        break;
      }
    }
    final id = match?['id'] as String?;
    if (id == null || id.isEmpty) {
      final available = rows
          .map((row) => row['slug'] as String? ?? '?')
          .join(', ');
      throw TerritoryApiException(
        statusCode: 404,
        code: 'INVALID_TERRITORY_TYPE',
        message: available.isEmpty
            ? 'Tipo de território "$typeSlug" não encontrado nesta API.'
            : 'Tipo de território "$typeSlug" inválido. Disponíveis: $available.',
      );
    }
    return id;
  }

  @override
  Future<void> deleteTerritory(String id) async {
    final response = await _send(
      _territoryUri('/territories/$id'),
      RepositoryHttpMethod.delete,
    );
    _throwIfError(response);
  }

  @override
  Future<void> assignUser(String territoryId, String? userId) async {
    final assignmentsResponse = await _get(
      _accessUri('/territories/$territoryId/assignments'),
    );
    _throwIfError(assignmentsResponse);
    final currentEntries =
        jsonDecode(assignmentsResponse.body) as List<dynamic>;

    for (final entry in currentEntries) {
      final currentUserId = (entry as Map<String, dynamic>)['userId'] as String;
      if (currentUserId == userId) continue;
      final revokeResponse = await _send(
        _accessUri('/users/$currentUserId/territories/$territoryId'),
        RepositoryHttpMethod.delete,
      );
      _throwIfError(revokeResponse);
    }

    if (userId != null &&
        !currentEntries.any(
          (entry) => (entry as Map<String, dynamic>)['userId'] == userId,
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
    String territoryId, {
    required String name,
    required String sectorId,
    required bool isActive,
    String? managerTerritoryId,
  }) async {
    // `managerTerritoryId` is intentionally not sent: on the real API a
    // rep patch's manager zone is derived purely from where its boundary
    // geometrically falls (see `applyTerritoryBoundary`), not settable
    // through this metadata-only PATCH. Reassigning a patch to a
    // different zone means redrawing its boundary inside that zone in
    // the geometry editor instead.
    final response = await _send(
      _territoryUri('/territories/$territoryId'),
      RepositoryHttpMethod.patch,
      {'name': name, 'sectorId': sectorId, 'isActive': isActive},
    );
    _throwIfError(response);
  }

  @override
  Future<List<AssignableManager>> getAssignableManagers(String sectorId) async {
    final zonesResponse = await _get(
      _territoryUri('/territories', {
        'type': 'manager_zone',
        'sectorId': sectorId,
        'format': 'flat',
      }),
    );
    _throwIfError(zonesResponse);
    final decoded = jsonDecode(zonesResponse.body) as Map<String, dynamic>;
    final zones = (decoded['data'] as List<dynamic>)
        .cast<Map<String, dynamic>>();

    final candidates = await Future.wait(zones.map(_assignableManagerForZone));
    return candidates.whereType<AssignableManager>().toList();
  }

  Future<AssignableManager?> _assignableManagerForZone(
    Map<String, dynamic> zone,
  ) async {
    if ((zone['assignedUserCount'] as num? ?? 0) <= 0) return null;
    final zoneId = zone['id'] as String;
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
        id: entry['userId'] as String,
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
    // Fold common pt-BR diacritics so names like "São José" don't collapse
    // into unreadable slugs after stripping non-ASCII.
    const from = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
    const to = 'aaaaaeeeeiiiiooooouuuucn';
    var folded = name.trim().toLowerCase();
    for (var i = 0; i < from.length; i++) {
      folded = folded.replaceAll(from[i], to[i]);
    }
    final base = folded
        .replaceAll(RegExp(r'[^a-z0-9\s-]'), '')
        .replaceAll(RegExp(r'\s+'), '-')
        .replaceAll(RegExp(r'-+'), '-')
        .replaceAll(RegExp(r'^-|-$'), '');
    final suffix = Random().nextInt(0xFFFFFF).toRadixString(36);
    final trimmedBase = base.isEmpty ? 'territorio' : base;
    final slug = '$trimmedBase-$suffix';
    return slug.length <= 60 ? slug : '${trimmedBase.substring(0, 40)}-$suffix';
  }
}
