import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/domain/cnes_suggestions.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
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
  TestWidgetsFlutterBinding.ensureInitialized();
  BaseRepository.storage = const MemoryCacheStorage();

  group('CnesSuggestions parsing', () {
    test('maps items, occupation and registration into rows', () {
      final parsed = CnesSuggestions.fromMap(
        jsonDecode('''
        {
          "status": "OK",
          "reference": "2026-05",
          "items": [
            {
              "personId": 7,
              "professionalCnesId": "SUS7",
              "displayName": "Doutor Fulano",
              "occupation": "MEDICO ORTOPEDISTA E TRAUMATOLOGISTA",
              "occupations": ["MEDICO ORTOPEDISTA E TRAUMATOLOGISTA"],
              "registrationLabel": "CRM 119508/SP"
            }
          ]
        }
        ''')
            as Map<String, dynamic>,
      );

      expect(parsed.status, CnesSuggestionsStatus.ok);
      expect(parsed.hasItems, isTrue);
      expect(parsed.items.single.personId, 7);
      expect(parsed.items.single.registrationLabel, 'CRM 119508/SP');
    });

    test('renders the competence in Portuguese so a rep can date the claim', () {
      final parsed = CnesSuggestions.fromMap({
        'status': 'OK',
        'reference': '2026-05',
        'items': const [],
      });
      // ADR 0006 accepted the risk of a stale snapshot reading as current fact;
      // this label is what retires it.
      expect(parsed.referenceShort, 'maio/2026');
    });

    test('omits the date label when nothing has been loaded', () {
      final parsed = CnesSuggestions.fromMap({
        'status': 'REGISTRY_EMPTY',
        'reference': null,
        'items': const [],
      });
      expect(parsed.referenceShort, isNull);
      expect(parsed.status, CnesSuggestionsStatus.registryEmpty);
    });

    test('gives each empty reason its own message', () {
      String messageFor(String status) => CnesSuggestions.fromMap({
        'status': status,
        'items': const [],
      }).emptyMessage;

      final messages = <String>{
        messageFor('OK'),
        messageFor('FACILITY_WITHOUT_CNES_CODE'),
        messageFor('FACILITY_NOT_IN_REGISTRY'),
        messageFor('REGISTRY_EMPTY'),
      };
      // Four distinct causes, four distinct things to tell the user — collapsing
      // them into "nenhum resultado" is what makes a working feature look broken.
      expect(messages, hasLength(4));
    });

    test('accepts personId as a string, because bigint serialises that way', () {
      // The bug that broke the live section: `persons.id` is bigint and the
      // driver returned "410". The cast threw, the fetch's catch turned it into
      // "não foi possível consultar", and a serialisation bug was
      // indistinguishable from CNES being unreachable.
      final parsed = CnesSuggestions.fromMap({
        'status': 'OK',
        'items': [
          {
            'personId': '410',
            'professionalCnesId': 'SUS410',
            'displayName': 'Doutor Fulano',
          },
          {
            'personId': 411,
            'professionalCnesId': 'SUS411',
            'displayName': 'Doutora Beltrana',
          },
        ],
      });
      expect(parsed.items.map((i) => i.personId), [410, 411]);
    });

    test('drops an unparseable row instead of losing the whole section', () {
      final parsed = CnesSuggestions.fromMap({
        'status': 'OK',
        'items': [
          // No `professionalCnesId` — the one identity every row has. A row
          // without it names nobody and cannot be acted on either way.
          {'displayName': 'Sem identidade'},
          {'personId': 7, 'professionalCnesId': 'SUS7', 'displayName': 'Boa'},
        ],
      });
      expect(parsed.items.single.personId, 7);
    });

    test('keeps a row we hold nobody for, so a rep can import them', () {
      /**
       * The old parser required `personId` and dropped everything without one —
       * which is ~18 000 of the ~19 300 people CNES reports at our clinics. They
       * were fetched, parsed, discarded, and the tab then said CNES knew nobody
       * else here.
       */
      final parsed = CnesSuggestions.fromMap({
        'status': 'OK',
        'items': [
          {
            'personId': null,
            'professionalCnesId': 'SUS999',
            'displayName': 'DOUTOR DESCONHECIDO',
            'registrationLabel': 'CRM 100200/SP',
          },
          {
            'personId': 5,
            'professionalCnesId': 'SUS5',
            'displayName': 'Conhecida',
          },
        ],
      });

      expect(parsed.items, hasLength(2));
      expect(parsed.unknown.map((i) => i.professionalCnesId), ['SUS999']);
      expect(parsed.unknown.single.isKnown, isFalse);
      // Someone we do not hold is not a suggestion to associate: there is no
      // person to associate. They belong to the import section alone.
      expect(parsed.unlinked.map((i) => i.personId), [5]);
    });

    test('splits linked from unlinked so the CNES tab can show both', () {
      final parsed = CnesSuggestions.fromMap({
        'status': 'OK',
        'items': [
          {
            'personId': 1,
            'professionalCnesId': 'SUS1',
            'displayName': 'Nova',
            'alreadyLinked': false,
          },
          {
            'personId': 2,
            'professionalCnesId': 'SUS2',
            'displayName': 'Ja associada',
            'alreadyLinked': true,
          },
          // Absent flag must not read as linked, or a suggestion would be
          // filed under "já associados" and never offered.
          {
            'personId': 3,
            'professionalCnesId': 'SUS3',
            'displayName': 'Sem flag',
          },
        ],
      });

      expect(parsed.unlinked.map((i) => i.personId), [1, 3]);
      expect(parsed.linked.map((i) => i.personId), [2]);
    });

    test('an unrecognised status degrades to unavailable, not to OK', () {
      // A server that grows a new status must not read as "CNES had no answer".
      final parsed = CnesSuggestions.fromMap({
        'status': 'SOMETHING_NEW',
        'items': const [],
      });
      expect(parsed.status, CnesSuggestionsStatus.unavailable);
    });
  });

  group('FacilityAssociateRepository.fetchCnesSuggestions', () {
    test('calls the facility-scoped endpoint and parses the payload', () async {
      final client = FakeClient([
        RepositoryHttpResponse(
          statusCode: 200,
          headers: const {},
          body: jsonEncode({
            'status': 'OK',
            'reference': '2026-05',
            'items': [
              {
                'personId': 42,
                'professionalCnesId': 'SUS42',
                'displayName': 'Doutora Beltrana',
                'occupation': 'MEDICO UROLOGISTA',
                'occupations': ['MEDICO UROLOGISTA'],
                'registrationLabel': 'CRM 109466/SP',
              },
            ],
          }),
        ),
      ]);
      final repo = FacilityAssociateRepository(9, client: client);
      addTearDown(repo.dispose);

      final result = await repo.fetchCnesSuggestions();

      expect(
        client.requests.single.url.path,
        endsWith('/facilities/9/healthcare-professionals/cnes-suggestions'),
      );
      expect(result.items.single.personId, 42);
      expect(result.items.single.toRoster().specialty, 'MEDICO UROLOGISTA');
    });
  });
}
