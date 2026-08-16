import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/capture/data/pending_capture.dart';
import 'package:atlasmed_mobile_app/features/capture/data/pending_capture_store.dart';
import 'package:atlasmed_mobile_app/features/capture/presentation/capture_queue_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/clinic_arrival.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _ArrivalRecordingRepository implements CalendarRepositoryContract {
  final List<
    ({
      int facilityId,
      String timeZone,
      String idempotencyKey,
      String? startedAt,
    })
  >
  calls = [];
  Object? error;

  @override
  Future<InteractionDetail> recordArrival({
    required int facilityId,
    required String timeZone,
    required String idempotencyKey,
    String? startedAt,
  }) async {
    calls.add((
      facilityId: facilityId,
      timeZone: timeZone,
      idempotencyKey: idempotencyKey,
      startedAt: startedAt,
    ));
    if (error case final failure?) throw failure;
    return InteractionDetail.fromJson({
      'id': 77,
      'calendarId': 9,
      'recurrenceKey': '2026-08-15T22:09[America/Sao_Paulo]',
      'modality': 'IN_PERSON',
      'status': 'IN_PROGRESS',
      'version': 1,
      'calendarVersion': 1,
      'canMutate': true,
      'occurrence': {
        'recurrenceKey': '2026-08-15T22:09[America/Sao_Paulo]',
        'startsAt': '2026-08-16T01:09:00.000Z',
        'endsAt': '2026-08-16T02:09:00.000Z',
        'timeZone': 'America/Sao_Paulo',
      },
      'calendar': {'id': 9, 'title': 'Visita · Clínica', 'version': 1},
      'facility': {'id': 5, 'displayName': 'Clínica'},
      'agent': {'id': 2, 'firstName': 'Adriana'},
      'linkedOrders': const [],
    });
  }

  @override
  Future<List<CalendarOccurrence>> listCalendar({
    required DateTime from,
    required DateTime to,
    int? ownerUserId,
  }) async => const [];

  @override
  Future<List<CalendarAvailabilityInterval>> getAvailability({
    required DateTime from,
    required DateTime to,
    int? ownerUserId,
  }) async => const [];

  @override
  Future<InteractionDetail> getInteraction(int id) =>
      throw UnimplementedError();

  @override
  Future<InteractionDetail> startInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
    String? startedAt,
  }) => throw UnimplementedError();

  @override
  Future<InteractionDetail> completeInteraction(
    int id, {
    required int expectedVersion,
    required String idempotencyKey,
    String? correctionReason,
    String? completedAt,
  }) => throw UnimplementedError();

  @override
  Future<InteractionDetail> recordInteractionOutcome(
    int id, {
    required InteractionOutcome outcome,
    required InteractionFollowUp followUp,
  }) => throw UnimplementedError();
}

Future<void> _tapCheguei(
  WidgetTester tester,
  _ArrivalRecordingRepository repository, {
  PendingCaptureStore? captureStore,
}) async {
  final store = captureStore ?? MemoryPendingCaptureStore();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        calendarRepositoryProvider.overrideWithValue(repository),
        pendingCaptureStoreProvider.overrideWithValue(store),
      ],
      child: MaterialApp(
        home: Scaffold(
          body: Consumer(
            builder: (context, ref, _) => TextButton(
              onPressed: () => recordClinicArrival(
                context,
                ref,
                facilityId: 5,
                facilityName: 'Clínica Central',
              ),
              child: const Text('Cheguei'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Cheguei'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('records the clinic the rep is standing in', (tester) async {
    // §15.6.3: until this existed, a clinic the rep simply walked into could
    // not be recorded at all.
    final repository = _ArrivalRecordingRepository();

    await _tapCheguei(tester, repository);

    expect(repository.calls, hasLength(1));
    expect(repository.calls.single.facilityId, 5);
    expect(repository.calls.single.timeZone, isNotEmpty);
    expect(find.textContaining('Visita iniciada em Clínica Central'), findsOne);
  });

  testWidgets('offers a way into the visit it just started', (tester) async {
    // The recovery path for a mistaken press, and the way to end the visit
    // deliberately rather than waiting to be closed.
    final repository = _ArrivalRecordingRepository();

    await _tapCheguei(tester, repository);

    expect(find.text('Abrir'), findsOne);
  });

  testWidgets('two presses are two visits, not one replayed', (tester) async {
    // The key is per press: a retry of one press must not duplicate, but two
    // deliberate arrivals at the same clinic are two visits.
    final repository = _ArrivalRecordingRepository();

    await _tapCheguei(tester, repository);
    await _tapCheguei(tester, repository);

    expect(repository.calls, hasLength(2));
    expect(
      repository.calls.first.idempotencyKey,
      isNot(repository.calls.last.idempotencyKey),
    );
  });

  testWidgets('says why when the server refuses', (tester) async {
    // A silent failure here would leave the rep believing the visit was
    // recorded — worse than not offering the button.
    final repository = _ArrivalRecordingRepository()
      ..error = const CalendarForbiddenException('Clínica fora do seu escopo.');

    await _tapCheguei(tester, repository);

    expect(find.text('Clínica fora do seu escopo.'), findsOne);
  });

  testWidgets('keeps the visit when there is no signal', (tester) async {
    // The case the queue exists for. Losing the press because a clinic sits in
    // a basement is exactly the under-counting §15.6.3 is about.
    final store = MemoryPendingCaptureStore();
    final repository = _ArrivalRecordingRepository()
      ..error = const CalendarNetworkException('Sem conexão.');

    await _tapCheguei(tester, repository, captureStore: store);

    final queued = await store.list();
    expect(queued, hasLength(1));
    expect(queued.single.kind, PendingCaptureKind.arrival);
    expect(queued.single.payload['facilityId'], 5);
    expect(queued.single.label, 'Cheguei · Clínica Central');
    expect(find.textContaining('Sem conexão'), findsOne);
  });

  testWidgets('does not queue a visit the server refused', (tester) async {
    // A decision is not a connectivity problem. Queuing it would refuse again
    // later and tell the rep twice about one mistake.
    final store = MemoryPendingCaptureStore();
    final repository = _ArrivalRecordingRepository()
      ..error = const CalendarForbiddenException('Clínica fora do seu escopo.');

    await _tapCheguei(tester, repository, captureStore: store);

    expect(await store.list(), isEmpty);
  });

  testWidgets('sends the instant the rep pressed, not the instant it arrived', (
    tester,
  ) async {
    final repository = _ArrivalRecordingRepository();

    await _tapCheguei(tester, repository);

    expect(repository.calls.single.startedAt, isNotNull);
  });
}
