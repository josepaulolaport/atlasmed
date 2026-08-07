import 'package:atlasmed_mobile_app/features/explore/data/repositories/professional_notes_repository.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeClient extends RepositoryHttpClient {
  FakeClient(this.responses);

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

class MemoryCacheStorage extends RepositoryCacheStorage {
  const MemoryCacheStorage();

  @override
  Future<void> clear() async {}

  @override
  Future<void> delete({required String key}) async {}

  @override
  Future<String?> read({required String key}) async => null;

  @override
  Future<void> write({required String key, required String value}) async {}
}

void main() {
  BaseRepository.storage = const MemoryCacheStorage();
  test(
    'maps note endpoint response and sends authenticated POST payload',
    () async {
      final client = FakeClient([
        const RepositoryHttpResponse(
          statusCode: 201,
          headers: {},
          body:
              '{"id":1,"note":"Retornar amanhã","createdAt":"2026-01-01T10:00:00.000Z","updatedAt":"2026-01-01T10:00:00.000Z"}',
        ),
        const RepositoryHttpResponse(statusCode: 200, headers: {}, body: '[]'),
      ]);
      final repository = ProfessionalNotesRepository(
        1,
        client: client,
      );

      final note = await repository.createNote('Retornar amanhã');

      expect(note.id, 1);
      expect(
        client.requests.first.url.path,
        '/api/v1/persons/1/notes',
      );
      expect(client.requests.first.method, RepositoryHttpMethod.post);
      expect(client.requests.first.body, {'note': 'Retornar amanhã'});
    },
  );
}
