import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/capture/data/capture_drain.dart';
import 'package:atlasmed_mobile_app/features/capture/data/capture_queue.dart';
import 'package:atlasmed_mobile_app/features/capture/data/pending_capture.dart';
import 'package:atlasmed_mobile_app/features/capture/data/pending_capture_store.dart';
import 'package:flutter_test/flutter_test.dart';

final _now = DateTime.utc(2026, 8, 16, 12);

PendingCapture _entry({
  required String id,
  Duration age = const Duration(minutes: 10),
  PendingCaptureKind kind = PendingCaptureKind.arrival,
}) => PendingCapture(
  id: id,
  kind: kind,
  stampedAt: _now.subtract(age),
  label: 'Cheguei · Clínica $id',
  payload: const {'facilityId': 5, 'timeZone': 'America/Sao_Paulo'},
);

class _SendRecorder {
  final List<String> sent = [];
  final List<String> removed = [];
  final List<String> failed = [];
  final Map<String, Object> errors = {};

  Future<void> send(PendingCapture entry) async {
    sent.add(entry.id);
    if (errors[entry.id] case final error?) throw error;
  }

  Future<void> remove(PendingCapture entry) async => removed.add(entry.id);
  Future<void> recordFailure(PendingCapture entry) async =>
      failed.add(entry.id);

  Future<CaptureDrainResult> drain(List<PendingCapture> queue) => drainCaptures(
    queue: queue,
    now: _now,
    send: send,
    remove: remove,
    recordFailure: recordFailure,
  );
}

class _StubRepository implements CalendarRepositoryContract {
  final List<({int facilityId, String? startedAt, String key})> arrivals = [];
  Object? error;

