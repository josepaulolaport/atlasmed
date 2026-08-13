import 'dart:convert';

import 'package:atlasmed_mobile_app/features/explore/data/domain/cnes_suggestions.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/cnes_import_wizard.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_cache_storage.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../cnes_catalogue_fixtures.dart';

/// Filling in a doctor's profile before importing them (spec 0012 §6).
///
/// The wizard exists because CNES ships four fields and a complete professional
/// needs more: specialty and role are what every commercial view reads, and a
/// person created without them is one somebody has to go and finish later. What
/// is asserted here is that nothing is written until the last step, that the two
/// required fields actually block, and that a queue of doctors saves each as its
/// own run completes.
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

CnesSuggestion _suggestion({
  String cnesId = 'SUS999',
  String name = 'DESCONHECIDO SOUZA',
  List<CnesOccupationOption> occupations = const [
    CnesOccupationOption(id: 10, name: 'Anestesiologista'),
    CnesOccupationOption(id: 20, name: 'Intensivista'),
  ],
}) => CnesSuggestion(
  personId: null,
  professionalCnesId: cnesId,
  displayName: name,
  registrationLabel: 'CRM 100200/SP',
  occupationOptions: occupations,
);

CnesImportOutcome? outcome;

Future<void> _pumpWizard(
  WidgetTester tester, {
  required RecordingClient client,
  List<CnesSuggestion>? suggestions,
  CnesImportCatalogues? catalogues,
}) async {
  outcome = null;
  await tester.pumpWidget(
    MaterialApp(
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: ElevatedButton(
              onPressed: () async {
                outcome = await Navigator.of(context).push<CnesImportOutcome>(
                  MaterialPageRoute(
                    builder: (_) => CnesImportWizard(
                      facilityId: 9,
                      suggestions: suggestions ?? [_suggestion()],
                      repositoryBuilder: (id) =>
                          FacilityAssociateRepository(id, client: client),
                      catalogues: catalogues ?? testCatalogues(),
                    ),
                  ),
                );
              },
              child: const Text('abrir'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('abrir'));
  await tester.pumpAndSettle();
}

/// Step 1 → step 2, filling in the two required clinical fields on the way.
Future<void> _completeClinicalStep(
  WidgetTester tester, {
  String specialty = 'Ortopedia',
}) async {
  await tester.tap(find.byKey(const Key('wizard-next')));
  await tester.pumpAndSettle();

  await tester.tap(find.byKey(const Key('wizard-specialty')));
  await tester.pumpAndSettle();
  await tester.tap(find.text(specialty).last);
  await tester.pumpAndSettle();

  await tester.tap(find.widgetWithText(FilterChip, 'Prescritor'));
  await tester.pumpAndSettle();
}

/// The steps are lists, so anything below the fold is not built until scrolled
/// to — a finder that misses it would be reporting layout, not absence.
Future<void> _scrollTo(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder,
    240,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
}

bool _nextEnabled(WidgetTester tester) =>
    tester
        .widget<FilledButton>(find.byKey(const Key('wizard-next')))
        .onPressed !=
    null;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  BaseRepository.storage = const MemoryCacheStorage();
  BaseRepository.autoRefreshEnabled = false;

  RepositoryHttpResponse defaultHandler(RepositoryHttpRequest request) {
    if (request.url.path.endsWith('/cnes-imports')) {
      return _json({'personId': 777, 'created': true});
    }
    if (request.url.path.endsWith('/cnes-associations')) {
      return _json({'personId': 777, 'personFacilityId': 5, 'created': true});
    }
    return _json(const {});
  }

  testWidgets('writes nothing until the last step', (tester) async {
    /*
     * The import is one transaction on the server — person, registration,
     * specialty, affiliation and occupations together — so firing it early
     * would mean either a half-written doctor or a second request to finish
     * them. Nothing leaves the client until the rep confirms the review.
     */
    final client = RecordingClient(defaultHandler);
    await _pumpWizard(tester, client: client);

    expect(find.text('Identidade e contato'), findsOneWidget);
    await _completeClinicalStep(tester);
    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();

    expect(find.text('Revisão'), findsOneWidget);
    expect(client.requests, isEmpty);

    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();
    expect(
      client.paths.where((p) => p.endsWith('/cnes-imports')),
      hasLength(1),
    );
  });

  testWidgets('will not leave the clinical step without specialty and role', (
    tester,
  ) async {
    /*
     * Required because the data says they already are: 1 205 of the 1 206
     * doctors we hold carry a specialty and 1 749 of 1 752 affiliations carry a
     * role. A doctor with neither is unfindable by the search reps use.
     */
    final client = RecordingClient(defaultHandler);
    await _pumpWizard(tester, client: client);

    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();
    expect(_nextEnabled(tester), isFalse);

    await tester.tap(find.byKey(const Key('wizard-specialty')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ortopedia').last);
    await tester.pumpAndSettle();
    // Specialty alone is not enough.
    expect(_nextEnabled(tester), isFalse);

    await tester.tap(find.widgetWithText(FilterChip, 'Prescritor'));
    await tester.pumpAndSettle();
    expect(_nextEnabled(tester), isTrue);
  });

  testWidgets('sends the whole profile the rep filled in', (tester) async {
    final client = RecordingClient(defaultHandler);
    await _pumpWizard(tester, client: client);

    await tester.enterText(
      find.byKey(const Key('wizard-first-name')),
      'Ingrid',
    );
    await tester.enterText(
      find.byKey(const Key('wizard-last-name')),
      'Andrade',
    );
    await tester.pumpAndSettle();

    await _completeClinicalStep(tester);
    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();

    // Personal notes live in the review step, collapsed: six of the 1 206
    // doctors we hold carry any of them, so a step of their own would be a
    // screen almost every import taps past.
    expect(find.text('Hobbies'), findsNothing);
    await _scrollTo(tester, find.byKey(const Key('wizard-personal')));
    await tester.tap(find.byKey(const Key('wizard-personal')));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Time'), 'Fla');
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();

    final body = client.bodyEndingWith('/cnes-imports');
    expect(body['professionalCnesId'], 'SUS999');
    expect(body['firstName'], 'Ingrid');
    expect(body['lastName'], 'Andrade');
    expect(body['specialtyId'], 1);
    expect(body['roleIds'], [1]);
    expect(body['occupationIds'], [10, 20]);
    expect(body['favoriteTeam'], 'Fla');
    // Never the CNES registration: it is copied server-side, because it is the
    // field identity rests on and the one a hurried rep would mistype.
    expect(body.containsKey('registrationNumber'), isFalse);
    // Untouched optional fields are absent rather than empty strings — `null`
    // means unknown, `''` would claim we know it is nothing.
    expect(body.containsKey('cpf'), isFalse);
    expect(body.containsKey('email'), isFalse);
  });

  testWidgets('will not carry a CPF the column cannot hold', (tester) async {
    /*
     * `persons.cpf` is char(11) and the endpoint demands exactly eleven. Left
     * to the server this is a rejected request after the rep has filled in the
     * whole wizard, naming a field two steps behind them.
     */
    final client = RecordingClient(defaultHandler);
    await _pumpWizard(tester, client: client);

    await tester.enterText(find.byKey(const Key('wizard-cpf')), '12345');
    await tester.pumpAndSettle();

    expect(find.text('CPF deve ter 11 dígitos'), findsOneWidget);
    expect(_nextEnabled(tester), isFalse);

    await tester.enterText(find.byKey(const Key('wizard-cpf')), '12345678901');
    await tester.pumpAndSettle();
    expect(_nextEnabled(tester), isTrue);
  });

  testWidgets('will not carry a birth date that is not one', (tester) async {
    /*
     * `persons.birth_date` is a real date, so free text used to reach the
     * driver and come back as a query failure — a 500 the rep read as "falha ao
     * importar", for a typo in a field they could see.
     */
    final client = RecordingClient(defaultHandler);
    await _pumpWizard(tester, client: client);

    await _completeClinicalStep(tester);
    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();
    await _scrollTo(tester, find.byKey(const Key('wizard-personal')));
    await tester.tap(find.byKey(const Key('wizard-personal')));
    await tester.pumpAndSettle();

    await _scrollTo(tester, find.byKey(const Key('wizard-birth-date')));
    await tester.enterText(
      find.byKey(const Key('wizard-birth-date')),
      '2026-02-30',
    );
    await tester.pumpAndSettle();

    // Eleven plausible characters, and still not a day.
    expect(find.text('Data inválida'), findsOneWidget);
    expect(_nextEnabled(tester), isFalse);
    expect(client.requests, isEmpty);

    await tester.enterText(
      find.byKey(const Key('wizard-birth-date')),
      '1979-04-17',
    );
    await tester.pumpAndSettle();
    expect(_nextEnabled(tester), isTrue);

    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();
    expect(client.bodyEndingWith('/cnes-imports')['birthDate'], '1979-04-17');
  });

  testWidgets('the CNES registration is shown but cannot be edited', (
    tester,
  ) async {
    final client = RecordingClient(defaultHandler);
    await _pumpWizard(tester, client: client);

    await _scrollTo(tester, find.text('CRM 100200/SP'));
    expect(find.text('CRM 100200/SP'), findsOneWidget);
    // Shown as a locked row, not as a field somebody can type over.
    expect(find.widgetWithText(TextFormField, 'CRM 100200/SP'), findsNothing);
  });

  testWidgets('a registration the rep adds is additive', (tester) async {
    final client = RecordingClient(defaultHandler);
    await _pumpWizard(tester, client: client);

    await _scrollTo(tester, find.byKey(const Key('wizard-add-registration')));
    await tester.tap(find.byKey(const Key('wizard-add-registration')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('wizard-registration-uf')),
      'RJ',
    );
    await tester.enterText(
      find.byKey(const Key('wizard-registration-number')),
      '54321',
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('wizard-registration-save')));
    await tester.pumpAndSettle();

    await _completeClinicalStep(tester);
    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();

    final body = client.bodyEndingWith('/cnes-imports');
    expect(body['extraRegistrations'], [
      {'councilId': 1, 'stateCode': 'RJ', 'registrationNumber': '54321'},
    ]);
  });

  testWidgets('drops an occupation the rep unticked', (tester) async {
    final client = RecordingClient(defaultHandler);
    await _pumpWizard(tester, client: client);

    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilterChip, 'Intensivista'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('wizard-specialty')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ortopedia').last);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilterChip, 'Prescritor'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();

    expect(client.bodyEndingWith('/cnes-imports')['occupationIds'], [10]);
  });

  testWidgets('associates instead when the registration is already held', (
    tester,
  ) async {
    /*
     * Not a failure. The server refuses to create a second record for a
     * registration somebody already holds and names them instead, so the wizard
     * links that person — through the CNES endpoint, so the occupations the rep
     * confirmed are recorded rather than dropped.
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
    await _pumpWizard(tester, client: client);

    await _completeClinicalStep(tester);
    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();

    final body = client.bodyEndingWith('/cnes-associations');
    expect(body['professionalCnesId'], 'SUS999');
    expect(body['occupationIds'], [10, 20]);
    expect(outcome?.reused, 1);
    expect(outcome?.imported.single.id, 5150);
  });

  testWidgets('queues several doctors and keeps the ones already saved', (
    tester,
  ) async {
    /*
     * One at a time, each written as its own run completes. A batch would have
     * to either lose everything when the rep quits halfway or carry a
     * partial-failure story — and quitting halfway through five doctors is the
     * ordinary case, not the exception.
     */
    final client = RecordingClient(defaultHandler);
    await _pumpWizard(
      tester,
      client: client,
      suggestions: [
        _suggestion(cnesId: 'SUS1', name: 'PRIMEIRO MEDICO'),
        _suggestion(cnesId: 'SUS2', name: 'SEGUNDO MEDICO'),
      ],
    );

    expect(find.textContaining('1 de 2'), findsOneWidget);
    await _completeClinicalStep(tester);
    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('wizard-next')));
    await tester.pumpAndSettle();

    // The first is written and the wizard moves on rather than closing.
    expect(
      client.paths.where((p) => p.endsWith('/cnes-imports')),
      hasLength(1),
    );
    expect(find.textContaining('2 de 2'), findsOneWidget);
    expect(find.text('SEGUNDO MEDICO'), findsOneWidget);

    // Quitting now keeps the first doctor: nothing about them is pending.
    await tester.tap(find.byKey(const Key('wizard-back')));
    await tester.pumpAndSettle();
    expect(outcome?.imported, hasLength(1));
    expect(
      client.paths.where((p) => p.endsWith('/cnes-imports')),
      hasLength(1),
    );
  });

  testWidgets('says so when the catalogues cannot be loaded', (tester) async {
    // Specialty and role are required, so an empty picker would read as "there
    // are none" and leave the rep tapping a button that never enables.
    final client = RecordingClient(defaultHandler);
    await _pumpWizard(
      tester,
      client: client,
      catalogues: testCatalogues(
        onSpecialties: () async => throw StateError('boom'),
      ),
    );

    expect(
      find.text('Não foi possível carregar especialidades e papéis.'),
      findsOneWidget,
    );
    expect(client.requests, isEmpty);
  });
}
