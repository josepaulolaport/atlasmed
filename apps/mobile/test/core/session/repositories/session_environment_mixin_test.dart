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
  _SessionAwareRepository({
    required RepositoryHttpClient httpClient,
    this.sessionAvailableAfterRefresh = true,
  }) : _client = httpClient,
       super(
         endpoint: Uri.parse('https://example.test/protected'),
         resolveOnCreate: false,
       );

  final RepositoryHttpClient _client;
  final bool sessionAvailableAfterRefresh;
  int refreshCalls = 0;
  int deleteCalls = 0;

  @override
  RepositoryHttpClient get client => _client;

  @override
  String fromJson(String json) => json;

  @override
  bool get hasActiveSession => true;

  @override
  bool get hasCurrentSession => sessionAvailableAfterRefresh;

  @override
  Future<void> refreshSession() async {
    refreshCalls++;
  }

  @override
  Future<void> deleteSession() async {
    deleteCalls++;
  }
}

void main() {
  BaseRepository.storage = const _MemoryCacheStorage();

  test('401 still refreshes the session and requests a retry', () async {
    final repository = _SessionAwareRepository(
      httpClient: const _ResponseClient(
        RepositoryHttpResponse(statusCode: 401, headers: {}, body: '{}'),
      ),
    );

    await expectLater(
      repository.onErrorStatusCode(401),
      throwsA(isA<SessionExpiredException>()),
    );
    expect(repository.refreshCalls, 1);
    expect(repository.deleteCalls, 0);
  });

  test('401 clears the session when refresh cannot restore it', () async {
    final repository = _SessionAwareRepository(
      httpClient: const _ResponseClient(
        RepositoryHttpResponse(statusCode: 401, headers: {}, body: '{}'),
      ),
      sessionAvailableAfterRefresh: false,
    );

    expect(await repository.onErrorStatusCode(401), isTrue);
    expect(repository.refreshCalls, 1);
    expect(repository.deleteCalls, 1);
  });

  test(
    '500 remains a typed server error without session side effects',
    () async {
      final repository = _SessionAwareRepository(
        httpClient: const _ResponseClient(
          RepositoryHttpResponse(statusCode: 500, headers: {}, body: '{}'),
        ),
      );

      await expectLater(
        repository.resolve(),
        throwsA(
          isA<UnexpectedStatusCodeException>().having(
            (error) => error.received.statusCode,
            'status code',
            500,
          ),
        ),
      );
      expect(repository.refreshCalls, 0);
      expect(repository.deleteCalls, 0);
    },
  );

  test('403 reaches the caller typed without refreshing or deleting', () async {
    final repository = _SessionAwareRepository(
      httpClient: const _ResponseClient(
        RepositoryHttpResponse(statusCode: 403, headers: {}, body: '{}'),
      ),
    );

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
    expect(repository.refreshCalls, 0);
    expect(repository.deleteCalls, 0);
  });
}
