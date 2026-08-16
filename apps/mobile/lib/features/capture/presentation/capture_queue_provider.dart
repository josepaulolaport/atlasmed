import 'package:atlasmed_mobile_app/features/agenda/presentation/providers/agenda_provider.dart';
import 'package:atlasmed_mobile_app/features/capture/data/capture_queue.dart';
import 'package:atlasmed_mobile_app/features/capture/data/pending_capture_store.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Where captures wait for signal.
///
/// Opened lazily and falling back to memory: a Hive box that will not open is a
/// reason to lose the queue on restart, not a reason to lose the press the rep
/// just made.
final pendingCaptureStoreProvider = Provider<PendingCaptureStore>((ref) {
  return MemoryPendingCaptureStore();
});

final captureQueueProvider = ChangeNotifierProvider<CaptureQueue>((ref) {
  final queue = CaptureQueue(
    store: ref.watch(pendingCaptureStoreProvider),
    repository: ref.watch(calendarRepositoryProvider),
  );
  // Anything already waiting from a previous run should be counted before the
  // rep sees a badge that says zero.
  queue.refresh();
  return queue;
});

/// How many captures are waiting, for surfaces that only need the number.
final pendingCaptureCountProvider = Provider<int>(
  (ref) => ref.watch(captureQueueProvider).pending,
);
