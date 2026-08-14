import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/person_facility_roles_catalog_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

/// The role catalog is global reference data behind a static cache, but every
/// caller built its own repository, fetched, and disposed it — so the cache was
/// written and the writer thrown away. Two callers warm it on a clinic open
/// (the representatives roster and the professionals roster) and they run
/// concurrently, so a plain cache check would not have helped: both find it
/// empty and both fetch.
///
/// Measured against production 2026-08-13: two `/person-facility-roles`
/// requests per clinic open, 39-135ms apart depending on which chain won.
void main() {
  setUp(() {
    PersonFacilityRoleCatalogCache.resetForTest();
    PersonFacilityRolesCatalogRepository.resetWarmForTest();
  });

  tearDown(() {
    PersonFacilityRoleCatalogCache.resetForTest();
    PersonFacilityRolesCatalogRepository.resetWarmForTest();
  });

  test('concurrent warms issue one request', () async {
    final client = _CountingClient();
    // Two repositories, as the two rosters really do.
    final a = PersonFacilityRolesCatalogRepository(
      baseUrl: 'https://test',
      client: client,
    );
    final b = PersonFacilityRolesCatalogRepository(
      baseUrl: 'https://test',
      client: client,
    );

    // Started together and awaited together: neither sees a populated cache
    // when it starts, which is the case a cache check alone cannot fix.
    await Future.wait([a.ensureCatalogWarm(), b.ensureCatalogWarm()]);

    expect(client.calls, 1);
    expect(PersonFacilityRoleCatalogCache.entries, hasLength(2));
  });

  test('a warm after the cache is populated issues nothing', () async {
    final client = _CountingClient();
    final repo = PersonFacilityRolesCatalogRepository(
      baseUrl: 'https://test',
      client: client,
    );

    await repo.ensureCatalogWarm();
    expect(client.calls, 1);

    // Reopening the screen must not re-fetch reference data.
    await repo.ensureCatalogWarm();
    expect(client.calls, 1);
  });

  test('a failed warm is retried rather than remembered as done', () async {
    final client = _CountingClient(failFirst: true);
    final repo = PersonFacilityRolesCatalogRepository(
      baseUrl: 'https://test',
      client: client,
    );

    await expectLater(repo.ensureCatalogWarm(), throwsA(isA<StateError>()));
    expect(PersonFacilityRoleCatalogCache.entries, isEmpty);

    // The in-flight future is cleared on failure, so the next open tries again
    // instead of inheriting a permanently empty catalog.
    await repo.ensureCatalogWarm();
    expect(client.calls, 2);
    expect(PersonFacilityRoleCatalogCache.entries, hasLength(2));
  });

  test(
    'listActive still always fetches, for the role-editing sheets',
    () async {
      // Those sheets need current server state, not a warm cache.
      final client = _CountingClient();
      final repo = PersonFacilityRolesCatalogRepository(
        baseUrl: 'https://test',
        client: client,
      );

      await repo.listActive();
      await repo.listActive();

      expect(client.calls, 2);
    },
  );
}

class _CountingClient extends RepositoryHttpClient {
  _CountingClient({this.failFirst = false});

  final bool failFirst;
  int calls = 0;

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    calls++;
    // A real round trip is not instantaneous; without a gap both callers would
    // complete before either could observe the other, and the test would pass
    // whether or not the requests were actually shared.
    await Future<void>.delayed(const Duration(milliseconds: 10));
    if (failFirst && calls == 1) {
      return const RepositoryHttpResponse(
        statusCode: 500,
        headers: {},
        body: '{}',
      );
    }
    return const RepositoryHttpResponse(
      statusCode: 200,
      headers: {},
      body: '{"data":[{"id":1,"name":"Diretor"},{"id":2,"name":"Recepção"}]}',
    );
  }
}
