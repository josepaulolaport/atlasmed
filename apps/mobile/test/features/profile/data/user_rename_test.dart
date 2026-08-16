import 'dart:convert';

import 'package:atlasmed_mobile_app/core/user/repositories/user_repository.dart';
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
  _RecordingClient(this.response);

  final RepositoryHttpResponse response;
  RepositoryHttpRequest? request;

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    this.request = request;
    return response;
  }
}

Map<String, dynamic> _user({String first = 'Adriana', String last = 'Silva'}) =>
    {
      'id': 2,
      'email': 'adriana@atlasmed.com.br',
      'username': 'adriana',
      'firstName': first,
      'lastName': last,
      'status': 'ACTIVE',
      'emailVerified': true,
      'phoneVerified': false,
      'twoFactorEnabled': false,
      'role': {'id': 3, 'name': 'REP'},
      'createdAt': '2026-02-10T12:00:00.000Z',
      'updatedAt': '2026-08-16T12:00:00.000Z',
    };

void main() {
  BaseRepository.storage = const _MemoryCacheStorage();

  test('renaming PATCHes only the two fields the endpoint accepts', () async {
    // `PATCH /user` takes firstName and lastName and nothing else — e-mail,
    // telephone and username identify the account rather than describe the
    // person, and sending them would be silently dropped by Elysia.
    final client = _RecordingClient(
      RepositoryHttpResponse(
        statusCode: 200,
        headers: const {},
        body: jsonEncode(_user(first: 'Adriana', last: 'Oliveira')),
      ),
    );
    final repository = UserRepository(
      baseUrl: 'http://localhost',
      client: client,
    );

    final updated = await repository.updateName(
      firstName: 'Adriana',
      lastName: 'Oliveira',
    );

    expect(client.request?.method, RepositoryHttpMethod.patch);
    expect(client.request?.url.path, '/api/v1/user');
    // Without this header Elysia parses no body at all and the request fails
    // schema validation with a 400 that names nothing.
    expect(client.request?.headers['Content-Type'], 'application/json');
    expect(client.request?.body, {
      'firstName': 'Adriana',
      'lastName': 'Oliveira',
    });
    expect(updated?.lastName, 'Oliveira');
  });
}
