import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

/// Importing a CNES professional (spec 0012 §6).
///
/// These are repository-level rather than widget-level. `BaseRepository` starts
/// an eight-minute periodic timer in its constructor, so constructing one inside
/// `testWidgets` leaves a pending timer the tester fails on — every repository
/// in the app, not just this one. Mounting the sheet therefore needs a seam in
/// `SessionEnvironment` that does not exist yet; what is asserted here is the
/// branching the sheet delegates, which is where the decisions actually live.
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

RepositoryHttpResponse _json(Object body, {int statusCode = 200}) =>
    RepositoryHttpResponse(
      statusCode: statusCode,
      headers: const {},
      body: jsonEncode(body),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  BaseRepository.storage = const MemoryCacheStorage();

  group('FacilityAssociateRepository.importCnesProfessional', () {
    test('posts the SUS id and nothing that could contradict it', () async {
      final client = FakeClient([
        _json({'personId': 777, 'created': true}),
      ]);
      final repo = FacilityAssociateRepository(9, client: client);
      addTearDown(repo.dispose);

      final result = await repo.importCnesProfessional({
        'professionalCnesId': 'SUS999',
      });

      expect(
        client.requests.single.url.path,
        endsWith('/facilities/9/healthcare-professionals/cnes-imports'),
      );
      final body = client.requests.single.body as Map;
      expect(body['professionalCnesId'], 'SUS999');
      /*
       * No council registration in the payload. It is copied server-side from
       * the registry, because it is the field identity rests on and the one a
       * hurried rep is likeliest to mistype — so the client has no way to send
       * one even by mistake.
       */
      expect(body.containsKey('registrationNumber'), isFalse);
      expect(body.containsKey('councilId'), isFalse);

      expect(result.personId, 777);
      expect(result.alreadyExisted, isFalse);
    });

    test(
      'resolves a 409 to the person who already holds the registration',
      () async {
        /*
       * Not a failure path. The server refuses to create a second record for a
       * registration somebody already holds and names them instead, so the rep
       * ends up associating the person we had all along.
       */
        // The envelope the API actually sends: every error is nested under
        // `error`. A flat fixture here passed while the live 409 fell through
        // to the failure path.
        final client = FakeClient([
          _json({
            'error': {
              'code': 'CNES_REGISTRATION_ALREADY_HELD',
              'message':
                  'CRM 100200/SP already belongs to an existing professional',
              'personId': 5150,
              'registrationLabel': 'CRM 100200/SP',
            },
          }, statusCode: 409),
        ]);
        final repo = FacilityAssociateRepository(9, client: client);
        addTearDown(repo.dispose);

        final result = await repo.importCnesProfessional({
          'professionalCnesId': 'SUS999',
        });

        expect(result.personId, 5150);
        expect(result.alreadyExisted, isTrue);
      },
    );

    test('reports a created:false import as already existing', () async {
      // The idempotent case: this professional was imported before, so the
      // server returns the person rather than creating a second one.
      final client = FakeClient([
        _json({'personId': 41, 'created': false}),
      ]);
      final repo = FacilityAssociateRepository(9, client: client);
      addTearDown(repo.dispose);

      final result = await repo.importCnesProfessional({
        'professionalCnesId': 'SUS999',
      });

      expect(result.personId, 41);
      expect(result.alreadyExisted, isTrue);
    });

    test('accepts a personId serialised as a string', () async {
      // `persons.id` is a bigint; encoders render those as strings, which is
      // exactly what broke the suggestions list once already.
      final client = FakeClient([
        _json({'personId': '777', 'created': true}),
      ]);
      final repo = FacilityAssociateRepository(9, client: client);
      addTearDown(repo.dispose);

      final result = await repo.importCnesProfessional({
        'professionalCnesId': 'SUS999',
      });
      expect(result.personId, 777);
    });

    test('fails loudly on a 409 carrying no person to fall back to', () async {
      // Resolving silently needs somebody to resolve *to*. Without an id there
      // is nothing to associate, and pretending otherwise would report success
      // for a rep who got nothing.
      final client = FakeClient([
        _json({
          'error': {'code': 'CNES_REGISTRATION_ALREADY_HELD'},
        }, statusCode: 409),
      ]);
      final repo = FacilityAssociateRepository(9, client: client);
      addTearDown(repo.dispose);

      expect(
        () => repo.importCnesProfessional({'professionalCnesId': 'SUS999'}),
        throwsA(isA<FacilityAssociateException>()),
      );
    });

    test('fails when the server returns no person at all', () async {
      final client = FakeClient([
        _json({'created': true}),
      ]);
      final repo = FacilityAssociateRepository(9, client: client);
      addTearDown(repo.dispose);

      expect(
        () => repo.importCnesProfessional({'professionalCnesId': 'SUS999'}),
        throwsA(isA<FacilityAssociateException>()),
      );
    });
  });

  group('FacilityAssociateRepository.searchDoctors', () {
    test(
      'excludes this clinic server-side rather than after the page',
      () async {
        /*
       * The filter has to run before LIMIT. Applied to the returned page it
       * removes rows without replacing them, so a clinic with many associated
       * doctors gets a short list and the candidates past the cutoff are
       * unreachable — indistinguishable, on screen, from there being no more.
       */
        final client = FakeClient([
          _json({'data': const [], 'pagination': const {}}),
        ]);
        final repo = FacilityAssociateRepository(685, client: client);
        addTearDown(repo.dispose);

        await repo.searchDoctors(search: 'silva');

        final query = client.requests.single.url.queryParameters;
        expect(query['excludeFacilityId'], '685');
        expect(query['search'], 'silva');
      },
    );
  });
}
