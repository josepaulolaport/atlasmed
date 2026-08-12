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
      expect(parsed.referenceLabel, 'segundo o CNES em maio de 2026');
    });

    test('omits the date label when nothing has been loaded', () {
      final parsed = CnesSuggestions.fromMap({
        'status': 'REGISTRY_EMPTY',
        'reference': null,
        'items': const [],
      });
      expect(parsed.referenceLabel, isNull);
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
