import 'package:atlasmed_mobile_app/features/capture/data/pending_capture.dart';
import 'package:hive/hive.dart';

/// Where captures wait for signal.
///
/// Survives the app being killed, which is the point: a rep whose phone dies in
/// a car park between the visit and the next bar of signal must not lose it.
abstract interface class PendingCaptureStore {
  /// Oldest first — [drainCaptures] depends on the order.
  Future<List<PendingCapture>> list();
  Future<void> put(PendingCapture entry);
  Future<void> remove(String id);
}

class HivePendingCaptureStore implements PendingCaptureStore {
  HivePendingCaptureStore({required Box<String> box}) : _box = box;

  static const boxName = 'pending-captures';

  final Box<String> _box;

  static Future<HivePendingCaptureStore> create() async {
    final box = await Hive.openBox<String>(boxName);
    return HivePendingCaptureStore(box: box);
  }

  @override
  Future<List<PendingCapture>> list() async {
    final entries = <PendingCapture>[];
    for (final key in _box.keys) {
      final raw = _box.get(key);
      if (raw == null) continue;
      try {
        entries.add(PendingCapture.fromRawJson(raw));
      } catch (_) {
        // An entry this build cannot read is an entry it can never send. Drop
        // it rather than let one bad row wedge the queue behind it for ever.
        await _box.delete(key);
      }
    }
    entries.sort((a, b) => a.stampedAt.compareTo(b.stampedAt));
    return entries;
  }

  @override
  Future<void> put(PendingCapture entry) =>
      _box.put(entry.id, entry.toRawJson());

  @override
  Future<void> remove(String id) => _box.delete(id);
}

/// In-memory, for tests and for a build where Hive failed to open.
class MemoryPendingCaptureStore implements PendingCaptureStore {
  final Map<String, PendingCapture> _entries = {};

  @override
  Future<List<PendingCapture>> list() async {
    final entries = _entries.values.toList()
      ..sort((a, b) => a.stampedAt.compareTo(b.stampedAt));
    return entries;
  }

  @override
  Future<void> put(PendingCapture entry) async => _entries[entry.id] = entry;

  @override
  Future<void> remove(String id) async => _entries.remove(id);
}
