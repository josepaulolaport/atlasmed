import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/cnes_import_wizard.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/associate_doctors_sheet.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../cnes_catalogue_fixtures.dart';

/// Importing a CNES professional from the sheet (spec 0012 §6).
///
/// These could not exist until `BaseRepository.autoRefreshEnabled` did:
/// `SessionEnvironment` carries an eight-minute periodic timer, a widget test
/// fails on any pending timer, and a periodic one never drains — so mounting
/// anything that builds a repository was impossible regardless of the seam the
/// sheet itself offers.
class RecordingClient extends RepositoryHttpClient {
  RecordingClient(this.handler);

  final RepositoryHttpResponse Function(RepositoryHttpRequest) handler;
  final List<RepositoryHttpRequest> requests = [];

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) async {
    requests.add(request);
    return handler(request);
  }

  List<String> get paths =>
      requests.map((r) => r.url.path).toList(growable: false);
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

/// One person CNES places here that we hold, and one we do not.
Object _suggestionsPayload() => {
  'status': 'OK',
  'reference': '2026-07',
  'items': [
    {
      'personId': 5,
      'professionalCnesId': 'SUS5',
      'displayName': 'Conhecida Silva',
      'registrationLabel': 'CRM 100100/SP',
      'occupationOptions': [
        {'id': 30, 'name': 'Ortopedista'},
      ],
    },
    {
      'personId': null,
      'professionalCnesId': 'SUS999',
      'displayName': 'DESCONHECIDO SOUZA',
      'registrationLabel': 'CRM 100200/SP',
      // What CNES records them doing at this clinic, as our catalogue names it.
      'occupationOptions': [
        {'id': 10, 'name': 'Anestesiologista'},
        {'id': 20, 'name': 'Intensivista'},
      ],
    },
  ],
};