  @override
  Future<InteractionDetail> recordArrival({
    required int facilityId,
    required String timeZone,
    required String idempotencyKey,
    String? startedAt,
  }) async {
    arrivals.add((
      facilityId: facilityId,
      startedAt: startedAt,
      key: idempotencyKey,
    ));
    if (error case final failure?) throw failure;
    return InteractionDetail.fromJson({
      'id': 1,
      'calendarId': 1,
      'recurrenceKey': 'k',
      'modality': 'IN_PERSON',
      'status': 'IN_PROGRESS',
      'version': 1,
      'calendarVersion': 1,
      'canMutate': true,
      'occurrence': {
        'recurrenceKey': 'k',
        'startsAt': '2026-08-16T12:00:00.000Z',
        'endsAt': '2026-08-16T13:00:00.000Z',
        'timeZone': 'America/Sao_Paulo',
      },
      'calendar': {'id': 1, 'title': 'Visita', 'version': 1},
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

void main() {
  group('classifyCaptureFailure', () {
    test('no network is the case the queue exists for', () {
      expect(
        classifyCaptureFailure(const CalendarNetworkException('Sem conexão.')),
        CaptureVerdict.retry,
      );
    });

    test('a refusal the server made is not worth repeating', () {
      // Retrying a decision produces a queue that never drains and an error
      // the rep is shown for ever.
      expect(
        classifyCaptureFailure(
          const CalendarForbiddenException('Fora do escopo.'),
        ),
        CaptureVerdict.discard,
      );
    });
  });

  group('drainCaptures', () {
    test('sends oldest first', () async {
      final recorder = _SendRecorder();

      await recorder.drain(
        [
          _entry(id: 'b', age: const Duration(minutes: 5)),
          _entry(id: 'a', age: const Duration(minutes: 30)),
        ]..sort((x, y) => x.stampedAt.compareTo(y.stampedAt)),
      );

      expect(recorder.sent, ['a', 'b']);
    });

    test('one unreachable entry halts the drain rather than being skipped', () {
      // Order is load-bearing: an arrival closes whichever visit the rep left
      // open (§15.6.1), so sending the second past a stuck first would close
      // the wrong visit and hand the duration model a measurement nobody made.
      final recorder = _SendRecorder()
        ..errors['a'] = const CalendarNetworkException('Sem conexão.');

      return recorder.drain([_entry(id: 'a'), _entry(id: 'b')]).then((result) {
        expect(recorder.sent, ['a']);
        expect(recorder.removed, isEmpty);
        expect(recorder.failed, ['a']);
        expect(result.remaining, 2);
      });
    });

    test('a refused entry is dropped and the rest still go', () async {
      final recorder = _SendRecorder()
        ..errors['a'] = const CalendarForbiddenException('Fora do escopo.');

      final result = await recorder.drain([_entry(id: 'a'), _entry(id: 'b')]);

      expect(recorder.removed, ['a', 'b']);
      expect(result.discarded, 1);
      expect(result.sent, 1);
    });

    test(
      'a stamp too old to be accepted is dropped before it is sent',
      () async {
        // The server refuses anything over a day old (§15.6.6-4). Sending it
        // anyway means a queue that retries a doomed entry for ever.
        final recorder = _SendRecorder();

        final result = await recorder.drain([
          _entry(id: 'old', age: const Duration(hours: 25)),
          _entry(id: 'fresh'),
        ]);

        expect(recorder.sent, ['fresh']);
        expect(result.expired, 1);
        expect(result.sent, 1);
      },
    );
  });

  group('CaptureQueue', () {
    test(
      'replays the instant the rep pressed, not the instant it drained',
      () async {
        // The entire point of §15.6.6-4. A visit recorded in a basement must not
        // be written down as having started in the car park.
        final store = MemoryPendingCaptureStore();
        final repository = _StubRepository();
        final queue = CaptureQueue(
          store: store,
          repository: repository,
          now: () => _now,
        );
        final pressedAt = _now.subtract(const Duration(hours: 2));

        await queue.enqueue(
          kind: PendingCaptureKind.arrival,
          label: 'Cheguei · Clínica',
          payload: const {'facilityId': 5, 'timeZone': 'America/Sao_Paulo'},
          stampedAt: pressedAt,
        );
        await queue.drain();

        expect(
          repository.arrivals.single.startedAt,
          pressedAt.toIso8601String(),
        );
        expect(queue.pending, 0);
      },
    );

    test('replays under the key it was queued with', () async {
      // A press that reached the server before the connection dropped must be
      // recognised as a replay, not recorded a second time.
      final store = MemoryPendingCaptureStore();
      final repository = _StubRepository();
      final queue = CaptureQueue(
        store: store,
        repository: repository,
        now: () => _now,
      );

      final entry = await queue.enqueue(
        kind: PendingCaptureKind.arrival,
        label: 'Cheguei · Clínica',
        payload: const {'facilityId': 5, 'timeZone': 'America/Sao_Paulo'},
      );
      await queue.drain();

      expect(repository.arrivals.single.key, entry.id);
    });

    test('keeps the capture when there is still no signal', () async {
      final store = MemoryPendingCaptureStore();
      final repository = _StubRepository()
        ..error = const CalendarNetworkException('Sem conexão.');
      final queue = CaptureQueue(
        store: store,
        repository: repository,
        now: () => _now,
      );

      await queue.enqueue(
        kind: PendingCaptureKind.arrival,
        label: 'Cheguei · Clínica',
        payload: const {'facilityId': 5, 'timeZone': 'America/Sao_Paulo'},
      );
      final result = await queue.drain();

      expect(result.sent, 0);
      expect(queue.pending, 1);
      expect((await store.list()).single.attempts, 1);
    });
  });

  group('PendingCapture', () {
    test('survives a round trip through storage', () async {
      // It has to outlive the app being killed — a rep whose phone dies
      // between the visit and the next bar of signal must not lose it.
      final entry = _entry(id: 'x');

      expect(PendingCapture.fromRawJson(entry.toRawJson()), entry);
    });

    test('knows when the server would refuse it', () {
      expect(
        _entry(id: 'x', age: const Duration(hours: 23)).isExpiredAt(_now),
        isFalse,
      );
      expect(
        _entry(id: 'x', age: const Duration(hours: 25)).isExpiredAt(_now),
        isTrue,
      );
    });
  });
}
