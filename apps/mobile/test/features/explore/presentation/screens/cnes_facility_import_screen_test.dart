import 'dart:async';

import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/repositories/cnes_facility_candidates_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/cnes_facility_import_screen.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Importing a clinic from CNES (spec 0015 §6).
///
/// What matters here is that the two cases stay two cases. A clinic we already
/// hold must not be offered a wizard: `location`, name, CNPJ, address and unit
/// type live on the **shared** facility row, so a form on that path would let
/// one vertical overwrite another's curated record and move the pin for
/// everybody. And a server error that names a field — "this CNPJ belongs to X" —
/// has to reach the user, or the feature reads as broken when it is working
/// exactly as designed.
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

  Map<String, dynamic> bodyEndingWith(String suffix) =>
      requests.firstWhere((r) => r.url.path.endsWith(suffix)).body
          as Map<String, dynamic>;
}

/// Answers everything at once except one path, which it leaves pending until
/// the test completes it — the only way to observe an in-flight state.
class _HoldingClient extends RecordingClient {
  _HoldingClient(super.handler, this.heldPath, this.held);

  final String heldPath;
  final Completer<RepositoryHttpResponse> held;

  @override
  Future<RepositoryHttpResponse> call({
    required RepositoryHttpRequest request,
  }) {
    requests.add(request);
    if (request.url.path.endsWith(heldPath)) return held.future;
    return Future.value(handler(request));
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

Map<String, dynamic> _candidate({
  String cnesCode = '9990001',
  String name = 'CLINICA NOVA',
  bool imported = false,
}) => {
  'cnesCode': cnesCode,
  'name': name,
  'imported': imported,
  'municipality': 'SAO PAULO',
  'state': 'SP',
};

Map<String, dynamic> _preview({
  String cnesCode = '9990001',
  bool alreadyImported = false,
  bool requiresLocation = false,
  String? legalDocument = '11222333000144',
}) => {
  'cnesCode': cnesCode,
  'suggestedName': 'CLINICA NOVA',
  'legalDocumentLocked': legalDocument != null,
  'requiresLocation': requiresLocation,
  'requiresUnitType': false,
  'alreadyImported': alreadyImported,
  'existingVerticalIds': const <int>[],
  'legalDocument': legalDocument,
  'legalDocumentType': 'CNPJ',
  'municipalityName': 'SAO PAULO',
  'stateAbbreviation': 'SP',
  'latitude': requiresLocation ? null : -23.55,
  'longitude': requiresLocation ? null : -46.63,
};

Future<void> _pump(
  WidgetTester tester, {
  required RecordingClient client,
}) async {
  final repository = CnesFacilityCandidatesRepository(
    baseUrl: 'https://example.test',
    client: client,
  );

  await tester.pumpWidget(
    MaterialApp(
      home: CnesFacilityImportScreen(
        repository: repository,
        initialQuery: 'clinica',
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// The form is a lazy `ListView`, so anything below the fold is not built until
/// it scrolls into view — `findsNothing` there means "not rendered yet", not
/// "absent". The submit button is pinned outside the list precisely so it is
/// never in that state.
Future<void> _scrollToBottom(WidgetTester tester) async {
  await tester.drag(find.byType(ListView), const Offset(0, -600));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  BaseRepository.storage = const MemoryCacheStorage();
  BaseRepository.autoRefreshEnabled = false;

  RepositoryHttpResponse handler(RepositoryHttpRequest request) {
    final path = request.url.path;
    if (path.endsWith('/import')) {
      return _json({'outcome': 'CREATED', 'facilityId': 42});
    }
    if (path.endsWith('/cnes-candidates')) {
      return _json({
        'data': [
          _candidate(),
          _candidate(
            cnesCode: '9990002',
            name: 'CLINICA NOSSA',
            imported: true,
          ),
        ],
        'meta': const {'estimatedTotal': 2},
      });
    }
    if (path.contains('/cnes-candidates/9990002')) {
      return _json(_preview(cnesCode: '9990002', alreadyImported: true));
    }
    return _json(_preview());
  }

  testWidgets('lists candidates and marks the ones we already hold', (
    tester,
  ) async {
    final client = RecordingClient(handler);
    await _pump(tester, client: client);

    expect(find.text('CLINICA NOVA'), findsOneWidget);
    expect(find.text('CLINICA NOSSA'), findsOneWidget);
    // The row has to say which case it is: importing one creates a clinic and
    // importing the other only adds a profile to one we already hold.
    expect(find.textContaining('Já cadastrada'), findsOneWidget);
    expect(find.textContaining('adiciona à sua vertical'), findsOneWidget);
  });

  testWidgets('a clinic we already hold gets a confirmation, not a form', (
    tester,
  ) async {
    final client = RecordingClient(handler);
    await _pump(tester, client: client);

    await tester.tap(find.byKey(const ValueKey('cnes-candidate-9990002')));
    await tester.pumpAndSettle();

    /*
     * No editable fields at all. The facility row is shared across verticals,
     * so a form here would let this user rewrite a record another vertical
     * curated — and re-placing the pin would move the clinic for every one of
     * them, re-running territory assignment on profiles that are not theirs.
     */
    expect(find.byType(TextField), findsNothing);
    expect(find.text('Adicionar à minha vertical'), findsOneWidget);
  });

  testWidgets('a new clinic gets the wizard, with the CNPJ read-only', (
    tester,
  ) async {
    final client = RecordingClient(handler);
    await _pump(tester, client: client);

    await tester.tap(find.byKey(const ValueKey('cnes-candidate-9990001')));
    await tester.pumpAndSettle();

    expect(find.byType(TextField), findsWidgets);
    expect(find.text('Importar clínica'), findsOneWidget);
    // Supplied by CNES, so shown and not editable: a retyped CNPJ is how two
    // clinics collide.
    expect(find.text('11222333000144'), findsOneWidget);
  });

  testWidgets('sends what the user confirmed', (tester) async {
    final client = RecordingClient(handler);
    await _pump(tester, client: client);

    await tester.tap(find.byKey(const ValueKey('cnes-candidate-9990001')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'CLINICA CORRIGIDA');
    await tester.tap(find.byKey(const ValueKey('cnes-import-submit')));
    await tester.pumpAndSettle();

    final body = client.bodyEndingWith('/import');
    expect(body['name'], 'CLINICA CORRIGIDA');
    // Never sent: the API refuses a client-supplied CNPJ for a pessoa jurídica.
    expect(body.containsKey('legalDocument'), isFalse);
    // The pin CNES supplied has to survive the trip. It decides which manager
    // zone and rep patch the clinic lands in, and dropping it silently is a
    // clinic nobody owns.
    expect(body['lat'], -23.55);
    expect(body['lng'], -46.63);
  });

  testWidgets('shows the field error the server named', (tester) async {
    /*
     * The domain errors this surface raises are the whole point — "this CNPJ
     * belongs to X", "place the clinic on the map". The API nests them under
     * `error`, and reading the top level would drop them and leave a bare status
     * code, which a user reads as the feature being broken.
     */
    final client = RecordingClient((request) {
      if (request.url.path.endsWith('/import')) {
        return _json({
          'error': {
            'message': 'Validation failed',
            'details': [
              {
                'field': 'legalDocument',
                'message':
                    'CNPJ 11222333000144 already belongs to "Clinica Irma"',
              },
            ],
          },
        }, statusCode: 422);
      }
      return handler(request);
    });
    await _pump(tester, client: client);

    await tester.tap(find.byKey(const ValueKey('cnes-candidate-9990001')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('cnes-import-submit')));
    await tester.pumpAndSettle();

    expect(find.textContaining('Clinica Irma'), findsOneWidget);
  });

  testWidgets('says so when CNES has no point for the clinic', (tester) async {
    final client = RecordingClient((request) {
      if (request.url.path.contains('/cnes-candidates/9990001')) {
        return _json(_preview(requiresLocation: true));
      }
      return handler(request);
    });
    await _pump(tester, client: client);

    await tester.tap(find.byKey(const ValueKey('cnes-candidate-9990001')));
    await tester.pumpAndSettle();

    // Spec 0009 R5: the pin decides the territory, so a missing one is a screen
    // the user must answer rather than a field that quietly stays blank.
    await _scrollToBottom(tester);
    expect(find.textContaining('não informou onde fica'), findsOneWidget);
    // And it says what importing without one costs, since importing without one
    // is allowed.
    expect(find.textContaining('sem território'), findsOneWidget);
  });

  testWidgets('cannot import while the address is still being derived', (
    tester,
  ) async {
    /*
     * Found by tapping too fast on the simulator: confirming a moved pin and
     * importing straight away sent the new coordinates with the old address —
     * the pair spec 0009 decision 4 exists to keep together, split by a request
     * that had not come back yet.
     */
    // The geocode call is held open, because the state only exists while a
    // request is in flight and a fake that answers instantly never shows it.
    final held = Completer<RepositoryHttpResponse>();
    // The no-coordinates preview, so the card draws its placeholder rather than
    // a platform map view that will not lay out under the test binding.
    final client = _HoldingClient(
      (request) {
        if (request.url.path.contains('/cnes-candidates/9990001')) {
          // Needs a street, or "Usar endereço" is disabled and there is
          // nothing to hold open.
          return _json({
            ..._preview(requiresLocation: true),
            'streetAddress': 'Rua Visconde de Piraja',
            'streetNumber': '550',
          });
        }
        return handler(request);
      },
      '/geocode',
      held,
    );
    await _pump(tester, client: client);

    await tester.tap(find.byKey(const ValueKey('cnes-candidate-9990001')));
    await tester.pumpAndSettle();
    await _scrollToBottom(tester);

    // "Usar endereço" puts the screen in the same in-flight state a confirmed
    // pin does, and is reachable without driving a platform map view.
    final useAddress = find.byKey(const Key('facility-location-use-address'));
    await tester.ensureVisible(useAddress);
    await tester.pumpAndSettle();
    await tester.tap(useAddress);
    await tester.pump();

    final heldSubmit = tester.widget<FilledButton>(
      find.byKey(const ValueKey('cnes-import-submit')),
    );
    expect(heldSubmit.onPressed, isNull);

    held.complete(_json({'point': null}));
    await tester.pumpAndSettle();

    // And live again once the answer is in.
    final freed = tester.widget<FilledButton>(
      find.byKey(const ValueKey('cnes-import-submit')),
    );
    expect(freed.onPressed, isNotNull);
  });

  testWidgets('offers the map rather than asking for coordinates', (
    tester,
  ) async {
    final client = RecordingClient((request) {
      if (request.url.path.contains('/cnes-candidates/9990001')) {
        return _json(_preview(requiresLocation: true));
      }
      return handler(request);
    });
    await _pump(tester, client: client);

    await tester.tap(find.byKey(const ValueKey('cnes-candidate-9990001')));
    await tester.pumpAndSettle();
    await _scrollToBottom(tester);

    // Typing "-23.550520" into a text box is what this replaced.
    expect(find.text('Latitude'), findsNothing);
    expect(find.text('Longitude'), findsNothing);
    expect(find.byKey(const Key('facility-location-pick')), findsOneWidget);
    expect(
      find.byKey(const Key('facility-location-use-address')),
      findsOneWidget,
    );
  });
}