Future<void> _pumpSheet(
  WidgetTester tester, {
  required RecordingClient client,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: AssociateDoctorsSheet(
          alreadyAssociatedIds: const {},
          alreadyAssociatedDoctors: const [],
          facilityId: 9,
          repositoryBuilder: (facilityId) =>
              FacilityAssociateRepository(facilityId, client: client),
          importCatalogues: testCatalogues(),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _openCnesTab(WidgetTester tester) async {
  // The pill carries a count once the fetch settles — "CNES (2)".
  await tester.tap(find.textContaining('CNES'));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  BaseRepository.storage = const MemoryCacheStorage();
  BaseRepository.autoRefreshEnabled = false;

  RepositoryHttpResponse defaultHandler(RepositoryHttpRequest request) {
    final path = request.url.path;
    if (path.endsWith('/cnes-suggestions')) return _json(_suggestionsPayload());
    if (path.endsWith('/cnes-imports')) {
      return _json({'personId': 777, 'created': true});
    }
    if (path.endsWith('/cnes-associations')) {
      return _json({'personId': 5, 'personFacilityId': 88, 'created': true});
    }
    if (path.contains('/healthcare-professionals')) {
      return _json({'data': const [], 'pagination': const {}});
    }
    return _json(const {});
  }

  testWidgets('flags someone CNES places here that we do not hold', (
    tester,
  ) async {
    final client = RecordingClient(defaultHandler);
    await _pumpSheet(tester, client: client);
    await _openCnesTab(tester);

    expect(find.text('DESCONHECIDO SOUZA'), findsOneWidget);
    // The chip is what tells the rep that ticking this creates a professional
    // record rather than linking an existing one.
    expect(find.text('novo'), findsOneWidget);
    expect(find.text('Ainda não cadastrados'), findsOneWidget);
    // Someone we do hold carries no chip: the two states have to be tellable
    // apart at a glance, which is the whole point of listing them together.
    expect(find.text('Conhecida Silva'), findsOneWidget);
  });

  testWidgets('sends someone we do not hold to the wizard, not to the API', (
    tester,
  ) async {
    /*
     * Ticking a name here is a request to create a person, and CNES ships four
     * fields — no specialty, no role, no contact. Importing straight from the
     * sheet produced a record somebody had to finish later, so the confirm
     * button now opens the wizard and nothing is written until it completes.
     */
    final client = RecordingClient(defaultHandler);
    await _pumpSheet(tester, client: client);
    await _openCnesTab(tester);

    await tester.tap(find.text('DESCONHECIDO SOUZA'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FilledButton).first);
    await tester.pumpAndSettle();

    expect(find.byType(CnesImportWizard), findsOneWidget);
    expect(find.text('Identidade e contato'), findsOneWidget);
    expect(client.paths.where((p) => p.endsWith('/cnes-imports')), isEmpty);
  });

  testWidgets('associating a CNES row records what they do here', (
    tester,
  ) async {
    /*
     * The defect this endpoint exists for: ticking someone from the CNES tab
     * used to post the generic association, which knows nothing about the
     * registry — the roster gained a clinician and person_facility_occupations
     * stayed exactly as it was, while the identical doctor arriving by import
     * gained both.
     */
    final client = RecordingClient(defaultHandler);
    await _pumpSheet(tester, client: client);
    await _openCnesTab(tester);

    await tester.tap(find.text('Conhecida Silva'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();

    final associate = client.requests.firstWhere(
      (r) => r.url.path.endsWith('/cnes-associations'),
    );
    // The SUS id, not a person id: the server resolves identity from the same
    // registry the suggestion came from.
    expect((associate.body as Map)['professionalCnesId'], 'SUS5');
    expect((associate.body as Map)['occupationIds'], [30]);
    expect(
      client.paths.where(
        (p) => p.endsWith('/facilities/9/healthcare-professionals'),
      ),
      isEmpty,
    );
  });

  testWidgets('carries a role the rep picked while associating', (
    tester,
  ) async {
    /*
     * Associating is the moment the rep knows what this person is to the
     * clinic. Sending them back through the roster afterwards is how roles stay
     * unset — but it is offered, never demanded: not every person at a clinic
     * has one.
     */
    final client = RecordingClient(defaultHandler);
    await _pumpSheet(tester, client: client);
    await _openCnesTab(tester);

    await tester.tap(find.text('Conhecida Silva'));
    await tester.pumpAndSettle();
    // The chips appear once the row is ticked, and nothing starts selected.
    await tester.tap(find.text('Prescritor'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FilledButton).first);
    await tester.pumpAndSettle();

    final associate = client.requests.firstWhere(
      (r) => r.url.path.endsWith('/cnes-associations'),
    );
    expect((associate.body as Map)['roleIds'], [1]);
  });

  testWidgets('associates without a role when the rep picked none', (
    tester,
  ) async {
    final client = RecordingClient(defaultHandler);
    await _pumpSheet(tester, client: client);
    await _openCnesTab(tester);

    await tester.tap(find.text('Conhecida Silva'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FilledButton).first);
    await tester.pumpAndSettle();

    final associate = client.requests.firstWhere(
      (r) => r.url.path.endsWith('/cnes-associations'),
    );
    expect((associate.body as Map)['roleIds'], isEmpty);
  });

  testWidgets('a doctor picked from the search pool still associates plainly', (
    tester,
  ) async {
    /*
     * The CNES endpoint is not a replacement. Someone found by search carries
     * no registry claim about this clinic, so there is no CBO to record and
     * the generic association is the honest request to make.
     */
    final client = RecordingClient((request) {
      if (request.url.path.contains('/api/v1/healthcare-professionals')) {
        return _json({
          'data': [
            {'id': 42, 'firstName': 'Fora', 'lastName': 'Do CNES'},
          ],
          'pagination': const {},
        });
      }
      return defaultHandler(request);
    });
    await _pumpSheet(tester, client: client);

    await tester.tap(find.text('Fora Do CNES'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();

    final associate = client.requests.lastWhere(
      (r) => r.url.path.endsWith('/facilities/9/healthcare-professionals'),
    );
    expect((associate.body as Map)['personId'], 42);
    expect(
      client.paths.where((p) => p.endsWith('/cnes-associations')),
      isEmpty,
    );
  });

  testWidgets('a search outage leaves the CNES tab usable', (tester) async {
    /*
     * The pool and the registry fail independently. A search outage used to
     * blank this whole surface, so a working CNES section was unreachable
     * because an unrelated request had failed.
     */
    final client = RecordingClient((request) {
      if (request.url.path.endsWith('/cnes-suggestions')) {
        return _json(_suggestionsPayload());
      }
      if (request.url.path.contains('/healthcare-professionals')) {
        return _json({'message': 'boom'}, statusCode: 500);
      }
      return _json(const {});
    });
    await _pumpSheet(tester, client: client);
    await _openCnesTab(tester);

    expect(find.text('DESCONHECIDO SOUZA'), findsOneWidget);
    expect(find.text('Não foi possível carregar médicos.'), findsNothing);
  });
}
