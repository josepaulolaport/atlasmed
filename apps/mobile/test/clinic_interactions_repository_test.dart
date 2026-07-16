import 'package:atlasmed_mobile_app/features/explore/data/models/interaction_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinic_interactions_repository.dart';
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

  test('creates an interaction with the new endpoint and payload', () async {
    final client = FakeClient([
      const RepositoryHttpResponse(
        statusCode: 201,
        headers: {},
        body:
            '{"id":"interaction-1","type":"followup","summary":"Retornar amanhã","agentName":"Ana Silva","interactedAt":"2026-01-01T10:00:00.000Z"}',
      ),
      const RepositoryHttpResponse(
        statusCode: 200,
        headers: {},
        body: '{"data":[]}',
      ),
    ]);
    final repository = ClinicInteractionsRepository(
      'facility-1',
      client: client,
    );

    final interaction = await repository.createInteraction(
      type: InteractionType.followup,
      summary: 'Retornar amanhã',
      interactedAt: '2026-01-01T10:00:00.000Z',
    );

    expect(interaction.type, InteractionType.followup);
    expect(interaction.summary, 'Retornar amanhã');
    expect(interaction.agentName, 'Ana Silva');
    expect(
      client.requests.first.url.path,
      '/api/v1/facilities/facility-1/interactions',
    );
    expect(client.requests.first.method, RepositoryHttpMethod.post);
    expect(client.requests.first.body, {
      'type': 'followup',
      'summary': 'Retornar amanhã',
      'interactedAt': '2026-01-01T10:00:00.000Z',
    });
  });
}
