import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/domain/exceptions/unexpected_status_code_exception.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
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

class _ResponseClient extends RepositoryHttpClient {
  const _ResponseClient(this.response);

  final RepositoryHttpResponse response;

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async => response;
}

class _SessionAwareRepository extends Repository<String>
    with SessionEnvironmentMixin<String> {
  _SessionAwareRepository({required RepositoryHttpClient httpClient})
    : _client = httpClient,
      super(
        endpoint: Uri.parse('https://example.test/protected'),
        resolveOnCreate: false,
      );

  final RepositoryHttpClient _client;

  @override
  RepositoryHttpClient get client => _client;

  @override
  String fromJson(String json) => json;
}

void main() {
  BaseRepository.storage = const _MemoryCacheStorage();

  test('403 reaches the caller typed without a session refresh', () async {
    final repository = _SessionAwareRepository(
      httpClient: const _ResponseClient(
        RepositoryHttpResponse(statusCode: 403, headers: {}, body: '{}'),
      ),
    );

    expect(await repository.onErrorStatusCode(403), isTrue);
    await expectLater(
      repository.resolve(),
      throwsA(
        isA<UnexpectedStatusCodeException>().having(
          (error) => error.received.statusCode,
          'status code',
          403,
        ),
      ),
    );
  });
}
