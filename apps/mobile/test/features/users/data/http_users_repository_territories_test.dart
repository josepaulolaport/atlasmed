import 'dart:convert';

import 'package:atlasmed_mobile_app/features/users/data/repositories/http_users_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

/// Territory options come back in one request (spec 0009).
///
/// These screens draw every zone or patch on a map at once, so the geometry is
/// genuinely needed up front. It used to be fetched with one
/// `GET /territories/:id/boundary` per row, awaited in a loop, so the picker's
/// first paint cost a round trip per territory.
class _RecordingClient extends RepositoryHttpClient {
  _RecordingClient(this._responses);

  /// Path (with query) → body. A request to anything else is a failure.
  final Map<String, String> _responses;
  final List<Uri> requested = [];

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    requested.add(request.url);
    final key = '${request.url.path}?${request.url.query}';
    final body = _responses[key];
    if (body == null) {
      return RepositoryHttpResponse(
        statusCode: 404,
        headers: const {},
        body: jsonEncode({'error': 'unexpected request: $key'}),
      );
    }
    return RepositoryHttpResponse(
      statusCode: 200,
      headers: const {},
      body: body,
    );
  }
}

Map<String, dynamic> zone({
  required int id,
  required String name,
  Map<String, dynamic>? boundary,
  int assignedUserCount = 0,
}) => {
  'id': id,
  'name': name,
  'slug': 'z$id',
  'verticalId': 7,
  'assignedUserCount': assignedUserCount,
  'boundary': boundary,
};

Map<String, dynamic> square(double x) => {
  'type': 'Polygon',
  'coordinates': [
    [
      [x, 0.0],
      [x + 1, 0.0],
      [x + 1, 1.0],
      [x, 1.0],
      [x, 0.0],
    ],
  ],
};

void main() {
  test(
    'manager zones are fetched once, with their geometry embedded',
    () async {
      final client = _RecordingClient({
        '/api/v1/territory/territories'
                '?type=manager_zone&format=flat&include=boundary&verticalId=7':
            jsonEncode({
              'data': [
                zone(id: 1, name: 'Zona Norte', boundary: square(0)),
                zone(id: 2, name: 'Zona Sul', boundary: square(10)),
              ],
            }),
      });

      final options = await HttpUsersRepository(
        baseUrl: 'https://api.test',
        client: client,
      ).getTerritoryOptions(verticalId: 7);

      // One request for the whole page. The regression this guards is a second
      // request appearing per territory.
      expect(client.requested, hasLength(1));
      expect(client.requested.single.queryParameters['include'], 'boundary');

      expect(options.map((o) => o.name), ['Zona Norte', 'Zona Sul']);
      expect(options.every((o) => o.boundary != null), isTrue);
      expect(options.first.centroid, isNotNull);
    },
  );

  test('a zone with no boundary is still offered, without an area', () async {
    // `territory_types.can_have_boundary` makes this a supported state, not a
    // broken row — dropping the option would hide a real territory.
    final client = _RecordingClient({
      '/api/v1/territory/territories'
              '?type=manager_zone&format=flat&include=boundary&verticalId=7':
          jsonEncode({
            'data': [zone(id: 3, name: 'Sem área', boundary: null)],
          }),
    });

    final options = await HttpUsersRepository(
      baseUrl: 'https://api.test',
      client: client,
    ).getTerritoryOptions(verticalId: 7);

    expect(options, hasLength(1));
    expect(options.single.name, 'Sem área');
    expect(options.single.boundary, isNull);
    expect(options.single.centroid, isNull);
  });

  test('patches under a zone are fetched once too', () async {
    final client = _RecordingClient({
      '/api/v1/territory/territories'
          '?type=patch&format=flat&include=boundary'
          '&managerTerritoryId=1&verticalId=7': jsonEncode({
        'data': [
          zone(id: 11, name: 'Patch A', boundary: square(0)),
          zone(id: 12, name: 'Patch B', boundary: square(2)),
        ],
      }),
    });

    final options = await HttpUsersRepository(
      baseUrl: 'https://api.test',
      client: client,
    ).getPatchesForZone(managerZoneId: 1, verticalId: 7);

    expect(client.requested, hasLength(1));
    expect(options.map((o) => o.id), [11, 12]);
    expect(options.every((o) => o.boundary != null), isTrue);
  });

  test('an occupied zone resolves its assignee name', () async {
    final client = _RecordingClient({
      '/api/v1/territory/territories'
              '?type=manager_zone&format=flat&include=boundary&verticalId=7':
          jsonEncode({
            'data': [
              zone(
                id: 4,
                name: 'Zona Leste',
                boundary: square(0),
                assignedUserCount: 1,
              ),
            ],
          }),
      '/api/v1/access/territories/4/assignments?': jsonEncode([
        {'userId': 90, 'firstName': 'Ana', 'lastName': 'Souza'},
      ]),
    });

    final options = await HttpUsersRepository(
      baseUrl: 'https://api.test',
      client: client,
    ).getTerritoryOptions(verticalId: 7);

    // The name costs one extra request, and only for zones that have someone.
    expect(client.requested, hasLength(2));
    expect(options.single.isOccupied, isTrue);
    expect(options.single.assignedUserName, 'Ana Souza');
  });
}
