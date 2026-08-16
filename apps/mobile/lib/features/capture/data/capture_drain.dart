import 'package:atlasmed_mobile_app/features/agenda/data/calendar_repository.dart';
import 'package:atlasmed_mobile_app/features/capture/data/pending_capture.dart';

/// What the queue should do with an entry after an attempt.
enum CaptureVerdict {
  /// It landed. Forget it.
  done,

  /// The server could not be reached. Keep it, and stop draining — see
  /// [CaptureDrainResult] for why order matters.
  retry,

  /// The server understood and refused. Retrying will refuse again, so the
  /// entry is removed and the rep is told rather than left with a queue that
  /// never empties.
  discard,
}

/// Why an attempt failed, in the only two categories that change what we do.
///
/// A network failure is the queue's whole reason to exist and must not consume
/// the entry. Anything the server answered is a decision: a visit already
/// started, a clinic out of scope, a stamp it will not accept. Retrying those
/// on a timer produces a queue that never drains and an error the rep sees for
/// ever.
CaptureVerdict classifyCaptureFailure(Object error) =>
    error is CalendarNetworkException
    ? CaptureVerdict.retry
    : error is CalendarApiException
    ? CaptureVerdict.discard
    : CaptureVerdict.retry;

class CaptureDrainResult {
  const CaptureDrainResult({
    required this.sent,
    required this.expired,
    required this.discarded,
    required this.remaining,
  });

  final int sent;
  final int expired;
  final int discarded;
  final int remaining;

  bool get changedAnything => sent > 0 || expired > 0 || discarded > 0;

  @override
  String toString() =>
      'CaptureDrainResult(sent: $sent, expired: $expired, '
      'discarded: $discarded, remaining: $remaining)';
}

/// Replays [queue] in order, stopping at the first entry it could not reach the
/// server for.
///
/// **Order is load-bearing and so is stopping.** An arrival closes whichever
/// visit the rep left open (§15.6.1), so replaying yesterday's second arrival
/// before its first would close the wrong visit and hand the duration model a
/// measurement nobody made. Sending later entries past a stuck one would do
/// exactly that, which is why one unreachable entry halts the drain rather than
/// being skipped.
///
/// Entries whose stamp has aged past [kCaptureStampMaxAge] are dropped before
/// they are sent. The server would refuse them (§15.6.6-4) and a queue that
/// retries a doomed entry every time it wakes never empties.
Future<CaptureDrainResult> drainCaptures({
  required List<PendingCapture> queue,
  required DateTime now,
  required Future<void> Function(PendingCapture entry) send,
  required Future<void> Function(PendingCapture entry) remove,
  required Future<void> Function(PendingCapture entry) recordFailure,
}) async {
  var sent = 0;
  var expired = 0;
  var discarded = 0;

  for (var index = 0; index < queue.length; index += 1) {
    final entry = queue[index];

    if (entry.isExpiredAt(now)) {
      await remove(entry);
      expired += 1;
      continue;
    }

    try {
      await send(entry);
      await remove(entry);
      sent += 1;
    } catch (error) {
      switch (classifyCaptureFailure(error)) {
        case CaptureVerdict.discard:
          await remove(entry);
          discarded += 1;
        case CaptureVerdict.retry:
          await recordFailure(entry);
          return CaptureDrainResult(
            sent: sent,
            expired: expired,
            discarded: discarded,
            remaining: queue.length - index,
          );
        case CaptureVerdict.done:
          break;
      }
    }
  }

  return CaptureDrainResult(
    sent: sent,
    expired: expired,
    discarded: discarded,
    remaining: 0,
  );
}
