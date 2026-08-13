import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/associate_doctors_sheet.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

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
    },
    {
      'personId': null,
      'professionalCnesId': 'SUS999',
      'displayName': 'DESCONHECIDO SOUZA',
      'registrationLabel': 'CRM 100200/SP',
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

  testWidgets('imports the person, then associates them', (tester) async {
    final client = RecordingClient(defaultHandler);
    await _pumpSheet(tester, client: client);
    await _openCnesTab(tester);

    await tester.tap(find.text('DESCONHECIDO SOUZA'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();

    final importRequest = client.requests.firstWhere(
      (r) => r.url.path.endsWith('/cnes-imports'),
    );
    expect((importRequest.body as Map)['professionalCnesId'], 'SUS999');

    /*
     * Import first, associate second. They are two facts — that the person
     * exists, and that they work here — and in this order a failure between
     * them leaves a real professional who is merely not linked yet, which the
     * rep fixes by tapping again.
     */
    final importAt = client.paths.indexWhere(
      (p) => p.endsWith('/cnes-imports'),
    );
    final associateAt = client.paths.lastIndexWhere(
      (p) => p.endsWith('/healthcare-professionals'),
    );
    expect(importAt, greaterThanOrEqualTo(0));
    expect(associateAt, greaterThan(importAt));
  });

  testWidgets('associates the existing person when the CRM is already held', (
    tester,
  ) async {
    /*
     * Full silent. The server refuses to create a second record for a
     * registration somebody already holds and names them instead, so the sheet
     * associates that person and reports it afterwards rather than asking
     * first — of 1 039 confirmed-same people, five disagree on spelling and
     * none is a different human.
     */
    final client = RecordingClient((request) {
      if (request.url.path.endsWith('/cnes-imports')) {
        return _json({
          'code': 'CNES_REGISTRATION_ALREADY_HELD',
          'personId': 5150,
          'registrationLabel': 'CRM 100200/SP',
        }, statusCode: 409);
      }
      return defaultHandler(request);
    });
    await _pumpSheet(tester, client: client);
    await _openCnesTab(tester);

    await tester.tap(find.text('DESCONHECIDO SOUZA'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();

    // It associated the person the server named, rather than creating another.
    final associate = client.requests.lastWhere(
      (r) => r.url.path.endsWith('/healthcare-professionals'),
    );
    expect((associate.body as Map)['personId'], 5150);
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
