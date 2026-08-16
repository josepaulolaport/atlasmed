import 'dart:math';

import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/capture/data/capture_drain.dart';
import 'package:atlasmed_mobile_app/features/capture/data/pending_capture.dart';
import 'package:atlasmed_mobile_app/features/capture/data/pending_capture_store.dart';
import 'package:flutter/foundation.dart';

/// Holds captures the app could not send, and sends them when it can.
///
/// Spec 0016 §15.6.6-4 allowed two answers to offline capture: the client
/// stamps and the server believes it, or offline capture is refused outright.
/// The stamping contract landed first; this is the other half — the part that
/// means a rep in a basement clinic can still press the button.
///
/// Deliberately not a transparent interceptor. The call sites that enqueue are
/// the ones where a press is a *fact the rep asserted* — arriving, starting,
/// finishing. Planning is not queued: a create needs the server's answer about
/// conflicts, and queuing one would promise an appointment that may be refused.
class CaptureQueue extends ChangeNotifier {
  CaptureQueue({
    required PendingCaptureStore store,
    required CalendarRepositoryContract repository,
    DateTime Function()? now,
  }) : _store = store,
       _repository = repository,
       _now = now ?? DateTime.now;

  final PendingCaptureStore _store;
  final CalendarRepositoryContract _repository;
  final DateTime Function() _now;

  int _pending = 0;
  bool _draining = false;

  /// How many captures are waiting. Shown to the rep — a queue nobody can see
  /// is indistinguishable from work that was silently lost.
  int get pending => _pending;

  Future<void> refresh() async {
    _pending = (await _store.list()).length;
    notifyListeners();
  }

  /// Remembers a capture the app could not send.
  Future<PendingCapture> enqueue({
    required PendingCaptureKind kind,
    required String label,
    required Map<String, dynamic> payload,
    DateTime? stampedAt,
  }) async {
    final entry = PendingCapture(
      id: _mintId(),
      kind: kind,
      // The instant the rep pressed, not the instant this was written down.
      stampedAt: (stampedAt ?? _now()).toUtc(),
      label: label,
      payload: payload,
    );
    await _store.put(entry);
    await refresh();
    return entry;
  }

  /// Sends everything it can, oldest first.
  ///
  /// Safe to call often — on resume, after any successful request, on a manual
  /// retry. Re-entrant calls are ignored rather than queued: two drains racing
  /// would send the same entry twice, and while the idempotency key makes that
  /// harmless on the server it makes the counts the rep sees wrong.
  Future<CaptureDrainResult> drain() async {
    if (_draining) {
      return const CaptureDrainResult(
        sent: 0,
        expired: 0,
        discarded: 0,
        remaining: 0,
      );
    }
    _draining = true;
    try {
      final result = await drainCaptures(
        queue: await _store.list(),
        now: _now(),
        send: _send,
        remove: (entry) => _store.remove(entry.id),
        recordFailure: (entry) => _store.put(entry.withFailure('Sem conexão.')),
      );
      await refresh();
      return result;
    } finally {
      _draining = false;
    }
  }

  Future<void> _send(PendingCapture entry) async {
    final stampedAt = entry.stampedAt.toIso8601String();
    switch (entry.kind) {
      case PendingCaptureKind.arrival:
        await _repository.recordArrival(
          facilityId: entry.payload['facilityId'] as int,
          timeZone: entry.payload['timeZone'] as String,
          idempotencyKey: entry.id,
          startedAt: stampedAt,
        );
      case PendingCaptureKind.start:
        await _repository.startInteraction(
          entry.payload['interactionId'] as int,
          expectedVersion: entry.payload['expectedVersion'] as int,
          idempotencyKey: entry.id,
          startedAt: stampedAt,
        );
      case PendingCaptureKind.complete:
        await _repository.completeInteraction(
          entry.payload['interactionId'] as int,
          expectedVersion: entry.payload['expectedVersion'] as int,
          idempotencyKey: entry.id,
          completedAt: stampedAt,
          correctionReason: entry.payload['correctionReason'] as String?,
        );
    }
  }

  static String _mintId() {
    final random = Random.secure();
    return List<int>.generate(
      16,
      (_) => random.nextInt(256),
    ).map((value) => value.toRadixString(16).padLeft(2, '0')).join();
  }
}
