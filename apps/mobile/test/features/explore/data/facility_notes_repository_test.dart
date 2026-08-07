import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_notes_repository.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

class _MemoryCacheStorage extends RepositoryCacheStorage {
  const _MemoryCacheStorage();

  @override
  Future<void> clear() async {}

  @override
  Future<void> delete({required String key}) async {}

  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}
}

class _RecordingClient extends RepositoryHttpClient {
  _RecordingClient(this.responses);

  final List<RepositoryHttpResponse> responses;
  final List<RepositoryHttpRequest> requests = [];

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    requests.add(request);
    return responses.removeAt(0);
  }
}

RepositoryHttpResponse _response(int status, Object body) =>
    RepositoryHttpResponse(
      statusCode: status,
      headers: const {},
      body: body is String ? body : jsonEncode(body),
    );

void main() {
  BaseRepository.storage = const _MemoryCacheStorage();

  test('note read uses numeric facility id in URL', () async {
    final client = _RecordingClient([_response(200, const <Object>[])]);
    final repository = FacilityNotesRepository(
      1,
      client: client,
    );

    await repository.loadNotes();

    expect(
      client.requests.single.url.path,
      '/api/v1/facilities/1/notes',
    );
    expect(client.requests.single.url.queryParameters, isEmpty);
  });

  test('note POST sends actor-owned body without extra query params', () async {
    final client = _RecordingClient([
      _response(201, {
        'id': 1,
        'note': 'Retornar em setembro.',
        'createdAt': '2026-08-03T12:00:00.000Z',
      }),
    ]);
    final repository = FacilityNotesRepository(
      1,
      client: client,
    );

    await repository.createNote('Retornar em setembro.');

    expect(client.requests.first.method, RepositoryHttpMethod.post);
    expect(client.requests.first.url.queryParameters, isEmpty);
    expect(client.requests.first.body, {'note': 'Retornar em setembro.'});
  });
}
